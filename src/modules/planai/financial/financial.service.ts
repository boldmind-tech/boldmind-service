import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { RedisService } from '../../../database/redis.service';
import {
    GenerateForecastDto,
    GenerateScenarioDto,
    CalculateBreakEvenDto,
} from './dto/financial.dto';
import { PlanAIJobType, PlanAIJobStatus } from '@prisma/client';

const FORECAST_PROMPT = `You are a Nigerian financial analyst specialising in SME cashflow modeling.
Generate a detailed 12-month financial forecast in JSON. Use Naira (NGN) amounts. Account for:
- Nigerian inflation (~30% annual)
- Naira/Dollar FX volatility
- Seasonal demand patterns (e.g., December/January peaks, Ramadan)
- Nigerian public holidays impact
- Bank charges and Paystack fees (1.5% + ₦100)

Return ONLY valid JSON:
{
  "summary": { "totalRevenue": number, "totalExpenses": number, "netProfit": number, "profitMargin": number },
  "months": [
    {
      "month": "Jan 2026",
      "revenue": number,
      "expenses": { "salaries": number, "rent": number, "marketing": number, "operations": number, "other": number, "total": number },
      "grossProfit": number,
      "netProfit": number,
      "cashBalance": number,
      "notes": "string"
    }
  ],
  "keyInsights": ["string"],
  "cashflowWarnings": ["string"],
  "recommendations": ["string"]
}`;

@Injectable()
export class FinancialService {
    private readonly logger = new Logger(FinancialService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly redis: RedisService,
    ) { }

    async generateForecast(dto: GenerateForecastDto, userId: string) {
        const userPrompt = `
Business: ${dto.businessName}
Industry: ${dto.industry}
Current Monthly Revenue: ₦${dto.currentMonthlyRevenue.toLocaleString()}
Expected Monthly Growth: ${dto.expectedGrowthPercent}%
Fixed Monthly Expenses: ₦${dto.fixedExpensesNGN.toLocaleString()}
Variable Cost Percentage: ${dto.variableCostPercent}%
Starting Cash Balance: ₦${dto.startingCashNGN.toLocaleString()}
Revenue Sources: ${dto.revenueSources.join(', ')}
Upcoming Major Expenses: ${dto.upcomingExpenses ?? 'None'}
Business Context: ${dto.context ?? 'Nigerian SME'}

Generate a 12-month financial forecast with monthly cashflow projections.`;

        const response = await this.aiService.generateJson<object>(
            FORECAST_PROMPT,
            userPrompt,
            {
                model: 'gpt-4o',
                maxTokens: 4000,
            },
        );

        const job = await this.prisma.planAIJob.create({
            data: {
                userId,
                type: PlanAIJobType.FINANCIAL_FORECAST,
                status: PlanAIJobStatus.COMPLETED,
                productSlug: 'financial-forecasting',
                input: dto as object,
                output: response.content as object,
                modelUsed: 'gpt-4o',
                completedAt: new Date(),
            },
        });

        return { jobId: job.id, output: response.content };
    }

    async runScenarioAnalysis(dto: GenerateScenarioDto, userId: string) {
        const prompt = `Run best/base/worst case scenario analysis for a Nigerian business.
Base input: ${JSON.stringify(dto)}

Return ONLY valid JSON:
{
  "baseCase": { "year1Revenue": number, "year2Revenue": number, "year3Revenue": number, "assumptions": [] },
  "bestCase": { "year1Revenue": number, "year2Revenue": number, "year3Revenue": number, "assumptions": [] },
  "worstCase": { "year1Revenue": number, "year2Revenue": number, "year3Revenue": number, "assumptions": [] },
  "fxImpact": { "ngnStrengthens": "string", "ngnWeakens": "string" },
  "breakEvenPoint": { "baseCase": number, "bestCase": number, "worstCase": number }
}`;

        const response = await this.aiService.generateJson<object>(
            'You are a Nigerian financial scenario analyst.',
            prompt,
            {
                model: 'gpt-4o',
                maxTokens: 2000,
            },
        );

        return { scenarios: response.content };
    }

    calculateBreakEven(dto: CalculateBreakEvenDto) {
        const { fixedCostsNGN, variableCostPerUnit, pricePerUnit, currentUnits } = dto;

        if (pricePerUnit <= variableCostPerUnit) {
            return { error: 'Price per unit must be greater than variable cost per unit' };
        }

        const contributionMargin = pricePerUnit - variableCostPerUnit;
        const breakEvenUnits = Math.ceil(fixedCostsNGN / contributionMargin);
        const breakEvenRevenueNGN = breakEvenUnits * pricePerUnit;
        const currentRevenue = (currentUnits ?? 0) * pricePerUnit;
        const marginOfSafetyPercent = currentUnits
            ? Math.round(((currentUnits - breakEvenUnits) / currentUnits) * 100)
            : null;
        const monthsToBreakEven =
            currentUnits && currentUnits > 0
                ? Math.ceil(breakEvenUnits / currentUnits)
                : null;

        return {
            breakEvenUnits,
            breakEvenRevenueNGN,
            contributionMarginNGN: contributionMargin,
            contributionMarginPercent: Math.round((contributionMargin / pricePerUnit) * 100),
            currentRevenueNGN: currentRevenue,
            marginOfSafetyPercent,
            monthsToBreakEven,
        };
    }

    async listUserForecasts(userId: string, page: number) {
        const limit = 10;
        const [jobs, total] = await Promise.all([
            this.prisma.planAIJob.findMany({
                where: { userId, type: PlanAIJobType.FINANCIAL_FORECAST },
                select: { id: true, status: true, createdAt: true, completedAt: true, input: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.planAIJob.count({ where: { userId, type: PlanAIJobType.FINANCIAL_FORECAST } }),
        ]);

        return { data: jobs, meta: { total, page, limit } };
    }

    async getForecast(jobId: string, userId: string) {
        const job = await this.prisma.planAIJob.findFirst({ where: { id: jobId, userId } });
        if (!job) throw new NotFoundException('Forecast not found');
        return job;
    }

    async getCurrentExchangeRate() {
        const cacheKey = 'fx:usd_ngn';
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // In production: fetch from CBN API or abokiFX
        // Mock for now — replace with real API call
        const rate = { usdToNgn: 1580, gbpToNgn: 2010, eurToNgn: 1720, source: 'parallel_market', fetchedAt: new Date() };
        await this.redis.setex(cacheKey, 3600, JSON.stringify(rate)); // Cache 1 hour
        return rate;
    }
}