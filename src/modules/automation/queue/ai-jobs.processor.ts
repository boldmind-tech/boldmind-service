// ══════════════════════════════════════════════════════════════════
// FILE: src/modules/automation/queue/ai-jobs.processor.ts
// ══════════════════════════════════════════════════════════════════
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as puppeteer from 'puppeteer-core';
import axios from 'axios';

@Processor('ai-jobs')
export class AIJobsProcessor {
  private readonly logger = new Logger(AIJobsProcessor.name);

  @Process('email-scrape')
  async handleEmailScrape(job: Job<{
    userId: string;
    targetUrl?: string;
    linkedinSearchQuery?: string;
    naijaDirectory?: string;
    limit?: number;
  }>) {
    const { targetUrl, limit = 50 } = job.data;
    this.logger.log(`Email scrape job started for user ${job.data.userId}`);

    const emails: string[] = [];

    if (targetUrl) {
      try {
        // Simple email extraction from webpage
        const { data } = await axios.get(targetUrl, { timeout: 10000 });
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const found = data.match(emailRegex) || [];
        emails.push(...found.slice(0, limit));
      } catch (err) {
        this.logger.warn(`Scrape failed for ${targetUrl}:`, err.message);
      }
    }

    // Deduplicate + filter disposable domains
    const disposable = ['mailinator.com', 'tempmail.com', 'guerrillamail.com', 'throwaway.email'];
    const unique = [...new Set(emails)].filter(
      (e) => !disposable.some((d) => e.includes(d)),
    );

    this.logger.log(`Email scrape complete: found ${unique.length} emails`);
    return { emails: unique, count: unique.length };
  }
}