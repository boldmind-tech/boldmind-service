import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
    @ApiProperty({ example: 'Design homepage mockup' })
    @IsString()
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({ example: 'Create a modern design for the landing page' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ description: 'Assigned user ID' })
    @IsOptional()
    @IsString()
    assigneeId?: string;

    @ApiPropertyOptional({ description: 'Project ID' })
    @IsOptional()
    @IsString()
    projectId?: string;

    @ApiPropertyOptional({ example: '2026-03-15' })
    @IsOptional()
    @IsString()
    dueDate?: string;

    @ApiPropertyOptional({ example: 'feature', description: 'Task label/type' })
    @IsOptional()
    @IsString()
    label?: string;
}
