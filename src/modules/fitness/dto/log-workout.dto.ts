import { IsString, IsOptional, IsInt, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogWorkoutDto {
    @ApiPropertyOptional({ description: 'Associated workout plan ID' })
    @IsOptional()
    @IsString()
    planId?: string;

    @ApiPropertyOptional({ example: '2026-03-04', description: 'Workout date (defaults to today)' })
    @IsOptional()
    @IsString()
    date?: string;

    @ApiProperty({ description: 'Exercises performed', example: [{ name: 'Push-ups', sets: 3, reps: 15 }] })
    @IsArray()
    exercises: Array<{ name: string; sets: number; reps: string; weight?: number }>;

    @ApiPropertyOptional({ example: 45 })
    @IsOptional()
    @IsInt()
    @Min(1)
    durationMinutes?: number;

    @ApiPropertyOptional({ example: 300 })
    @IsOptional()
    @IsInt()
    @Min(0)
    caloriesBurned?: number;

    @ApiPropertyOptional({ example: 'Felt strong today' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ example: 'great', enum: ['terrible', 'bad', 'okay', 'good', 'great'] })
    @IsOptional()
    @IsString()
    mood?: string;
}
