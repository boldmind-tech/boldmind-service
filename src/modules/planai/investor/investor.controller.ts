import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { InvestorService } from './investor.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/user.decorator';


interface GenerateSAFEDto {
    companyName: string; founderName: string; investorName: string;
    investmentAmountNGN: number; valuationCapNGN?: number; discountRate?: number;
    companyAddress: string; incorporationState: string;
}
interface InvestorUpdateDto {
    companyName: string; period: string; mrrNGN: number; mrrGrowth: number;
    userCount: number; topWins: string[]; challenges: string[]; nextGoals: string[];
}

@Controller('planai/investor')
@UseGuards(JwtAuthGuard)
export class InvestorController {
    constructor(private readonly investorService: InvestorService) { }

    @Post('safe-agreement')
    generateSAFE(@Body() dto: GenerateSAFEDto, @CurrentUser() user: { id: string }) {
        return this.investorService.generateSAFEAgreement(dto, user.id);
    }

    @Post('data-room')
    setupDataRoom(@Body() dto: { companyName: string; industry: string; stage: string }, @CurrentUser() user: { id: string }) {
        return this.investorService.setupDataRoom(dto, user.id);
    }

    @Post('due-diligence-checklist')
    getDueDiligence(@Body() dto: { industry: string; stage: string }) {
        return this.investorService.getDueDiligenceChecklist(dto);
    }

    @Post('investor-update')
    generateInvestorUpdate(@Body() dto: InvestorUpdateDto, @CurrentUser() user: { id: string }) {
        return this.investorService.generateInvestorUpdate(dto, user.id);
    }
}