import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { AiService } from '../../ai/ai.service';
import { Resend } from 'resend';
import { PlanAIJobType, PlanAIJobStatus } from '@prisma/client';
import { CreateEmailCampaignDto } from './dto/create-email-campaign.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Injectable()
export class MarketingService {
    private readonly resend: Resend;

    constructor(private readonly prisma: PrismaService, private readonly aiService: AiService, private readonly config: ConfigService) {
        this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
    }

    async createEmailCampaign(dto: CreateEmailCampaignDto, userId: string) {
        return this.prisma.planAIJob.create({
            data: {
                userId, type: PlanAIJobType.MARKETING_CAMPAIGN, status: PlanAIJobStatus.QUEUED,
                productSlug: 'marketing-automation',
                input: { ...dto, scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null } as object,
            },
        });
    }

    async sendCampaign(jobId: string, userId: string) {
        const job = await this.prisma.planAIJob.findFirst({ where: { id: jobId, userId } });
        if (!job) throw new NotFoundException('Campaign not found');

        const input = job.input as unknown as CreateEmailCampaignDto;

        // Send via Resend in batches of 50
        const batches = this.chunk(input.recipientEmails, 50);
        let sent = 0;

        for (const batch of batches) {
            await Promise.all(
                batch.map((email) =>
                    this.resend.emails.send({
                        from: `BoldMind <noreply@boldmind.ng>`,
                        to: email,
                        subject: input.subject,
                        html: input.bodyHtml,
                    })
                )
            );
            sent += batch.length;
        }

        await this.prisma.planAIJob.update({
            where: { id: jobId },
            data: { status: PlanAIJobStatus.COMPLETED, output: { sentCount: sent, sentAt: new Date() } as object, completedAt: new Date() },
        });

        return { sent, total: input.recipientEmails.length };
    }

    async generateSubjectLines(dto: { topic: string; brand: string; tone?: string }) {
        const response = await this.aiService.generateJson<{ subjectLines: Array<{ line: string; type: string; predictedOpenRate: string }> }>(
            'You are a Nigerian email marketing expert. Generate compelling email subject lines for Nigerian audiences. Return ONLY valid JSON.',
            `Generate 5 email subject lines for: Topic: ${dto.topic}, Brand: ${dto.brand}, Tone: ${dto.tone ?? 'professional but warm'}.
Include Nigerian cultural references where appropriate (e.g., "Omo!", "No dulling", local phrases).
Return { subjectLines: [{ line: string, type: "curiosity|urgency|value|social_proof|question", predictedOpenRate: "low|medium|high" }] }`,
            {
                model: 'gpt-4o',
                maxTokens: 800,
            },
        );
        return response.content;
    }

    async generateEmailCopy(dto: { topic: string; cta: string; audience: string; tone?: string }) {
        const response = await this.aiService.generateJson<{ subject: string; preheader: string; bodyHtml: string; bodyText: string }>(
            'You are a Nigerian copywriter. Write compelling email copy for Nigerian audiences. Return ONLY valid JSON.',
            `Write a marketing email:
Topic: ${dto.topic}
CTA: ${dto.cta}
Target Audience: ${dto.audience}
Tone: ${dto.tone ?? 'friendly, professional'}
Return { subject, preheader, bodyHtml (full HTML email), bodyText (plain text version) }`,
            {
                model: 'gpt-4o',
                maxTokens: 2000,
            },
        );
        return response.content;
    }

    async createWhatsappBroadcast(dto: CreateBroadcastDto, userId: string) {
        // Queue for WhatsApp Business API sending via BullMQ
        const job = await this.prisma.planAIJob.create({
            data: {
                userId, type: PlanAIJobType.MARKETING_CAMPAIGN, status: PlanAIJobStatus.QUEUED,
                productSlug: 'marketing-automation', input: dto as object,
            },
        });
        return { jobId: job.id, scheduledCount: dto.recipientNumbers.length };
    }

    async getCampaignAnalytics(jobId: string, userId: string) {
        const job = await this.prisma.planAIJob.findFirst({ where: { id: jobId, userId } });
        if (!job) throw new NotFoundException('Campaign not found');
        return { campaign: job, analytics: job.output };
    }

    private chunk<T>(arr: T[], size: number): T[][] {
        return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
    }
}