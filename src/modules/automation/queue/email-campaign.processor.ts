
// ══════════════════════════════════════════════════════════════════
// FILE: src/modules/automation/queue/email-campaign.processor.ts
// ══════════════════════════════════════════════════════════════════
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Processor('email-campaigns')
export class EmailCampaignProcessor {
  private readonly logger = new Logger(EmailCampaignProcessor.name);
  private readonly resend: Resend;
  private readonly FROM_EMAIL: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.FROM_EMAIL = config.get<string>('FROM_EMAIL', 'hello@boldmind.ng');
  }

  @Process('send-batch')
  async handleEmailBatch(job: Job<{
    userId: string;
    subject: string;
    htmlBody: string;
    recipients: string[];
  }>) {
    const { subject, htmlBody, recipients } = job.data;
    this.logger.log(`Sending email batch: ${recipients.length} recipients`);

    let sent = 0;
    let failed = 0;

    for (const email of recipients) {
      try {
        await this.resend.emails.send({
          from: `BoldMind <${this.FROM_EMAIL}>`,
          to: email,
          subject,
          html: htmlBody,
        });
        sent++;
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        this.logger.warn(`Email failed to ${email}:`, err.message);
        failed++;
      }
    }

    this.logger.log(`Batch complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  @Process('expiry-reminder')
  async handleExpiryReminder(job: Job<{
    email: string;
    name: string;
    productSlug: string;
    expiresAt: Date;
  }>) {
    const { email, name, productSlug, expiresAt } = job.data;
    const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);

    await this.resend.emails.send({
      from: `BoldMind <${this.FROM_EMAIL}>`,
      to: email,
      subject: `⚠️ Your ${productSlug} subscription expires in ${daysLeft} days`,
      html: `
        <h2>Hi ${name},</h2>
        <p>Your <strong>${productSlug}</strong> subscription expires in <strong>${daysLeft} days</strong>.</p>
        <p>Renew now to keep your access without interruption.</p>
        <p>
          <a href="https://boldmind.ng/dashboard/subscriptions" 
             style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
            Renew Subscription →
          </a>
        </p>
        <p style="color:#6B7280;font-size:14px;">The BoldMind Team</p>
      `,
    });
  }
}