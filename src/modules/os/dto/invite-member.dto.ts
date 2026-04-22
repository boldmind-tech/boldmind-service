import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteMemberDto {
    @ApiProperty({ example: 'member@example.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ example: 'MEMBER', enum: ['MEMBER', 'ADMIN'] })
    @IsOptional()
    @IsString()
    role?: string;
}
