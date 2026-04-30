import { IsString, IsOptional, IsInt, IsNumber, IsArray, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogMealDto {
    @ApiPropertyOptional({ example: '2026-03-04', description: 'Meal date (defaults to today)' })
    @IsOptional()
    @IsString()
    date?: string;

    @ApiProperty({ example: 'lunch', enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
    @IsString()
    mealType: string;

    @ApiProperty({ description: 'Foods consumed', example: [{ name: 'Rice and beans', quantity: '1 plate', calories: 450 }] })
    @IsArray()
    foods: Array<{ name: string; quantity: string; calories?: number }>;

    @ApiPropertyOptional({ example: 650 })
    @IsOptional()
    @IsInt()
    @Min(0)
    totalCalories?: number;

    @ApiPropertyOptional({ example: 25, description: 'Protein in grams' })
    @IsOptional()
    @IsNumber()
    protein?: number;

    @ApiPropertyOptional({ example: 80, description: 'Carbs in grams' })
    @IsOptional()
    @IsNumber()
    carbs?: number;

    @ApiPropertyOptional({ example: 15, description: 'Fat in grams' })
    @IsOptional()
    @IsNumber()
    fat?: number;

    @ApiPropertyOptional({ example: 'Added extra vegetables' })
    @IsOptional()
    @IsString()
    notes?: string;
}
