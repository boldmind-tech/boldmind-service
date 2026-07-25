import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { PostSchema } from '../amebogist/schemas/post.schema';

import { ApiKeyController } from './api-key/api-key.controller';
import { ApiKeyService } from './api-key/api-key.service';
import { ApiKeyGuard } from './api-key/api-key.guard';

import { ApiRateLimitGuard } from './rate-limit/api-rate-limit.guard';

import { EnterpriseController } from './enterprise/enterprise.controller';
import { EnterpriseService } from './enterprise/enterprise.service';

import { WebhookController } from './webhook/webhook.controller';
import { WebhookService, WebhookDeliveryProcessor } from './webhook/webhook.service';
import { WebhookDeliverySchema } from './webhook/schemas/webhook-delivery.schema';

/**
 * ApiModule — the Enterprise/Developer API surface described in
 * boldmind-system-design-v2.md §8.
 *
 * FIX (see Nest DI error "Please make sure that PostModel is available in
 * the ApiModule context"): ContentModule (amebogist.module.ts) registers
 * the Post schema for its own internal use but does not export
 * MongooseModule, so `@InjectModel('Post')` inside EnterpriseService could
 * not resolve it just by importing ContentModule. MongooseModule.forFeature
 * bindings are NOT singletons shared implicitly across modules the way
 * @Global() providers are — every module that wants to @InjectModel() a
 * given schema must register that schema in its own `imports` via
 * MongooseModule.forFeature(), even if another module already did the same
 * for the same collection. Doing so here, directly against the same
 * PostSchema/collection ('posts'), gives ApiModule its own valid model
 * token without needing ContentModule to change its exports.
 *
 * NOTE: QueuesModule is @Global() (registered once in AppModule), so
 * QUEUES.AI_GENERATION / QUEUES.WEBHOOK_DELIVERY are already injectable
 * here without re-registering them.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'WebhookDelivery', schema: WebhookDeliverySchema },
      { name: 'Post', schema: PostSchema },
    ]),
    AiModule,
  ],
  controllers: [ApiKeyController, EnterpriseController, WebhookController],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    ApiRateLimitGuard,
    EnterpriseService,
    WebhookService,
    WebhookDeliveryProcessor,
  ],
  exports: [ApiKeyGuard, ApiRateLimitGuard, ApiKeyService, WebhookService],
})
export class ApiModule {}
