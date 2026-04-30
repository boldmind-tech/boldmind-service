import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { BullModule as BullMQModule } from '@nestjs/bullmq';

// Database
import { DatabaseModule } from './database/database.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AiModule } from './modules/ai/ai.module';
import { PlanAIModule } from './modules/planai/planai.module';
import { ContentModule } from './modules/amebogist/amebogist.module';
import { EduCenterModule } from './modules/educenter/educenter.module';
import { AutomationModule } from './modules/automation/automation.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OSModule } from './modules/os/os.module';
import { AdminModule } from './modules/admin/admin.module';
import { HubModule } from './modules/hub/hub.module';
import { VillageCircleModule } from './modules/villagecircle/villagecircle.module';

@Module({
  imports: [
    // ── Config (available everywhere) ──────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // ── Rate limiting ───────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 10 },  // 10 req/sec
          { name: 'medium', ttl: 60000, limit: 200 },  // 200 req/min
          { name: 'long', ttl: 3600000, limit: 2000 }, // 2000 req/hr
        ],
      }),
    }),

    // ── Scheduler (cron jobs) ───────────────────────────────
    ScheduleModule.forRoot(),

    // ── Event emitter (inter-module events) ────────────────
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),


    // ── BullMQ (Redis-backed job queues) ───────────────────
    // For @nestjs/bull consumers
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let url = config.get<string>('REDIS_URL');
        if (url && url.includes('-u ')) {
          url = url.split('-u ')[1].split(' ')[0]; // clean Upstash CLI strings
        }

        let redisConfig: any = { url };
        
        // Ensure proper parsing of TLS for Upstash/rediss:// URLs if not using just url
        if (url && (url.startsWith('rediss://') || url.includes('.upstash.io'))) {
          redisConfig.tls = { rejectUnauthorized: false };
        } else if (config.get<string>('NODE_ENV') === 'production') {
          redisConfig.tls = {};
        }

        return {
          redis: redisConfig,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        };
      },
    }),

    // For @nestjs/bullmq consumers
    BullMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let url = config.get<string>('REDIS_URL');
        if (url && url.includes('-u ')) {
          url = url.split('-u ')[1].split(' ')[0]; // clean Upstash CLI strings
        }

        // ioredis connection options
        const connection: any = url ? { url } : {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        };

        if (url && (url.startsWith('rediss://') || url.includes('.upstash.io'))) {
          connection.tls = { rejectUnauthorized: false };
        } else if (config.get<string>('NODE_ENV') === 'production') {
          connection.tls = {};
        }

        return {
          connection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        };
      },
    }),

    // ── Database ────────────────────────────────────────────
    DatabaseModule,

    // ── Feature Modules ─────────────────────────────────────
    AuthModule,
    UserModule,
    PaymentModule,
    AiModule,
    PlanAIModule,
    ContentModule,
    EduCenterModule,
    AutomationModule,
    MediaModule,
    NotificationModule,
    OSModule,
    AdminModule,
    HubModule,
    VillageCircleModule,
  ],
})
export class AppModule { }