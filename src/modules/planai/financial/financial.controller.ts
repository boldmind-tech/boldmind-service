

// ─────────────────────────────────────────────────────────────────────────────
// service/src/modules/planai/financial/financial.controller.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UseGuards,
    Query,
    DefaultValuePipe,
    ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { FinancialService } from './financial.service';
import {
    GenerateForecastDto,
    GenerateScenarioDto,
    CalculateBreakEvenDto,
} from './dto/financial.dto';

@Controller('planai/finance')
@UseGuards(JwtAuthGuard)
export class FinancialController {
    constructor(private readonly financialService: FinancialService) { }

    @Post('forecast')
    generateForecast(
        @Body() dto: GenerateForecastDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.financialService.generateForecast(dto, user.id);
    }

    @Post('scenario')
    runScenario(
        @Body() dto: GenerateScenarioDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.financialService.runScenarioAnalysis(dto, user.id);
    }

    @Post('break-even')
    calculateBreakEven(@Body() dto: CalculateBreakEvenDto) {
        return this.financialService.calculateBreakEven(dto);
    }

    @Get('forecasts')
    listForecasts(
        @CurrentUser() user: { id: string },
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    ) {
        return this.financialService.listUserForecasts(user.id, page);
    }

    @Get('forecasts/:id')
    getForecast(@Param('id') id: string, @CurrentUser() user: { id: string }) {
        return this.financialService.getForecast(id, user.id);
    }

    @Get('exchange-rate')
    getExchangeRate() {
        return this.financialService.getCurrentExchangeRate();
    }
}