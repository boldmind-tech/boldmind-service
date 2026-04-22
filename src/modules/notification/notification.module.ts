import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PlanAIModule } from '../planai/planai.module';

@Module({
    imports: [
        ConfigModule,
        BullModule.registerQueue({ name: 'notifications' }),
        PlanAIModule,
    ],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule { }
