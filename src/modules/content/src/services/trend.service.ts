// ─────────────────────────────────────────────────────────────────────────────
// service/src/modules/content/services/trend.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// FIX: Converted from static class to NestJS @Injectable() so it can be
// injected into ContentController via DI. Static class methods cannot be
// injected — they must be instantiated or called directly which bypasses
// NestJS lifecycle management (logging, interceptors, error handling).
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';

export interface TrendAlert {
  title: string;
  platform: 'google' | 'x' | 'news';
  url: string;
  description?: string;
}

@Injectable()
export class TrendService {
  private readonly logger = new Logger(TrendService.name);

  /**
   * ASSUMPTION: This currently returns hardcoded mock data.
   * Production implementation should call SerpAPI / Google Trends API /
   * Twitter v2 API. Wire those API keys via ConfigService when ready.
   */
  async getTrendingTechUpdates(): Promise<TrendAlert[]> {
    this.logger.debug('Fetching trending tech updates');

    // TODO: Replace with real API calls
    // e.g. await this.serpApiService.getGoogleTrends('Nigeria tech')
    return [
      {
        title: 'Gemini 2.5 Pro updates for developers',
        platform: 'google',
        url: 'https://blog.google/technology/ai/',
        description: 'New context window and performance improvements for builders.',
      },
      {
        title: 'Nigeria Startup Act Implementation Updates',
        platform: 'news',
        url: 'https://startup.gov.ng',
        description: 'Latest on registration and tax incentives for tech founders.',
      },
      {
        title: 'Creator Economy Trends 2026',
        platform: 'x',
        url: 'https://twitter.com/search?q=creator+economy',
        description: 'Monetization shifts and how Nigerian creators are pivoting.',
      },
    ];
  }
}