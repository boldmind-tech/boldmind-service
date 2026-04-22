import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SocialFactoryService } from './social-factory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('Social Factory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('social-factory')
export class SocialFactoryController {
    constructor(private readonly socialService: SocialFactoryService) { }

    @Post('generate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Generate a social media post using AI' })
    generatePost(
        @CurrentUser('id') userId: string,
        @Body() data: { topic: string; platform: string; tone?: string },
    ) {
        return this.socialService.generatePost(userId, data);
    }

    @Post('schedule')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Schedule a social media post' })
    schedulePost(
        @CurrentUser('id') userId: string,
        @Body() data: { content: string; platforms: string[]; scheduledFor: string },
    ) {
        return this.socialService.schedulePost(userId, data);
    }

    @Get('scheduled')
    @ApiOperation({ summary: 'Get all scheduled posts' })
    getScheduledPosts(@CurrentUser('id') userId: string) {
        return this.socialService.getScheduledPosts(userId);
    }
}
