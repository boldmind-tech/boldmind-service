import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { AiService } from "../../ai/ai.service";
import { PlanAIJobStatus, PlanAIJobType } from "@prisma/client";


interface GenerateSAFEDto {
    companyName: string; founderName: string; investorName: string;
    investmentAmountNGN: number; valuationCapNGN?: number; discountRate?: number;
    companyAddress: string; incorporationState: string;
}
interface InvestorUpdateDto {
    companyName: string; period: string; mrrNGN: number; mrrGrowth: number;
    userCount: number; topWins: string[]; challenges: string[]; nextGoals: string[];
}

@Injectable()
export class InvestorService {
    constructor(private readonly prisma: PrismaService, private readonly aiService: AiService) { }

    async generateSAFEAgreement(dto: GenerateSAFEDto, userId: string) {
        const response = await this.aiService.generateJson<{ safeDocument: string; keyTerms: object; warningFlags: string[] }>(
            'You are a Nigerian startup lawyer. Generate SAFE agreements compliant with Nigerian law and SEC Nigeria guidelines. Return ONLY valid JSON.',
            `Generate a SAFE agreement:
Company: ${dto.companyName}, Founder: ${dto.founderName}, Investor: ${dto.investorName}
Investment: ₦${dto.investmentAmountNGN.toLocaleString()}
Valuation Cap: ${dto.valuationCapNGN ? `₦${dto.valuationCapNGN.toLocaleString()}` : 'None'}
Discount Rate: ${dto.discountRate ?? 20}%
Note: Flag any Nigerian SEC compliance issues. Include Lagos State law governing clause.
Return { safeDocument (full text), keyTerms (object summary), warningFlags (array) }`,
            {
                model: 'gpt-4o',
                maxTokens: 4000,
            },
        );

        const job = await this.prisma.planAIJob.create({
            data: {
                userId, type: PlanAIJobType.INVESTOR_DECK, status: PlanAIJobStatus.COMPLETED,
                productSlug: 'investor-readiness', input: dto as object,
                output: response.content as object, completedAt: new Date(),
            },
        });

        return { jobId: job.id, ...response.content };
    }

    async setupDataRoom(dto: { companyName: string; industry: string; stage: string }, userId: string) {
        const checklist = await this.aiService.generateJson<{
            sections: Array<{ name: string; documents: Array<{ name: string; required: boolean; description: string }> }>;
            priorityItems: string[];
        }>(
            'Nigerian startup investment expert. Return ONLY valid JSON.',
            `Generate a data room document checklist for Nigerian ${dto.stage} stage ${dto.industry} startup "${dto.companyName}".
Include CAC documents, FIRS TIN, employee contracts, IP ownership, financial statements.
Return { sections: [{ name, documents: [{ name, required, description }] }], priorityItems }`,
            {
                model: 'gpt-4o',
                maxTokens: 1500,
            },
        );
        return checklist.content;
    }

    async getDueDiligenceChecklist(dto: { industry: string; stage: string }) {
        const response = await this.aiService.generateJson<{
            categories: Array<{ category: string; items: Array<{ item: string; priority: 'high' | 'medium' | 'low'; notes: string }> }>;
        }>(
            'Nigerian VC investor. Return ONLY valid JSON due diligence checklist.',
            `Due diligence checklist for Nigerian ${dto.stage} ${dto.industry} startup. Include Nigerian-specific items (CAC, FIRS, CBN for fintech, NAFDAC for food, etc).`,
            {
                model: 'gpt-4o',
                maxTokens: 2000,
            },
        );
        return response.content;
    }

    async generateInvestorUpdate(dto: InvestorUpdateDto, userId: string) {
        const response = await this.aiService.chat(
            'You are a startup communications expert. Write compelling investor update emails for Nigerian startups.',
            `Write a monthly investor update email for ${dto.companyName}:
Period: ${dto.period}
MRR: ₦${dto.mrrNGN.toLocaleString()} (${dto.mrrGrowth > 0 ? '+' : ''}${dto.mrrGrowth}% MoM)
Users: ${dto.userCount.toLocaleString()}
Top wins: ${dto.topWins.join('; ')}
Challenges: ${dto.challenges.join('; ')}
Next month goals: ${dto.nextGoals.join('; ')}`,
            {
                model: 'gpt-4o',
                maxTokens: 800,
            },
        );
        return { emailBody: response };
    }
}