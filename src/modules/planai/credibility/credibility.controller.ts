import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { CredibilityService } from './credibility.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { GeneratePortfolioDto, GenerateResumeDto } from './credibility.service';


@Controller('planai/credibility')
@UseGuards(JwtAuthGuard)
export class CredibilityController {
    constructor(private readonly credibilityService: CredibilityService) { }

    @Post('portfolio')
    generatePortfolio(@Body() dto: GeneratePortfolioDto, @CurrentUser() user: { id: string }) {
        return this.credibilityService.generatePortfolio(dto, user.id);
    }

    @Post('linkedin-optimize')
    optimizeLinkedIn(@Body() dto: { currentHeadline: string; currentSummary: string; targetRole: string; industry: string }) {
        return this.credibilityService.optimizeLinkedIn(dto);
    }

    @Post('resume')
    generateResume(@Body() dto: GenerateResumeDto, @CurrentUser() user: { id: string }) {
        return this.credibilityService.generateResume(dto, user.id);
    }

    @Get('portfolio/:userId')
    getPublicPortfolio(@Param('userId') userId: string) {
        return this.credibilityService.getPublicPortfolio(userId);
    }
}

