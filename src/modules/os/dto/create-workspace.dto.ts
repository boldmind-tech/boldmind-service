import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
    @ApiProperty({ example: 'BoldMind Team' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ example: 'Our main workspace for product development' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ example: '#6d28d9' })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiPropertyOptional({ example: 'https://cdn.boldmind.ng/icons/workspace.png' })
    @IsOptional()
    @IsString()
    icon?: string;
}
