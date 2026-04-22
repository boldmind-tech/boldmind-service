// ─────────────────────────────────────────────────────────────────────────────
// service/src/modules/planai/dto/all-planai.dto.ts
// DTOs for business-planning, financial, branding sub-modules
// ─────────────────────────────────────────────────────────────────────────────

import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsInt, Min, Max, IsPositive } from 'class-validator';

// ── Business Planning ────────────────────────────────────────────────────────

export class GenerateBusinessPlanDto {
    @IsString() businessName: string;
    @IsString() industry: string;
    @IsString() description: string;
    @IsString() targetCustomers: string;
    @IsString() productsServices: string;
    @IsOptional() @IsString() location?: string;
    @IsOptional() @IsNumber() @IsPositive() initialCapitalNGN?: number;
    @IsOptional() @IsNumber() @Min(0) fundingNeeded?: number;
    @IsOptional() @IsString() additionalContext?: string;
}

export class GeneratePitchDeckDto {
    @IsString() businessName: string;
    @IsString() industry: string;
    @IsString() problemStatement: string;
    @IsString() solution: string;
    @IsString() teamBackground: string;
    @IsOptional() @IsString() traction?: string;
    @IsOptional() @IsNumber() @IsPositive() fundingAskNGN?: number;
    @IsOptional() @IsString() targetMarket?: string;
}

// ── Financial ───────────────────────────────────────────────────────────────

export class GenerateForecastDto {
    @IsString() businessName: string;
    @IsString() industry: string;
    @IsNumber() @IsPositive() currentMonthlyRevenue: number;
    @IsNumber() @Min(0) @Max(500) expectedGrowthPercent: number;
    @IsNumber() @IsPositive() fixedExpensesNGN: number;
    @IsNumber() @Min(0) @Max(100) variableCostPercent: number;
    @IsNumber() @Min(0) startingCashNGN: number;
    @IsArray() @IsString({ each: true }) revenueSources: string[];
    @IsOptional() @IsString() upcomingExpenses?: string;
    @IsOptional() @IsString() context?: string;
}

export class GenerateScenarioDto {
    @IsString() businessName: string;
    @IsNumber() baseRevenue: number;
    @IsNumber() growthRate: number;
    @IsNumber() fixedCosts: number;
    @IsOptional() @IsString() industry?: string;
    @IsOptional() @IsString() risks?: string;
}

export class CalculateBreakEvenDto {
    @IsNumber() @IsPositive() fixedCostsNGN: number;
    @IsNumber() @IsPositive() variableCostPerUnit: number;
    @IsNumber() @IsPositive() pricePerUnit: number;
    @IsOptional() @IsNumber() @Min(0) currentUnits?: number;
}

// ── Branding ─────────────────────────────────────────────────────────────────

export class GenerateLogoDto {
    @IsString() businessName: string;
    @IsString() industry: string;
    @IsOptional() @IsEnum(['modern', 'traditional', 'playful', 'luxury']) style?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) colors?: string[];
    @IsOptional() @IsString() additionalInstructions?: string;
}

export class GenerateBrandKitDto {
    @IsString() businessName: string;
    @IsString() industry: string;
    @IsString() targetAudience: string;
    @IsArray() @IsString({ each: true }) brandValues: string[];
    @IsOptional() @IsString() style?: string;
    @IsOptional() @IsString() inspiration?: string;
}

export class GenerateFlyerDto {
    @IsString() businessName: string;
    @IsString() offerText: string;
    @IsString() callToAction: string;
    @IsOptional() @IsString() contact?: string;
    @IsOptional() @IsString() style?: string;
    @IsOptional() @IsString() colors?: string;
}

export class GenerateColorPaletteDto {
    @IsString() industry: string;
    @IsString() targetAudience: string;
    @IsOptional() @IsString() mood?: string;
}