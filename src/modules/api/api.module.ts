import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "../ai/ai.module";
import { ContentModule } from "../amebogist/amebogist.module";

import { ApiKeyController } from "./api-key/api-key.controller";
import { ApiKeyService } from "./api-key/api-key.service";
import { ApiKeyGuard } from "./api-key/api-key.guard";

import { ApiRateLimitGuard } from "./rate-limit/api-rate-limit.guard";

import { EnterpriseController } from "./enterprise/enterprise.controller";
import { EnterpriseService } from "./enterprise/enterprise.service";

import { WebhookController } from "./webhook/webhook.controller";
import {
  WebhookService,
  WebhookDeliveryProcessor,
} from "./webhook/webhook.service";
import { WebhookDeliverySchema } from "./webhook/schemas/webhook-delivery.schema";

/**
 * ApiModule — the Enterprise/Developer API surface described in
 * boldmind-system-design-v2.md §8. Pulls in AiModule (caption/logo
 * generation) and ContentModule (exports the amebogist Post Mongoose
 * model) — both must already export what EnterpriseService needs.
 *
 * NOTE: QueuesModule is @Global() (registered once in AppModule), so
 * QUEUES.AI_GENERATION / QUEUES.WEBHOOK_DELIVERY are already injectable
 * here without re-registering them.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "WebhookDelivery", schema: WebhookDeliverySchema },
    ]),
    AiModule,
    ContentModule,
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
