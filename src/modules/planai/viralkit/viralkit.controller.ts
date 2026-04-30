import {
  Controller, Get, Post, Delete, Body, Query, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { ViralKitService } from './viralkit.service';

@ApiTags('ViralKit')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('planai/viralkit')
export class ViralKitController {
  constructor(private readonly service: ViralKitService) {}

  // ── Content history ────────────────────────────────────────────────────────

  @Get('content')
  @ApiOperation({ summary: 'List generated content for the current user' })
  listContent(
    @CurrentUser('id') userId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listContent(userId, { type, status, page, limit });
  }

  @Delete('content/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a generated content item' })
  deleteContent(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deleteContent(userId, id);
  }

  // ── Image generation ───────────────────────────────────────────────────────

  @Post('generate/image')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate, edit, upscale, or remove background from an image' })
  generateImage(
    @CurrentUser('id') userId: string,
    @Body() dto: {
      action: 'generate' | 'edit' | 'upscale' | 'remove-bg';
      prompt?: string;
      model?: string;
      aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '3:4';
      numImages?: number;
      seed?: number;
      negativePrompt?: string;
      guidanceScale?: number;
      style?: string;
      imageUrl?: string;
      mask?: string;
      strength?: number;
    },
  ) {
    return this.service.generateImage(userId, dto);
  }

  // ── Video generation ───────────────────────────────────────────────────────

  @Post('generate/video')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a video from a prompt (optionally image-to-video)' })
  generateVideo(
    @CurrentUser('id') userId: string,
    @Body() dto: {
      prompt: string;
      model: string;
      aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '3:4';
      duration: number;
      imageUrl?: string;
      negativePrompt?: string;
      seed?: number;
    },
  ) {
    return this.service.generateVideo(userId, dto);
  }
}
