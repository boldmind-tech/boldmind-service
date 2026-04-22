import { Module } from '@nestjs/common';
import { SocialFactoryController } from './social-factory.controller';
import { SocialFactoryService } from './social-factory.service';

@Module({
    controllers: [SocialFactoryController],
    providers: [SocialFactoryService],
    exports: [SocialFactoryService],
})
export class SocialFactoryModule { }
