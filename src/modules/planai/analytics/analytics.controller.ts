import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { AnalyticsReportService } from './analytics.service';

@Controller('planai/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsReportService) { }

    @Get('overview')
    getOverview(@CurrentUser() user: { id: string }) {
        return this.analyticsService.getUserOverview(user.id);
    }

    @Post('report')
    generateReport(@Body() dto: { productSlugs: string[]; period: '7d' | '30d' | '90d' }, @CurrentUser() user: { id: string }) {
        return this.analyticsService.generateAnalyticsReport(dto, user.id);
    }

    @Get('revenue')
    getRevenueStats(@CurrentUser() user: { id: string }, @Query('period') period: '7d' | '30d' | '90d' = '30d') {
        return this.analyticsService.getRevenueStats(user.id, period);
    }

    @Get('growth-insights')
    getGrowthInsights(@CurrentUser() user: { id: string }) {
        return this.analyticsService.generateGrowthInsights(user.id);
    }
}
