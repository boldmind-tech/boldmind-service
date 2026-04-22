import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject, IsBoolean } from 'class-validator';

export class CreateReceptionistDto {
    @ApiProperty({ example: 'My Awesome Business' })
    @IsString()
    businessName: string;

    @ApiPropertyOptional({ example: 'friendly and professional' })
    @IsString()
    @IsOptional()
    tone?: string;

    @ApiPropertyOptional({ example: 'Nigerian business' })
    @IsString()
    @IsOptional()
    businessType?: string;

    @ApiPropertyOptional({ example: 'Hello! How can I help you today?' })
    @IsString()
    @IsOptional()
    greeting?: string;

    @ApiPropertyOptional({ description: 'Knowledge base object containing FAQs' })
    @IsObject()
    @IsOptional()
    knowledgeBase?: Record<string, any>;

    @ApiPropertyOptional({ example: ['manager', 'human', 'complaint', 'supervisor'] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    escalationTriggers?: string[];

    @ApiPropertyOptional({ description: 'Facebook Page ID' })
    @IsString()
    @IsOptional()
    pageId?: string;

    @ApiPropertyOptional({ description: 'Instagram Business ID' })
    @IsString()
    @IsOptional()
    igBusinessId?: string;

    @ApiPropertyOptional({ description: 'WhatsApp Phone Number ID' })
    @IsString()
    @IsOptional()
    waPhoneNumberId?: string;

    @ApiPropertyOptional({ description: 'Meta App Access Token' })
    @IsString()
    @IsOptional()
    accessToken?: string;
}
