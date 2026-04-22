// src/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    // ── MongoDB (Mongoose) ───────────────────────────────────────
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URL');
        const dbName = config.get<string>('MONGODB_DB_MAIN') || config.get<string>('MONGODB_DB_NAME', 'boldmind');
        
        if (!uri) {
          throw new Error('MONGODB_URL is not set');
        }

        return {
          uri,
          dbName,
          maxPoolSize: 15,
          serverSelectionTimeoutMS: 5000,
          heartbeatFrequencyMS: 10000,
        };
      },
    }),

    // You can also register common schemas here if they are shared across many modules
    // MongooseModule.forFeature([...])
  ],

  providers: [
    PrismaService,
    RedisService,
  ],

  exports: [
    PrismaService,
    RedisService,
    MongooseModule,        // allows injecting Model<> in feature modules
  ],
})
export class DatabaseModule {}