
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { RedisService } from '../../../database/redis.service';
import { GenerateBusinessPlanDto, GeneratePitchDeckDto } from '../dto/all-planai.dto';
import { PlanAIJobType, PlanAIJobStatus } from '@prisma/client';

const BUSINESS_PLAN_PROMPT = `You are a Nigerian business strategy expert with deep knowledge of the Lagos, Abuja, and Port Harcourt business ecosystems. 
Generate a professional, bank-ready Nigerian business plan in the following JSON structure. Use real Nigerian market data, naira figures, and local context.

Return ONLY valid JSON matching this schema:
{
  "executiveSummary": "string",
  "companyDescription": {
    "mission": "string",
    "vision": "string", 
    "legalStructure": "string",
    "location": "string",
    "foundingDate": "string"
  },
  "productsServices": [{ "name": "string", "description": "string", "priceNGN": number }],
  "marketAnalysis": {
    "targetMarket": "string",
    "marketSizeNGN": number,
    "competitorAnalysis": [{ "name": "string", "strengths": "string", "weaknesses": "string" }],
    "swot": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] }
  },
  "marketingStrategy": {
    "channels": [],
    "acquisitionCost": number,
    "retentionStrategy": "string"
  },
  "operationsPlan": "string",
  "managementTeam": [{ "name": "string", "role": "string", "background": "string" }],
  "financialProjections": {
    "year1Revenue": number,
    "year2Revenue": number, 
    "year3Revenue": number,
    "startupCostNGN": number,
    "breakEvenMonths": number,
    "fundingRequired": number
  },
  "riskAnalysis": [{ "risk": "string", "mitigation": "string" }],
  "appendix": "string"
}`;

@Injectable()
export class PlanningService {
    private readonly logger = new Logger(PlanningService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly redis: RedisService,
    ) { }

    async generateBusinessPlan(dto: GenerateBusinessPlanDto, userId: string) {
        // Check user subscription / credit
        await this.assertCanGenerate(userId, 'business-planning');

        const job = await this.prisma.planAIJob.create({
            data: {
                userId,
                type: PlanAIJobType.BUSINESS_PLAN,
                status: PlanAIJobStatus.QUEUED,
                productSlug: 'business-planning',
                input: dto as object,
            },
        });

        // Process synchronously for MVP (move to queue for production scale)
        try {
            await this.prisma.planAIJob.update({
                where: { id: job.id },
                data: { status: PlanAIJobStatus.PROCESSING, startedAt: new Date() },
            });

            const startMs = Date.now();

            const userPrompt = `
                        Business Name: ${dto.businessName}
                        Industry: ${dto.industry}
                        Location: ${dto.location ?? 'Lagos, Nigeria'}
                        Business Description: ${dto.description}
                        Target Customers: ${dto.targetCustomers}
                        Products/Services: ${dto.productsServices}
                        Initial Capital Available: ₦${dto.initialCapitalNGN?.toLocaleString() ?? 'Not specified'}
                        Funding Needed: ${dto.fundingNeeded ? `₦${dto.fundingNeeded.toLocaleString()}` : 'No external funding needed'}
                        Additional Context: ${dto.additionalContext ?? 'None'}

                        Generate a comprehensive Nigerian business plan for this business.`;

            const response = await this.aiService.generateJson<object>(
                BUSINESS_PLAN_PROMPT,
                userPrompt,
                {
                    model: 'gpt-4o',
                    maxTokens: 4000,
                }
            );

            const processingMs = Date.now() - startMs;

            // Generate PDF via queue job (async)
            const updatedJob = await this.prisma.planAIJob.update({
                where: { id: job.id },
                data: {
                    status: PlanAIJobStatus.COMPLETED,
                    output: response.content as object,
                    modelUsed: 'gpt-4o',
                    promptTokens: response.tokens || 0,
                    completionTokens: 0,
                    processingMs,
                    completedAt: new Date(),
                },
            });

            // Track activity
            await this.prisma.activityLog.create({
                data: {
                    userId,
                    action: 'business_plan_generated',
                    resource: `planai_job:${job.id}`,
                    productSlug: 'business-planning',
                    metadata: { industry: dto.industry, processingMs },
                },
            });

            return { jobId: updatedJob.id, status: 'completed', output: response.content };
        } catch (error) {
            this.logger.error(`Business plan generation failed for job ${job.id}`, error);

            await this.prisma.planAIJob.update({
                where: { id: job.id },
                data: {
                    status: PlanAIJobStatus.FAILED,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
            });

            throw error;
        }
    }

    async generatePitchDeck(dto: GeneratePitchDeckDto, userId: string) {
        await this.assertCanGenerate(userId, 'business-planning');

        const prompt = `Create a 10-slide Nigerian startup pitch deck outline in JSON.
                        Return ONLY valid JSON:
                        {
                            "slides": [
                                { "slideNumber": 1, "title": "Problem", "content": "string", "speakerNotes": "string", "keyMetric": "string" },
                                ...
                            ],
                            "totalFunding": number,
                            "valuation": number,
                            "useOfFunds": [{ "category": "string", "percentageNGN": number, "description": "string" }]
                        }

                        Business: ${dto.businessName}
                        Industry: ${dto.industry}
                        Problem solved: ${dto.problemStatement}
                        Solution: ${dto.solution}
                        Traction: ${dto.traction ?? 'Pre-launch'}
                        Funding ask: ₦${dto.fundingAskNGN?.toLocaleString() ?? 'TBD'}
                        Team: ${dto.teamBackground}`;

        const response = await this.aiService.generateJson<object>(
            'You are a Nigerian startup investor and pitch deck expert.',
            prompt,
            {
                model: 'gpt-4o',
                maxTokens: 3000,
            }
        );

        const job = await this.prisma.planAIJob.create({
            data: {
                userId,
                type: PlanAIJobType.PITCH_DECK,
                status: PlanAIJobStatus.COMPLETED,
                productSlug: 'business-planning',
                input: dto as object,
                output: response.content as object,
                modelUsed: 'gpt-4o',
                completedAt: new Date(),
            },
        });

        return { jobId: job.id, status: 'completed', output: response.content };
    }

    async listUserJobs(userId: string, page: number) {
        const limit = 10;
        const skip = (page - 1) * limit;

        const [jobs, total] = await Promise.all([
            this.prisma.planAIJob.findMany({
                where: { userId, type: { in: [PlanAIJobType.BUSINESS_PLAN, PlanAIJobType.PITCH_DECK] } },
                select: { id: true, type: true, status: true, productSlug: true, createdAt: true, completedAt: true, outputFileUrl: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.planAIJob.count({
                where: { userId, type: { in: [PlanAIJobType.BUSINESS_PLAN, PlanAIJobType.PITCH_DECK] } },
            }),
        ]);

        return { data: jobs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    async getJob(jobId: string, userId: string) {
        const job = await this.prisma.planAIJob.findFirst({ where: { id: jobId, userId } });
        if (!job) throw new NotFoundException('Job not found');
        return job;
    }

    async getJobDownloadUrl(jobId: string, userId: string) {
        const job = await this.getJob(jobId, userId);
        if (!job.outputFileUrl) throw new BadRequestException('PDF not yet generated for this job');
        return { url: job.outputFileUrl };
    }

    async getTemplates(industry?: string) {
        return this.prisma.planAITemplate.findMany({
            where: {
                type: PlanAIJobType.BUSINESS_PLAN,
                isPublic: true,
                ...(industry ? { tags: { has: industry.toLowerCase() } } : {}),
            },
            select: { id: true, name: true, description: true, tags: true, useCount: true },
            orderBy: { useCount: 'desc' },
            take: 20,
        });
    }

    private async assertCanGenerate(userId: string, productSlug: string): Promise<void> {
        const sub = await this.prisma.subscription.findFirst({
            where: { userId, productSlug, status: { in: ['ACTIVE', 'TRIAL'] } },
        });

        // Free tier: check monthly job count
        if (!sub) {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const monthlyCount = await this.prisma.planAIJob.count({
                where: { userId, productSlug, createdAt: { gte: monthStart } },
            });

            if (monthlyCount >= 1) {
                throw new ForbiddenException('Free tier allows 1 plan/month. Upgrade to Pro for unlimited access.');
            }
        }
    }
}