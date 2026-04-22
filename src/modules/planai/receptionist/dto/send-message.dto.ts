import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
    @ApiProperty({ example: 'Hello formatting the way you wanted!' })
    @IsString()
    @IsNotEmpty()
    message: string;
}
