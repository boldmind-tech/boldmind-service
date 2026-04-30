// src/modules/fitness/fitness.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { CreateWorkoutPlanDto } from './dto/create-workout-plan.dto';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { LogMealDto } from './dto/log-meal.dto';
import { FitnessGoal } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class FitnessService {
  private readonly ai: Anthropic;

  constructor(
    private config: ConfigService,
    private http: HttpService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.ai = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') });
  }

  // ─── PROFILE ────────────────────────────────────────────────────────────────

  async getOrCreateProfile(userId: string) {
    let profile = await this.prisma.fitnessProfile.findUnique({ where: { userId } });
    if (!profile) {
      profile = await this.prisma.fitnessProfile.create({
        data: { userId, goal: FitnessGoal.MAINTENANCE },
      });
    }
    return profile;
  }

  async updateProfile(userId: string, data: {
    age?: number;
    weight?: number;
    height?: number;
    goal?: FitnessGoal;
    activityLevel?: string;
    dietaryPreferences?: string[];
  }) {
    // Map service-level field names to schema field names
    const mapped: any = { ...data };
    if (data.weight !== undefined) { mapped.weightKg = data.weight; delete mapped.weight; }
    if (data.height !== undefined) { mapped.heightCm = data.height; delete mapped.height; }
    if (data.dietaryPreferences) { mapped.dietaryPrefs = data.dietaryPreferences; delete mapped.dietaryPreferences; }

    return this.prisma.fitnessProfile.upsert({
      where: { userId },
      create: { userId, ...mapped },
      update: mapped,
    });
  }

  // ─── AI WORKOUT PLAN GENERATION ──────────────────────────────────────────────

  async generateWorkoutPlan(userId: string, dto: CreateWorkoutPlanDto) {
    const profile = await this.getOrCreateProfile(userId);

    const prompt = `You are a certified fitness trainer. Generate a ${dto.durationWeeks}-week ${dto.goal ?? profile.goal} workout plan.

User profile:
- Age: ${profile.age ?? 'unknown'}
- Weight: ${profile.weightKg ? `${profile.weightKg}kg` : 'unknown'}
- Height: ${profile.heightCm ? `${profile.heightCm}cm` : 'unknown'}
- Activity level: ${profile.activityLevel ?? dto.activityLevel ?? 'moderate'}
- Fitness goal: ${dto.goal ?? profile.goal}
- Equipment available: ${dto.equipment?.join(', ') ?? 'bodyweight only'}
- Days per week: ${dto.daysPerWeek ?? 4}

Return ONLY valid JSON in this format (no markdown):
{
  "planName": string,
  "weeks": [
    {
      "week": number,
      "days": [
        {
          "day": string,
          "focus": string,
          "exercises": [
            { "name": string, "sets": number, "reps": string, "rest": string, "notes": string }
          ],
          "estimatedDuration": string
        }
      ]
    }
  ],
  "tips": string[]
}`;

    const resp = await this.ai.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (resp.content[0] as any).text;
    let plan: any;
    try {
      plan = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      throw new BadRequestException('AI returned an invalid workout plan');
    }

    const saved = await this.prisma.workoutPlan.create({
      data: {
        userId,
        profileId: profile.id,
        name: plan.planName,
        goal: (dto.goal as any) ?? profile.goal,
        durationWeeks: dto.durationWeeks,
        daysPerWeek: dto.daysPerWeek ?? 4,
        workouts: plan as any,
        isAIGenerated: true,
      },
    });

    return saved;
  }

  async getWorkoutPlans(userId: string) {
    return this.prisma.workoutPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkoutPlan(id: string, userId: string) {
    const plan = await this.prisma.workoutPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    return plan;
  }

  // ─── WORKOUT LOG ────────────────────────────────────────────────────────────

  async logWorkout(userId: string, dto: LogWorkoutDto) {
    const log = await this.prisma.workoutLog.create({
      data: {
        userId,
        planId: dto.planId,
        date: dto.date ? new Date(dto.date) : new Date(),
        exercises: dto.exercises as any,
        durationMinutes: dto.durationMinutes ?? 0,
        caloriesBurned: dto.caloriesBurned,
        notes: dto.notes,
        mood: dto.mood,
        completedAt: new Date(),
      },
    });

    // Update streak
    await this.updateStreak(userId);
    return log;
  }

  async getWorkoutHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workoutLog.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.workoutLog.count({ where: { userId } }),
    ]);
    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ─── MEAL LOG ───────────────────────────────────────────────────────────────

  async logMeal(userId: string, dto: LogMealDto) {
    return this.prisma.mealLog.create({
      data: {
        userId,
        date: dto.date ? new Date(dto.date) : new Date(),
        mealType: dto.mealType,
        mealName: dto.mealType,
        foods: dto.foods as any,
        totalCalories: dto.totalCalories,
        proteinG: dto.protein,
        carbsG: dto.carbs,
        fatG: dto.fat,
        notes: dto.notes,
      },
    });
  }

  async getMealHistory(userId: string, date?: string) {
    const where: any = { userId };
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }
    return this.prisma.mealLog.findMany({ where, orderBy: { loggedAt: 'desc' } });
  }

  // ─── AI NUTRITION ANALYSIS ───────────────────────────────────────────────────

  async analyzeMealFromText(userId: string, mealDescription: string) {
    const cacheKey = `fitness:meal-ai:${Buffer.from(mealDescription).toString('base64').slice(0, 40)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const resp = await this.ai.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze the nutritional content of this meal: "${mealDescription}".
Return ONLY JSON (no markdown):
{
  "foods": [{ "name": string, "quantity": string, "calories": number, "protein": number, "carbs": number, "fat": number }],
  "totalCalories": number,
  "totalProtein": number,
  "totalCarbs": number,
  "totalFat": number,
  "healthScore": number (0-10),
  "tips": string[]
}`,
      }],
    });

    const raw = (resp.content[0] as any).text;
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    await this.redis.set(cacheKey, JSON.stringify(result), 3600);
    return result;
  }

  // ─── STATS & DASHBOARD ───────────────────────────────────────────────────────

  async getDashboard(userId: string) {
    const cacheKey = `fitness:dashboard:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [profile, streak, recentWorkouts, weeklyCalories, totalWorkouts] = await Promise.all([
      this.prisma.fitnessProfile.findUnique({ where: { userId } }),
      this.prisma.fitnessStreak.findUnique({ where: { userId } }),
      this.prisma.workoutLog.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: { completedAt: true, durationMinutes: true, caloriesBurned: true, exercises: true },
      }),
      this.getWeeklyCalories(userId),
      this.prisma.workoutLog.count({ where: { userId } }),
    ]);

    const result = { profile, streak, recentWorkouts, weeklyCalories, totalWorkouts };
    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  // ─── BODY METRICS ────────────────────────────────────────────────────────────

  async logBodyMetrics(userId: string, data: { weight?: number; bodyFat?: number; muscleMass?: number; notes?: string }) {
    const log = await this.prisma.bodyMetricLog.create({ data: { userId, ...data } });
    // Update profile with latest weight
    if (data.weight) await this.prisma.fitnessProfile.update({ where: { userId }, data: { weightKg: data.weight } });
    await this.redis.del(`fitness:dashboard:${userId}`);
    return log;
  }

  async getBodyMetricsHistory(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.bodyMetricLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private async updateStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const streak = await this.prisma.fitnessStreak.findUnique({ where: { userId } });

    if (!streak) {
      await this.prisma.fitnessStreak.create({ data: { userId, current: 1, longest: 1, lastWorkout: today } });
      return;
    }

    const lastDate = new Date(streak.lastWorkout);
    lastDate.setHours(0, 0, 0, 0);

    if (lastDate.getTime() === today.getTime()) return; // already logged today
    const isConsecutive = lastDate.getTime() === yesterday.getTime();
    const newCurrent = isConsecutive ? streak.current + 1 : 1;
    const newLongest = Math.max(streak.longest, newCurrent);

    await this.prisma.fitnessStreak.update({
      where: { userId },
      data: { current: newCurrent, longest: newLongest, lastWorkout: today },
    });
  }

  private async getWeeklyCalories(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.workoutLog.findMany({
      where: { userId, completedAt: { gte: since }, caloriesBurned: { not: null } },
      select: { completedAt: true, caloriesBurned: true },
    });
    return logs.reduce((sum, l) => sum + (l.caloriesBurned ?? 0), 0);
  }
}