import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class GenerateForecastDto {
    @IsString()
    businessName: string;

    @IsString()
    industry: string;

    @IsNumber()
    currentMonthlyRevenue: number;

    @IsNumber()
    expectedGrowthPercent: number;

    @IsNumber()
    fixedExpensesNGN: number;

    @IsNumber()
    variableCostPercent: number;

    @IsNumber()
    startingCashNGN: number;

    @IsArray()
    @IsString({ each: true })
    revenueSources: string[];

    @IsOptional()
    @IsString()
    upcomingExpenses?: string;

    @IsOptional()
    @IsString()
    context?: string;
}

export class GenerateScenarioDto extends GenerateForecastDto { }

export class CalculateBreakEvenDto {
    @IsNumber()
    fixedCostsNGN: number;

    @IsNumber()
    variableCostPerUnit: number;

    @IsNumber()
    pricePerUnit: number;

    @IsOptional()
    @IsNumber()
    currentUnits?: number;
}
