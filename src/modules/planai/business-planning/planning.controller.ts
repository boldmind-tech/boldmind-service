import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Query,
    DefaultValuePipe,
    ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { PlanningService } from './planning.service';
import { GenerateBusinessPlanDto, GeneratePitchDeckDto } from '../dto/all-planai.dto';

@Controller('planai/planning')
@UseGuards(JwtAuthGuard)
export class PlanningController {
    constructor(private readonly planningService: PlanningService) { }

    @Post('generate')
    generatePlan(
        @Body() dto: GenerateBusinessPlanDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.planningService.generateBusinessPlan(dto, user.id);
    }

    @Post('pitch-deck')
    generatePitchDeck(
        @Body() dto: GeneratePitchDeckDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.planningService.generatePitchDeck(dto, user.id);
    }

    @Get('jobs')
    listJobs(
        @CurrentUser() user: { id: string },
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    ) {
        return this.planningService.listUserJobs(user.id, page);
    }

    @Get('jobs/:id')
    getJob(@Param('id') jobId: string, @CurrentUser() user: { id: string }) {
        return this.planningService.getJob(jobId, user.id);
    }

    @Get('jobs/:id/download')
    downloadJob(@Param('id') jobId: string, @CurrentUser() user: { id: string }) {
        return this.planningService.getJobDownloadUrl(jobId, user.id);
    }

    @Get('templates')
    getTemplates(@Query('industry') industry?: string) {
        return this.planningService.getTemplates(industry);
    }
}