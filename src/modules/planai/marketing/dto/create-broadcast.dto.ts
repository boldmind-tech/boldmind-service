import { IsString, IsArray, IsOptional, IsUrl, IsDateString, ArrayNotEmpty } from 'class-validator';

export class CreateBroadcastDto {
    @IsString()
    message: string;

    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    recipientNumbers: string[];

    @IsOptional()
    @IsUrl()
    mediaUrl?: string;

    @IsOptional()
    @IsDateString()
    scheduledFor?: string;
}
