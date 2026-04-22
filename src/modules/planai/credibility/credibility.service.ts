import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { PlanAIJobStatus, PlanAIJobType } from '@prisma/client';

export interface GeneratePortfolioDto {
    name: string; title: string; bio: string; skills: string[];
    experience: Array<{ company: string; role: string; duration: string; achievements: string[] }>;
    education: Array<{ school: string; degree: string; year: string }>;
    projects: Array<{ name: string; description: string; url?: string; imageUrl?: string }>;
    template?: 'modern' | 'minimal' | 'creative';
}
export interface GenerateResumeDto {
    name: string; email: string; phone: string; location: string;
    summary: string; experience: Array<{ company: string; role: string; duration: string; responsibilities: string[] }>;
    education: Array<{ school: string; degree: string; year: string }>;
    skills: string[]; certifications?: string[]; targetRole: string;
}

@Injectable()
export class CredibilityService {
    constructor(private readonly prisma: PrismaService, private readonly aiService: AiService) { }

    async generatePortfolio(dto: GeneratePortfolioDto, userId: string) {
        const aiTagline = await this.aiService.generateJson<{ tagline: string; highlights: string[]; personalBrandSummary: string }>(
            'You are a Nigerian personal branding expert. Return ONLY valid JSON.',
            `Generate portfolio content for: ${dto.name}, ${dto.title}. Bio: ${dto.bio}. Skills: ${dto.skills.join(', ')}.
                        Return { tagline: string, highlights: string[], personalBrandSummary: string }`,
            {
                model: 'gpt-4o', 
                maxTokens: 500,
            }
        );

        const job = await this.prisma.planAIJob.create({
            data: {
                userId, type: PlanAIJobType.CREDIBILITY_HUB, status: PlanAIJobStatus.COMPLETED,
                productSlug: 'credibility-hubs', input: dto as object,
                output: { portfolioData: dto, aiEnhancements: aiTagline.content } as object, completedAt: new Date(),
            },
        });

        return { jobId: job.id, portfolio: { ...dto, ...aiTagline.content } };
    }

    async optimizeLinkedIn(dto: { currentHeadline: string; currentSummary: string; targetRole: string; industry: string }) {
        const response = await this.aiService.generateJson<{
            optimizedHeadline: string; optimizedSummary: string; keywordsAdded: string[];
            atsScore: { before: number; after: number }; actionItems: string[];
        }>(
            'You are a Nigerian LinkedIn optimization expert. Return ONLY valid JSON.',
            `Optimize this LinkedIn profile for Nigerian market:
                        Current Headline: ${dto.currentHeadline}
                        Current Summary: ${dto.currentSummary}
                        Target Role: ${dto.targetRole}
                        Industry: ${dto.industry}
                        Return optimized headline, summary, keywords added, ATS score comparison, action items.`,
            {
                model: 'gpt-4o', 
                maxTokens: 1200,
            }
        );
        return response.content;
    }

    async generateResume(dto: GenerateResumeDto, userId: string) {
        const response = await this.aiService.generateJson<{
            formattedResume: object;
            atsFriendlyText: string;
            improvementSuggestions: string[];
            keywordScore: number;
        }>(
            'You are a Nigerian HR expert and resume writer. Create ATS-optimised resumes. Return ONLY valid JSON.',
            `Create a professional ATS-friendly resume for Nigerian job market:
                        Target Role: ${dto.targetRole}
                        Data: ${JSON.stringify(dto)}
                        Return { formattedResume (structured object), atsFriendlyText (plain text), improvementSuggestions, keywordScore (0-100) }`,
            {
                model: 'gpt-4o', 
                maxTokens: 3000,
            }
        );

        const job = await this.prisma.planAIJob.create({
            data: {
                userId, type: PlanAIJobType.CREDIBILITY_HUB, status: PlanAIJobStatus.COMPLETED,
                productSlug: 'credibility-hubs', input: dto as object,
                output: response.content as object, completedAt: new Date(),
            },
        });

        return { jobId: job.id, resume: response.content };
    }

    async getPublicPortfolio(userId: string) {
        const job = await this.prisma.planAIJob.findFirst({
            where: { userId, type: PlanAIJobType.CREDIBILITY_HUB, status: PlanAIJobStatus.COMPLETED },
            orderBy: { createdAt: 'desc' },
        });
        if (!job) throw new NotFoundException('Portfolio not found');
        return job.output;
    }
}