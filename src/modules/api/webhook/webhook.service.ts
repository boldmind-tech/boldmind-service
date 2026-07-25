import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHmac, randomBytes } from "crypto";
import { PrismaService } from "../../../database/prisma.service";
import { QUEUES } from "../../../common/constants/queues";
import { IWebhookDelivery } from "./schemas/webhook-delivery.schema";
import { CreateWebhookDto } from "./webhook.dto";
import { WebhookEvent } from "./webhook-events.constant";

export { WEBHOOK_EVENTS, WebhookEvent } from "./webhook-events.constant";

interface WebhookDeliveryJobData {
  subscriptionId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  deliveryDocId: string;
}

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.WEBHOOK_DELIVERY)
    private readonly queue: Queue<WebhookDeliveryJobData>,
    @InjectModel("WebhookDelivery")
    private readonly deliveryModel: Model<IWebhookDelivery>,
  ) {}

  // ── Subscription management (JWT auth) ────────────────────────────────────

  async create(userId: string, apiKeyId: string, dto: CreateWebhookDto) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });
    if (!key || key.userId !== userId) {
      throw new ForbiddenException(
        "apiKeyId must reference one of your own API keys",
      );
    }

    const secret = dto.secret ?? randomBytes(24).toString("hex");
    return this.prisma.webhookSubscription.create({
      data: { userId, apiKeyId, url: dto.url, events: dto.events, secret },
    });
  }

  async list(userId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async remove(userId: string, id: string) {
    const sub = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });
    if (!sub) throw new NotFoundException("Webhook subscription not found");
    if (sub.userId !== userId)
      throw new ForbiddenException("Not your webhook subscription");
    await this.prisma.webhookSubscription.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Firing events (called internally by other modules) ────────────────────

  /**
   * Enqueues delivery of `event` to every active subscription listening for
   * it. Call sites: payment.service.ts (charge.success/failed), payment
   * webhook processor (subscription.activated/cancelled), amebogist.service
   * (article.published), auth.service (user.registered), vibecoders.service.
   */
  async fireEvent(
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subs = await this.prisma.webhookSubscription.findMany({
      where: { isActive: true, events: { has: event } },
    });
    if (!subs.length) return;

    await Promise.all(
      subs.map(async (sub) => {
        const doc = await this.deliveryModel.create({
          subscriptionId: sub.id,
          event,
          payload,
          status: "pending",
          attempts: 0,
        });
        await this.queue.add(
          "deliver",
          {
            subscriptionId: sub.id,
            url: sub.url,
            secret: sub.secret,
            event,
            payload,
            deliveryDocId: String(doc._id),
          },
          { attempts: 3, backoff: { type: "exponential", delay: 4_000 } },
        );
      }),
    );
  }
}

/**
 * WebhookDeliveryProcessor — consumes QUEUES.WEBHOOK_DELIVERY, POSTs the
 * signed payload, and records the outcome on the WebhookDelivery doc.
 * Signature header: X-BoldmindNG-Signature = HMAC-SHA256(body, subscription.secret)
 */
@Processor(QUEUES.WEBHOOK_DELIVERY)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    @InjectModel("WebhookDelivery")
    private readonly deliveryModel: Model<IWebhookDelivery>,
  ) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const { url, secret, event, payload, deliveryDocId } = job.data;
    const body = JSON.stringify({
      event,
      data: payload,
      sentAt: new Date().toISOString(),
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BoldmindNG-Signature": signature,
          "X-BoldmindNG-Event": event,
        },
        body,
      });

      const responseBody = await res.text().catch(() => "");

      await this.deliveryModel.findByIdAndUpdate(deliveryDocId, {
        status: res.ok ? "delivered" : "failed",
        responseCode: res.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: res.ok ? new Date() : undefined,
        $inc: { attempts: 1 },
      });

      if (!res.ok) {
        throw new Error(`Webhook endpoint responded ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(
        `Webhook delivery failed for ${url}: ${(err as Error).message}`,
      );
      await this.deliveryModel.findByIdAndUpdate(deliveryDocId, {
        status: "failed",
        $inc: { attempts: 1 },
      });
      throw err; // let BullMQ retry policy handle backoff
    }
  }
}
