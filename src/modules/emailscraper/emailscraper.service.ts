import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { IEmailLead, IScrapeJob, ILeadList } from './emailscraper.interface';



interface SearchEmailsDto {
    domain?: string; company?: string; industry?: string;
    location?: string; state?: string; title?: string;
    saveToListId?: string; limit?: number;
}

@Injectable()
export class EmailScraperService {
    private readonly logger = new Logger(EmailScraperService.name);
    private readonly hunterApiKey: string;

    constructor(
        @InjectModel('EmailLead') private readonly emailLeadModel: Model<IEmailLead>,
        @InjectModel('ScrapeJob') private readonly scrapeJobModel: Model<IScrapeJob>,
        @InjectModel('LeadList') private readonly leadListModel: Model<ILeadList>,
        @InjectQueue('emailscraper') private readonly scrapeQueue: Queue,
        private readonly config: ConfigService,
    ) {
        this.hunterApiKey = this.config.getOrThrow<string>('HUNTER_IO_API_KEY');
    }

    async searchEmails(dto: SearchEmailsDto, userId: string) {
        const job = await this.scrapeJobModel.create({
            userId, jobType: 'website', status: 'queued', inputData: dto,
        });

        // If domain provided, use Hunter.io directly
        if (dto.domain) {
            const result = await this.searchByDomainHunter(dto.domain, dto.limit ?? 10);
            const savedLeads = await this.saveLeads(result, userId, dto.saveToListId);

            await this.scrapeJobModel.findByIdAndUpdate(job._id, {
                status: 'completed', totalFound: result.length,
                totalValid: savedLeads.filter((l) => l.confidence && l.confidence >= 70).length,
                totalSaved: savedLeads.length, completedAt: new Date(),
            });

            return { jobId: job._id, leads: savedLeads };
        }

        // Queue background job for directory scraping
        await this.scrapeQueue.add('scrape-directory', { jobId: job._id.toString(), ...dto, userId }, { attempts: 3 });
        return { jobId: job._id, status: 'queued', message: 'Scraping started. Results will be available in your leads list.' };
    }

    async verifyEmail(email: string) {
        const response = await fetch(
            `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${this.hunterApiKey}`
        );

        if (!response.ok) {
            return { email, status: 'unknown', error: 'Verification service unavailable', score: undefined };
        }

        const data = await response.json() as { data: { status: string; score: number; regexp: boolean; gibberish: boolean; disposable: boolean; webmail: boolean; mx_records: boolean; smtp_server: boolean; smtp_check: boolean; accept_all: boolean } };

        return {
            email,
            status: data.data.status,       // valid|invalid|catch_all|webmail|disposable|unknown
            score: data.data.score,          // 0-100
            mxRecords: data.data.mx_records,
            smtpValid: data.data.smtp_check,
            isDisposable: data.data.disposable,
            isWebmail: data.data.webmail,
        };
    }

    async bulkVerify(emails: string[], userId: string) {
        const results = await Promise.allSettled(emails.map((e) => this.verifyEmail(e)));
        const verified = results.map((r, i) => r.status === 'fulfilled' ? r.value : { email: emails[i], status: 'unknown', score: undefined });

        // Update verification status in DB
        await Promise.all(
            verified.map((v) =>
                this.emailLeadModel.updateMany(
                    { userId, email: v.email },
                    { $set: { verificationStatus: v.status === 'valid' ? 'valid' : v.status === 'invalid' ? 'invalid' : 'unknown', verifiedAt: new Date(), confidence: v.score } }
                )
            )
        );

        return { total: emails.length, results: verified };
    }

    async getUserLeads(userId: string, page: number, listId?: string, status?: string) {
        const limit = 50;
        const filter: Record<string, unknown> = { userId };
        if (listId) filter['listId'] = listId;
        if (status) filter['verificationStatus'] = status;

        const [leads, total] = await Promise.all([
            this.emailLeadModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            this.emailLeadModel.countDocuments(filter),
        ]);

        return { data: leads, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    async exportLeads(userId: string, listId: string | undefined, format: 'csv' | 'json') {
        const filter: Record<string, unknown> = { userId };
        if (listId) filter['listId'] = listId;

        const leads = await this.emailLeadModel.find(filter).lean();

        if (format === 'json') return { leads };

        // CSV format
        const headers = ['Email', 'First Name', 'Last Name', 'Title', 'Company', 'Industry', 'Website', 'LinkedIn', 'Phone', 'Location', 'Status', 'Confidence'];
        const rows = leads.map((l) => [
            l.email, l.firstName ?? '', l.lastName ?? '', l.title ?? '', l.company ?? '',
            l.industry ?? '', l.website ?? '', l.linkedinUrl ?? '', l.phone ?? '',
            l.location ?? '', l.verificationStatus, l.confidence ?? '',
        ]);

        const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
        return { csv, filename: `leads-export-${Date.now()}.csv` };
    }

    async createList(name: string, description: string | undefined, userId: string) {
        return this.leadListModel.create({ userId, name, description });
    }

    async getUserLists(userId: string) {
        return this.leadListModel.find({ userId }).sort({ createdAt: -1 }).lean();
    }

    async getUserJobs(userId: string) {
        return this.scrapeJobModel.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
    }

    private async searchByDomainHunter(domain: string, limit: number) {
        const response = await fetch(
            `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=${limit}&api_key=${this.hunterApiKey}`
        );

        if (!response.ok) {
            this.logger.warn(`Hunter.io domain search failed for ${domain}`);
            return [];
        }

        const data = await response.json() as {
            data: {
                emails: Array<{ value: string; type: string; first_name?: string; last_name?: string; position?: string; confidence: number; linkedin_url?: string }>;
                organization: string;
            };
        };

        return data.data.emails.map((e) => ({
            email: e.value,
            firstName: e.first_name,
            lastName: e.last_name,
            fullName: [e.first_name, e.last_name].filter(Boolean).join(' '),
            title: e.position,
            company: data.data.organization,
            website: `https://${domain}`,
            linkedinUrl: e.linkedin_url,
            source: 'website' as const,
            confidence: e.confidence,
            verificationStatus: (e.confidence >= 70 ? 'valid' : 'unknown') as 'valid' | 'unknown',
        }));
    }

    private async saveLeads(leads: Array<Record<string, unknown>>, userId: string, listId?: string) {
        const saved = [];
        for (const lead of leads) {
            try {
                const doc = await this.emailLeadModel.findOneAndUpdate(
                    { userId, email: lead['email'] as string },
                    { $setOnInsert: { ...lead, userId, listId: listId ?? undefined, tags: [] } },
                    { upsert: true, new: true }
                );
                saved.push(doc);
            } catch {
                // Duplicate key — already exists, skip
            }
        }
        return saved;
    }
}

// Re-export type for cross-module use
export { IEmailLead, IScrapeJob, ILeadList };
