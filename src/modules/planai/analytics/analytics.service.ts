// src/modules/planai/analytics/analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { PlanAIJobType, PlanAIJobStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class AnalyticsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async getUserOverview(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [payments, subscriptions, storeRevenue, jobs] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { userId, status: PaymentStatus.SUCCESS, paidAt: { gte: thirtyDaysAgo } },
        _sum: { amountNGN: true },
        _count: true,
      }),
      this.prisma.subscription.findMany({
        where: { userId, status: { in: ['ACTIVE', 'TRIAL'] } },
        select: { productSlug: true, tier: true, currentPeriodEnd: true },
      }),
      this.prisma.store.findMany({
        where: { userId },
        select: { name: true, totalRevenue: true, totalOrders: true },
      }),
      this.prisma.planAIJob.count({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return {
      last30Days: {
        paymentsNGN: (payments._sum.amountNGN ?? 0) / 100,
        paymentCount: payments._count,
        aiJobsRun: jobs,
      },
      activeSubscriptions: subscriptions,
      stores: storeRevenue,
    };
  }

  async getRevenueStats(userId: string, period: '7d' | '30d' | '90d') {
    // FIX: groupBy circular type reference — explicit typing + cast avoids it.
    // The `as any` on the argument is intentional; the Prisma groupBy having()
    // clause generates a recursive mapped type that TypeScript can't resolve.
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await (this.prisma.payment.groupBy as any)({
      by: ['productSlug'],
      where: { userId, status: PaymentStatus.SUCCESS, paidAt: { gte: since } },
      _sum: { amountNGN: true },
      _count: true,
    }) as Array<{ productSlug: string; _sum: { amountNGN: number | null }; _count: number }>;

    return rows.map((p) => ({
      productSlug: p.productSlug,
      revenueNGN: (p._sum.amountNGN ?? 0) / 100,
      transactions: p._count,
    }));
  }

  async generateAnalyticsReport(
    dto: { productSlugs: string[]; period: string },
    userId: string,
  ) {
    const stats = await this.getRevenueStats(userId, dto.period as '30d');

    // FIX: AiService.chat() does NOT accept { model } — use { task, forceProvider }
    const insight = await this.ai.chat(
      'You are a Nigerian business analytics expert. Provide actionable insights from business revenue data.',
      `Analyze this Nigerian business revenue data:
Products analyzed: ${dto.productSlugs.join(', ')}
Period: ${dto.period}
Revenue breakdown: ${JSON.stringify(stats)}

Provide: top 3 growth opportunities, 2 risks to watch, 3 recommended actions.
Be specific to the Nigerian market context (Naira, local platforms, CBN policies).`,
      {
        task: 'reasoning',          // routes to Groq 70B → Gemini → OpenAI
        forceProvider: 'groq',      // override to groq for speed; remove to use routing
        maxTokens: 1200,
        cacheTtl: 3600,
      },
    );

    const job = await this.prisma.planAIJob.create({
      data: {
        userId,
        type: PlanAIJobType.ANALYTICS_REPORT,
        status: PlanAIJobStatus.COMPLETED,
        productSlug: 'analytics-dashboard',
        input: dto as unknown as object,
        output: { stats, insights: insight.content } as unknown as object,
        modelUsed: insight.model,
        completedAt: new Date(),
      },
    });

    return { jobId: job.id, stats, insights: insight.content, provider: insight.provider };
  }

  async generateGrowthInsights(userId: string) {
    const overview = await this.getUserOverview(userId);

    const response = await this.ai.chat(
      'You are a Nigerian business growth expert. Give specific, actionable growth advice for Nigerian SMEs.',
      `My business overview: ${JSON.stringify(overview)}

What are my top 5 growth actions for the next 30 days?
Consider: Nigerian market realities, Paystack, WhatsApp Business, power infrastructure, FX volatility.`,
      {
        task: 'reasoning',
        maxTokens: 900,
        cacheTtl: 1800,
      },
    );

    return { insights: response.content, provider: response.provider };
  }
}