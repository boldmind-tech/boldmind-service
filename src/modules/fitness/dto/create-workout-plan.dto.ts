import { IsString, IsOptional, IsInt, IsEnum, IsArray, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkoutPlanDto {
    @ApiProperty({ example: 4, description: 'Plan duration in weeks' })
    @IsInt()
    @Min(1)
    @Max(52)
    durationWeeks: number;

    @ApiPropertyOptional({ example: 'LOSE_WEIGHT', enum: ['LOSE_WEIGHT', 'BUILD_MUSCLE', 'MAINTAIN', 'IMPROVE_ENDURANCE'] })
    @IsOptional()
    @IsString()
    goal?: string;

    @ApiPropertyOptional({ example: 4, default: 4, description: 'Workout days per week' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(7)
    daysPerWeek?: number;

    @ApiPropertyOptional({ example: 'moderate', enum: ['beginner', 'moderate', 'advanced'] })
    @IsOptional()
    @IsString()
    activityLevel?: string;

    @ApiPropertyOptional({ example: ['dumbbells', 'barbell', 'resistance_bands'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    equipment?: string[];
}
