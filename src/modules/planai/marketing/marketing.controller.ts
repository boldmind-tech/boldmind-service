import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { MarketingService } from './marketing.service';
import { CreateEmailCampaignDto } from './dto/create-email-campaign.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Controller('planai/marketing')
@UseGuards(JwtAuthGuard)
export class MarketingController {
    constructor(private readonly marketingService: MarketingService) { }

    @Post('campaign/email')
    createEmailCampaign(@Body() dto: CreateEmailCampaignDto, @CurrentUser() user: { id: string }) {
        return this.marketingService.createEmailCampaign(dto, user.id);
    }

    @Post('campaign/:id/send')
    sendCampaign(@Param('id') id: string, @CurrentUser() user: { id: string }) {
        return this.marketingService.sendCampaign(id, user.id);
    }

    @Post('generate/subject-lines')
    generateSubjectLines(@Body() dto: { topic: string; brand: string; tone?: string }) {
        return this.marketingService.generateSubjectLines(dto);
    }

    @Post('generate/email-copy')
    generateEmailCopy(@Body() dto: { topic: string; cta: string; audience: string; tone?: string }) {
        return this.marketingService.generateEmailCopy(dto);
    }

    @Post('whatsapp/broadcast')
    createWhatsappBroadcast(@Body() dto: CreateBroadcastDto, @CurrentUser() user: { id: string }) {
        return this.marketingService.createWhatsappBroadcast(dto, user.id);
    }

    @Get('analytics/:campaignId')
    getCampaignAnalytics(@Param('campaignId') id: string, @CurrentUser() user: { id: string }) {
        return this.marketingService.getCampaignAnalytics(id, user.id);
    }
}
