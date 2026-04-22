// ─────────────────────────────────────────────────────────────────────────────
// service/src/modules/content/services/content-ai.service.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// This service is a THIN CONTENT-SPECIFIC WRAPPER around the shared AiService.
// It does NOT re-implement prompt logic — it delegates to AiService which
// already owns generateArticle(), generateNigerianContent(), chat(), etc.
//
// Why this exists:
//   - ContentController needs a provider it can inject directly
//   - Keeps content-specific prompting (journalist persona, AmeboGist brand
//     voice, video queuing) isolated from the generic AI gateway
//   - Makes it easy to add content-module-specific caching or hooks later
// ─────────────────────────────────────────────────────────────────────────────

import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateArticleOptions {
  topic: string;
  style?: 'news' | 'amebo' | 'startup' | 'tech-update';
  language?: 'pidgin' | 'english' | 'yoruba' | 'igbo' | 'hausa';
  /** 'groq' | 'gemini' | 'openai' — maps to AiService forceProvider */
  model?: 'groq' | 'gemini' | 'openai';
  userId?: string;
}

export interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ContentAiService {
  private readonly logger = new Logger(ContentAiService.name);

  constructor(
    private readonly aiService: AiService,
    @InjectQueue('content') private readonly contentQueue: Queue,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // ARTICLE GENERATION
  // Delegates entirely to AiService.generateArticle() which owns the routing,
  // prompt templates, fallback chain, and caching.
  // ──────────────────────────────────────────────────────────────────────────

  async generateArticle(options: GenerateArticleOptions): Promise<GeneratedArticle> {
    const { topic, style = 'amebo', language = 'pidgin', model = 'gemini', userId } = options;

    if (!topic?.trim()) {
      throw new BadRequestException('Topic is required for article generation');
    }

    this.logger.log(
      `Generating ${style} article | lang:${language} | model:${model} | user:${userId ?? 'anon'}`,
    );

    let result: GeneratedArticle;

    try {
      // AiService.generateArticle() handles:
      //  - Provider routing (groq → gemini → openai fallback chain)
      //  - Nigerian language prompting via LANGUAGE_INSTRUCTIONS
      //  - JSON parsing with retry on malformed output
      //  - Redis caching (30 min TTL)
      result = await this.aiService.generateArticle({
        topic,
        style,
        language,
        model,
      });
    } catch (err) {
      this.logger.error(`Article generation failed for topic "${topic}"`, err);
      throw new ServiceUnavailableException(
        'AI article generation is temporarily unavailable. Please try again in a moment.',
      );
    }

    // Validate minimum required fields from AI response
    if (!result?.title || !result?.content) {
      this.logger.error(`AI returned incomplete article for topic "${topic}"`, result);
      throw new BadRequestException(
        'AI returned an incomplete article. Please try with a more specific topic.',
      );
    }

    // Enrich excerpt if AI didn't return one
    if (!result.excerpt) {
      result.excerpt = this.truncateToExcerpt(result.content);
    }

    // Queue async SEO + moderation jobs if we have a userId
    if (userId) {
      await this.queuePostGenerationJobs(topic, result, userId).catch((err) =>
        this.logger.warn(`Post-generation queue failed (non-fatal): ${String(err)}`),
      );
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TRENDING CONTENT SUGGESTIONS
  // Uses AiService.chat() to generate topic suggestions based on what's
  // trending (complements TrendService which fetches external trends).
  // ──────────────────────────────────────────────────────────────────────────

  async suggestTopics(params: {
    category: string;
    language?: 'pidgin' | 'english';
    count?: number;
  }): Promise<string[]> {
    const { category, language = 'english', count = 5 } = params;

    const result = await this.aiService.structuredChat<{ topics: string[] }>(
      `You are an AmeboGist editorial assistant. Suggest trending article topics for Nigerian creators.`,
      `Generate ${count} trending article topic ideas for the "${category}" category.
       Language preference: ${language}.
       Context: Nigerian tech/business/entertainment audience.
       Return JSON: { "topics": ["topic1", "topic2", ...] }`,
      {
        task: 'creative',
        temperature: 0.8,
        cacheTtl: 1800, // 30 min — suggestions stay fresh enough
      },
    );

    return result?.topics ?? [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SEO OPTIMISATION
  // Takes an existing article and returns improved SEO metadata.
  // ──────────────────────────────────────────────────────────────────────────

  async generateSeoMetadata(params: {
    title: string;
    excerpt: string;
    category: string;
  }): Promise<{ seoTitle: string; seoDescription: string; tags: string[] }> {
    return this.aiService.structuredChat<{
      seoTitle: string;
      seoDescription: string;
      tags: string[];
    }>(
      `You are an SEO expert for AmeboGist, a Nigerian news and tech platform.
       Optimise for Nigerian search intent on Google.ng.`,
      `Generate SEO metadata for this article:
       Title: ${params.title}
       Excerpt: ${params.excerpt}
       Category: ${params.category}
       
       Return JSON: { "seoTitle": "max 60 chars", "seoDescription": "max 160 chars", "tags": ["5-8 tags"] }`,
      {
        task: 'json-extraction',
        temperature: 0.3,
        cacheTtl: 86400, // 24 hr — SEO metadata is stable
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CONTENT MODERATION
  // Thin wrapper — delegates to AiService.moderateContent()
  // ──────────────────────────────────────────────────────────────────────────

  async moderateContent(text: string): Promise<{ safe: boolean; category?: string }> {
    return this.aiService.moderateContent(text);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ──────────────────────────────────────────────────────────────────────────

  private truncateToExcerpt(content: string): string {
    // Strip HTML tags for excerpt
    const plain = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return plain.length > 157 ? plain.slice(0, 157) + '...' : plain;
  }

  private async queuePostGenerationJobs(
    topic: string,
    article: GeneratedArticle,
    userId: string,
  ): Promise<void> {
    await Promise.all([
      // SEO metadata generation (async, non-blocking)
      this.contentQueue.add(
        'generate-seo-for-ai-article',
        { title: article.title, excerpt: article.excerpt, userId },
        { delay: 3000, attempts: 2 },
      ),
      // Content safety moderation (async)
      this.contentQueue.add(
        'moderate-content',
        { content: article.content, userId, topic },
        { delay: 1000, attempts: 3 },
      ),
    ]);
  }
}