import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
    @ApiPropertyOptional({ example: 'Updated Workspace Name' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiPropertyOptional({ example: '#dc2626' })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    icon?: string;
}
