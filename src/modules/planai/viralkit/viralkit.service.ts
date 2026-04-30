import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { FalProvider, GenerateImageOptions, GenerateVideoOptions } from './fal.provider';
import { SubscriptionTier } from '@prisma/client';

// Per-tier limits (null = unlimited)
const TIER_LIMITS: Record<SubscriptionTier, { images: number | null; videos: number | null }> = {
  FREE:       { images: 50,   videos: 10   },
  STARTER:    { images: 200,  videos: 30   },
  PRO:        { images: 1000, videos: 100  },
  AGENCY:     { images: null, videos: null },
  ENTERPRISE: { images: null, videos: null },
};

// Models restricted to certain tiers
const PRO_ONLY_MODELS = ['wan-pro', 'luma-dream-machine'];
const STARTER_PLUS_MODELS = ['kling-video-v2-master'];

@Injectable()
export class ViralKitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fal: FalProvider,
  ) {}

  // ── Content history ────────────────────────────────────────────────────────

  async listContent(userId: string, query: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, status, page = 1, limit = 20 } = query;
    const where: any = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.generatedContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.generatedContent.count({ where }),
    ]);

    return { items, total, page, pageSize: limit, hasMore: page * limit < total };
  }

  async deleteContent(userId: string, id: string) {
    const item = await this.prisma.generatedContent.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Content not found.');
    await this.prisma.generatedContent.delete({ where: { id } });
    return { success: true };
  }

  // ── Image generation ───────────────────────────────────────────────────────

  async generateImage(userId: string, dto: {
    action: 'generate' | 'edit' | 'upscale' | 'remove-bg';
    prompt?: string;
    model?: string;
    aspectRatio?: string;
    numImages?: number;
    seed?: number;
    negativePrompt?: string;
    guidanceScale?: number;
    style?: string;
    imageUrl?: string;
    mask?: string;
    strength?: number;
  }) {
    if (dto.action === 'generate') {
      await this.enforceImageLimit(userId);
    }

    const content = await this.prisma.generatedContent.create({
      data: {
        userId,
        type: dto.action === 'generate' ? 'image' : 'image_edit',
        status: 'generating',
        prompt: dto.prompt ?? 'Image transform',
        model: dto.model ?? 'flux-pro-ultra',
        aspectRatio: dto.aspectRatio ?? '1:1',
      },
    });

    try {
      let result: any;

      switch (dto.action) {
        case 'generate': {
          if (!dto.prompt || !dto.model || !dto.aspectRatio) {
            throw new BadRequestException('prompt, model, and aspectRatio are required for generate');
          }
          result = await this.fal.generateImage(dto as GenerateImageOptions);
          await this.incrementImageUsage(userId);
          break;
        }
        case 'edit': {
          if (!dto.imageUrl || !dto.prompt) {
            throw new BadRequestException('imageUrl and prompt are required for edit');
          }
          result = await this.fal.editImage({
            imageUrl: dto.imageUrl,
            prompt: dto.prompt,
            model: dto.model,
            mask: dto.mask,
            strength: dto.strength,
          });
          break;
        }
        case 'upscale': {
          if (!dto.imageUrl) throw new BadRequestException('imageUrl is required for upscale');
          result = await this.fal.upscaleImage(dto.imageUrl);
          break;
        }
        case 'remove-bg': {
          if (!dto.imageUrl) throw new BadRequestException('imageUrl is required for remove-bg');
          result = await this.fal.removeBackground(dto.imageUrl);
          break;
        }
      }

      const fileUrl = result.imageUrl ?? result.images?.[0]?.url;
      const width = result.images?.[0]?.width;
      const height = result.images?.[0]?.height;

      return this.prisma.generatedContent.update({
        where: { id: content.id },
        data: {
          status: 'ready',
          fileUrl,
          width,
          height,
          falRequestId: result.falRequestId,
          metadata: { allImages: result.images, seed: dto.seed },
        },
      });
    } catch (err) {
      await this.prisma.generatedContent.update({
        where: { id: content.id },
        data: { status: 'failed', metadata: { error: String(err) } },
      });
      throw err;
    }
  }

  // ── Video generation ───────────────────────────────────────────────────────

  async generateVideo(userId: string, dto: GenerateVideoOptions) {
    await this.enforceVideoLimit(userId);
    await this.enforceModelAccess(userId, dto.model);

    const content = await this.prisma.generatedContent.create({
      data: {
        userId,
        type: 'video',
        status: 'generating',
        prompt: dto.prompt,
        model: dto.model,
        aspectRatio: dto.aspectRatio,
        metadata: {
          duration: dto.duration,
          imageUrl: dto.imageUrl,
          negativePrompt: dto.negativePrompt,
          seed: dto.seed,
        },
      },
    });

    await this.incrementVideoUsage(userId);

    try {
      const result = await this.fal.generateVideo(dto);

      return this.prisma.generatedContent.update({
        where: { id: content.id },
        data: { status: 'ready', fileUrl: result.fileUrl, falRequestId: result.falRequestId },
      });
    } catch (err) {
      await this.decrementVideoUsage(userId);
      await this.prisma.generatedContent.update({
        where: { id: content.id },
        data: { status: 'failed', metadata: { error: String(err) } },
      });
      throw err;
    }
  }

  // ── Limit helpers ──────────────────────────────────────────────────────────

  private async getUserTier(userId: string): Promise<SubscriptionTier> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, productSlug: 'viralkit', status: { in: ['ACTIVE', 'TRIAL'] as any } },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    return (sub?.tier ?? SubscriptionTier.FREE) as SubscriptionTier;
  }

  private async getCurrentUsage(userId: string) {
    return this.prisma.usageRecord.findFirst({
      where: { userId, productSlug: 'viralkit', periodEnd: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async enforceImageLimit(userId: string) {
    const tier = await this.getUserTier(userId);
    const limit = TIER_LIMITS[tier].images;
    if (limit === null) return;

    const usage = await this.getCurrentUsage(userId);
    const used = usage?.imagesUsed ?? 0;
    if (used >= limit) {
      throw new BadRequestException(
        `You've used all ${limit} images for this period. Upgrade to generate more.`,
      );
    }
  }

  private async enforceVideoLimit(userId: string) {
    const tier = await this.getUserTier(userId);
    const limit = TIER_LIMITS[tier].videos;
    if (limit === null) return;

    const usage = await this.getCurrentUsage(userId);
    const used = usage?.videosUsed ?? 0;
    if (used >= limit) {
      throw new BadRequestException(
        `You've used all ${limit} videos for this period. Upgrade to generate more.`,
      );
    }
  }

  private async enforceModelAccess(userId: string, model: string) {
    const tier = await this.getUserTier(userId);
    if (PRO_ONLY_MODELS.includes(model) && !['PRO', 'AGENCY', 'ENTERPRISE'].includes(tier)) {
      throw new BadRequestException(`${model} requires a Pro plan or higher.`);
    }
    if (STARTER_PLUS_MODELS.includes(model) && tier === 'FREE') {
      throw new BadRequestException(`${model} requires a Starter plan or higher.`);
    }
  }

  private async incrementImageUsage(userId: string) {
    const usage = await this.getCurrentUsage(userId);
    if (usage) {
      await this.prisma.usageRecord.update({
        where: { id: usage.id },
        data: { imagesUsed: { increment: 1 } },
      });
    }
  }

  private async incrementVideoUsage(userId: string) {
    const usage = await this.getCurrentUsage(userId);
    if (usage) {
      await this.prisma.usageRecord.update({
        where: { id: usage.id },
        data: { videosUsed: { increment: 1 } },
      });
    }
  }

  private async decrementVideoUsage(userId: string) {
    const usage = await this.getCurrentUsage(userId);
    if (usage && usage.videosUsed > 0) {
      await this.prisma.usageRecord.update({
        where: { id: usage.id },
        data: { videosUsed: { decrement: 1 } },
      });
    }
  }
}
