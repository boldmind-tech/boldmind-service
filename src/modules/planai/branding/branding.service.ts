import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import {
    GenerateLogoDto,
    GenerateBrandKitDto,
    GenerateFlyerDto,
    GenerateColorPaletteDto,
} from '../dto/all-planai.dto';
import { PlanAIJobType, PlanAIJobStatus } from '@prisma/client';

@Injectable()
export class BrandingService {
    private readonly logger = new Logger(BrandingService.name);
    private readonly falApiKey: string;
    private readonly cfAccountId: string;
    private readonly cfApiToken: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly config: ConfigService,
    ) {
        this.falApiKey = this.config.getOrThrow<string>('FAL_API_KEY');
        this.cfAccountId = this.config.getOrThrow<string>('CF_ACCOUNT_ID');
        this.cfApiToken = this.config.getOrThrow<string>('CF_WORKERS_AI_TOKEN');
    }

    async generateLogo(dto: GenerateLogoDto, userId: string) {
        const prompt = this.buildLogoPrompt(dto);

        const job = await this.prisma.planAIJob.create({
            data: {
                userId,
                type: PlanAIJobType.BRANDING_PACKAGE,
                status: PlanAIJobStatus.PROCESSING,
                productSlug: 'branding-design',
                input: dto as object,
                startedAt: new Date(),
            },
        });

        try {
            // Use fal.ai FLUX model for logo generation
            const imageUrls = await this.generateImagesWithFal({
                prompt,
                numImages: 4,
                imageSize: '1024x1024',
                model: 'fal-ai/flux/dev',
            });

            await this.prisma.planAIJob.update({
                where: { id: job.id },
                data: {
                    status: PlanAIJobStatus.COMPLETED,
                    output: { imageUrls, prompt } as object,
                    modelUsed: 'fal-ai/flux/dev',
                    completedAt: new Date(),
                },
            });

            return { jobId: job.id, status: 'completed', imageUrls };
        } catch (error) {
            await this.prisma.planAIJob.update({
                where: { id: job.id },
                data: {
                    status: PlanAIJobStatus.FAILED,
                    errorMessage: error instanceof Error ? error.message : 'fal.ai error',
                },
            });
            throw error;
        }
    }

    async generateBrandKit(dto: GenerateBrandKitDto, userId: string) {
        // Step 1: Generate brand identity via GPT-4o
        const brandIdentity = await this.aiService.generateJson<{
            colors: { primary: string; secondary: string; accent: string; neutral: string; background: string };
            fonts: { heading: string; body: string; accent: string };
            personality: string[];
            tagline: string;
            voiceTone: string;
            usageGuidelines: string;
        }>(
            `You are a Nigerian brand strategist. Generate a cohesive brand identity for a Nigerian business.
Return ONLY valid JSON with: colors (hex codes), fonts (Google Fonts names), personality traits, tagline, voice tone, usage guidelines.`,
            `Business: ${dto.businessName}
Industry: ${dto.industry}
Target Audience: ${dto.targetAudience}
Brand Values: ${dto.brandValues.join(', ')}
Preferred Style: ${dto.style ?? 'modern, professional'}
Inspiration: ${dto.inspiration ?? 'None'}`,
            {
                model: 'gpt-4o',
                maxTokens: 1500,
            },
        );

        // Step 2: Generate logo using brand colors
        const logoPrompt = `${dto.businessName} company logo, ${brandIdentity.content?.personality?.join(', ')}, 
flat vector design, ${brandIdentity.content?.colors?.primary} primary color, clean minimal professional logo, 
white background, Nigerian business`;

        const logoUrls = await this.generateImagesWithFal({
            prompt: logoPrompt,
            numImages: 3,
            imageSize: '1024x1024',
            model: 'fal-ai/flux/dev',
        });

        const job = await this.prisma.planAIJob.create({
            data: {
                userId,
                type: PlanAIJobType.BRANDING_PACKAGE,
                status: PlanAIJobStatus.COMPLETED,
                productSlug: 'branding-design',
                input: dto as object,
                output: { brandIdentity: brandIdentity.content, logoUrls } as object,
                modelUsed: 'gpt-4o + fal-ai/flux/dev',
                completedAt: new Date(),
            },
        });

        return {
            jobId: job.id,
            brandIdentity: brandIdentity.content,
            logoUrls,
        };
    }

    async generateMarketingFlyer(dto: GenerateFlyerDto, userId: string) {
        // WhatsApp-optimised flyer: 1080x1080
        const prompt = `Professional marketing flyer for Nigerian business.
Business: ${dto.businessName}
Offer: ${dto.offerText}
Call to Action: ${dto.callToAction}
Contact: ${dto.contact ?? 'WhatsApp: +234...'}
Style: ${dto.style ?? 'vibrant, Nigerian market, professional'}
Colors: ${dto.colors ?? 'green and white (Nigerian flag inspired)'}
Include Nigerian cultural elements if appropriate.
Square format, bold text, eye-catching design optimised for WhatsApp sharing.`;

        const imageUrls = await this.generateImagesWithFal({
            prompt,
            numImages: 2,
            imageSize: '1024x1024',
            model: 'fal-ai/flux/dev',
        });

        return { imageUrls };
    }

    async generateColorPalette(dto: GenerateColorPaletteDto) {
        const response = await this.aiService.generateJson<{
            palettes: Array<{
                name: string;
                colors: { primary: string; secondary: string; accent: string; neutral: string; background: string; text: string };
                mood: string;
                bestFor: string;
            }>;
        }>(
            'You are a color theory expert. Generate brand color palettes. Return ONLY valid JSON.',
            `Generate 3 color palette options for: ${dto.industry} business targeting ${dto.targetAudience}.
Mood desired: ${dto.mood ?? 'professional and trustworthy'}.
Include Nigerian/African aesthetic sensibility where relevant.`,
            {
                model: 'gpt-4o',
                maxTokens: 1000,
            },
        );

        return response.content;
    }

    async listUserJobs(userId: string) {
        return this.prisma.planAIJob.findMany({
            where: { userId, type: PlanAIJobType.BRANDING_PACKAGE },
            select: { id: true, status: true, output: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }

    // ──────────────────────────────────────────
    // PRIVATE: fal.ai integration
    // ──────────────────────────────────────────

    private async generateImagesWithFal(params: {
        prompt: string;
        numImages: number;
        imageSize: string;
        model: string;
    }): Promise<string[]> {
        const response = await fetch(`https://fal.run/${params.model}`, {
            method: 'POST',
            headers: {
                Authorization: `Key ${this.falApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: params.prompt,
                num_images: params.numImages,
                image_size: params.imageSize,
                enable_safety_checker: true,
                output_format: 'jpeg',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`fal.ai error: ${response.status} — ${error}`);
        }

        const data = await response.json() as { images: Array<{ url: string }> };
        return data.images.map((img) => img.url);
    }

    private buildLogoPrompt(dto: GenerateLogoDto): string {
        const styleMap: Record<string, string> = {
            modern: 'modern minimalist flat design',
            traditional: 'classic traditional professional',
            playful: 'fun vibrant playful colorful',
            luxury: 'luxury premium elegant sophisticated',
        };

        return `${dto.businessName} company logo, ${styleMap[dto.style] ?? 'modern professional'}, 
${dto.industry} industry, ${dto.colors?.join(' and ') ?? 'blue and white'} colors, 
vector style, white background, no text except business name, 
clean professional Nigerian business logo design`;
    }
}
