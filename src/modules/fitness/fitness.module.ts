import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { FitnessService } from './fitness.service';
import { FitnessController } from './fitness.controller';

@Module({
    imports: [ConfigModule, HttpModule],
    controllers: [FitnessController],
    providers: [FitnessService],
    exports: [FitnessService],
})
export class FitnessModule { }
