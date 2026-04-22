import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskDto {
    @ApiPropertyOptional({ example: 'Updated task title' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ example: 'IN_PROGRESS', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ description: 'Reassign to user ID' })
    @IsOptional()
    @IsString()
    assigneeId?: string;

    @ApiPropertyOptional({ example: '2026-03-20' })
    @IsOptional()
    @IsString()
    dueDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    label?: string;
}
