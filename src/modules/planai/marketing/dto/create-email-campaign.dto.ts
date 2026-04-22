import { IsString, IsArray, IsOptional, IsBoolean, IsDateString, ArrayNotEmpty, IsEmail } from 'class-validator';

export class CreateEmailCampaignDto {
    @IsString()
    name: string;

    @IsString()
    subject: string;

    @IsString()
    bodyHtml: string;

    @IsArray()
    @ArrayNotEmpty()
    @IsEmail({}, { each: true })
    recipientEmails: string[];

    @IsOptional()
    @IsDateString()
    scheduledFor?: string;

    @IsOptional()
    @IsBoolean()
    isAbTest?: boolean;

    @IsOptional()
    @IsString()
    variantSubject?: string;
}
