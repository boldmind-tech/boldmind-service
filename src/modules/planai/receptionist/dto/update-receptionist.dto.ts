import { PartialType } from '@nestjs/swagger';
import { CreateReceptionistDto } from './create-receptionist.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateReceptionistDto extends PartialType(CreateReceptionistDto) {
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
