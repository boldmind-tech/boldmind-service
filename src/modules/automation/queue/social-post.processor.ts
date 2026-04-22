// ══════════════════════════════════════════════════════════════════
// FILE: src/modules/automation/queue/social-post.processor.ts
// ══════════════════════════════════════════════════════════════════
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Processor('social-posts')
export class SocialPostProcessor {
  private readonly logger = new Logger(SocialPostProcessor.name);

  constructor(private readonly config: ConfigService) {}

  @Process('post')
  async handleSocialPost(job: Job<{
    userId: string;
    platforms: string[];
    content: string;
    mediaUrls?: string[];
    caption?: string;
    hashtags?: string[];
  }>) {
    const { platforms, content, mediaUrls, caption, hashtags } = job.data;
    this.logger.log(`Processing social post for platforms: ${platforms.join(', ')}`);

    const results: Record<string, any> = {};

    for (const platform of platforms) {
      try {
        results[platform] = await this.postToPlatform(platform, content, mediaUrls, caption, hashtags);
        this.logger.log(`Posted to ${platform} ✓`);
      } catch (err) {
        this.logger.error(`Failed to post to ${platform}:`, err.message);
        results[platform] = { error: err.message };
      }
    }

    return results;
  }

  private async postToPlatform(
    platform: string,
    content: string,
    mediaUrls?: string[],
    caption?: string,
    hashtags?: string[],
  ): Promise<any> {
    const fullCaption = `${caption || content}\n\n${hashtags?.map((h) => `#${h}`).join(' ') || ''}`.trim();

    switch (platform.toLowerCase()) {
      case 'instagram': {
        const igToken = this.config.get<string>('META_PAGE_ACCESS_TOKEN');
        const igId = this.config.get<string>('INSTAGRAM_BUSINESS_ID');
        if (!igToken || !igId) throw new Error('Instagram not configured');

        if (mediaUrls?.[0]) {
          const { data: container } = await axios.post(
            `https://graph.facebook.com/v19.0/${igId}/media`,
            { image_url: mediaUrls[0], caption: fullCaption, access_token: igToken },
          );
          const { data: result } = await axios.post(
            `https://graph.facebook.com/v19.0/${igId}/media_publish`,
            { creation_id: container.id, access_token: igToken },
          );
          return result;
        }
        break;
      }

      case 'facebook': {
        const pageToken = this.config.get<string>('META_PAGE_ACCESS_TOKEN');
        const pageId = this.config.get<string>('FACEBOOK_PAGE_ID');
        if (!pageToken || !pageId) throw new Error('Facebook not configured');

        const { data } = await axios.post(
          `https://graph.facebook.com/v19.0/${pageId}/feed`,
          { message: fullCaption, access_token: pageToken },
        );
        return data;
      }

      case 'twitter':
      case 'x': {
        // Placeholder — requires Twitter API v2 OAuth2
        this.logger.warn('Twitter/X posting not yet configured');
        return { status: 'skipped', reason: 'Twitter API not configured' };
      }

      default:
        this.logger.warn(`Platform ${platform} not yet supported for auto-posting`);
        return { status: 'skipped' };
    }
  }
}