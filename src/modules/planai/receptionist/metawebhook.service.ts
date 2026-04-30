// src/modules/receptionist/meta-webhook.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { ReceptionistService } from './receptionist.service';

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account' | 'instagram';
  entry: MetaEntry[];
}

interface MetaEntry {
  id: string;
  changes: MetaChange[];
}

interface MetaChange {
  value: MetaChangeValue;
  field: string;
}

interface MetaChangeValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: { profile: { name: string }; wa_id: string }[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
}

interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'interactive' | 'button';
  text?: { body: string };
  image?: { id: string; mime_type: string };
  audio?: { id: string; mime_type: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
}

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);
  private readonly verifyToken: string;
  private readonly appSecret: string;
  private readonly waToken: string;
  private readonly waApiVersion = 'v19.0';

  constructor(
    private config: ConfigService,
    private http: HttpService,
    private prisma: PrismaService,
    private redis: RedisService,
    @InjectQueue('receptionist') private receptionistQueue: Queue,
  ) {
    this.verifyToken = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN');
    this.appSecret = this.config.get<string>('META_APP_SECRET');
    this.waToken = this.config.get<string>('META_WHATSAPP_TOKEN');
  }

  // ─── WEBHOOK VERIFICATION (GET) ─────────────────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Meta webhook verified successfully');
      return challenge;
    }
    throw new UnauthorizedException('Webhook verification failed');
  }

  // ─── SIGNATURE VALIDATION ────────────────────────────────────────────────────

  validateSignature(rawBody: Buffer, signature: string): boolean {
    const expected = `sha256=${crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  // ─── PROCESS INCOMING WEBHOOK (POST) ────────────────────────────────────────

  async processWebhook(payload: MetaWebhookPayload, rawBody: Buffer, signature: string) {
    if (!this.validateSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await this.handleMessagesChange(change.value);
        }
      }
    }

    return { status: 'ok' };
  }

  private async handleMessagesChange(value: MetaChangeValue) {
    if (!value.messages?.length) return;

    for (const msg of value.messages) {
      const contact = value.contacts?.find(c => c.wa_id === msg.from);
      const senderName = contact?.profile?.name ?? 'Unknown';

      // Deduplicate using Redis (Meta can send duplicates)
      const dedupKey = `meta:msg:${msg.id}`;
      const seen = await this.redis.get(dedupKey);
      if (seen) continue;
      await this.redis.set(dedupKey, '1', 3600);

      this.logger.log(`Incoming WA message from ${msg.from} (${senderName}): type=${msg.type}`);

      // Queue for async processing so we return 200 fast
      await this.receptionistQueue.add(
        'process-inbound',
        {
          phoneNumberId: value.metadata.phone_number_id,
          from: msg.from,
          senderName,
          message: msg,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );

      // Update status in DB
      await this.upsertConversation(msg.from, senderName, msg);
    }

    // Update message delivery statuses
    if (value.statuses?.length) {
      await this.handleStatuses(value.statuses);
    }
  }

  // ─── SEND WHATSAPP MESSAGE ───────────────────────────────────────────────────

  async sendTextMessage(phoneNumberId: string, to: string, text: string) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/${phoneNumberId}/messages`;
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
          },
          { headers: { Authorization: `Bearer ${this.waToken}` } },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`Failed to send WA message to ${to}`, (err as any)?.response?.data);
      throw err;
    }
  }

  async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    langCode: string,
    components: any[],
  ) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/${phoneNumberId}/messages`;
    const { data } = await firstValueFrom(
      this.http.post(
        url,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: { name: templateName, language: { code: langCode }, components },
        },
        { headers: { Authorization: `Bearer ${this.waToken}` } },
      ),
    );
    return data;
  }

  async sendInteractiveButtons(
    phoneNumberId: string,
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
  ) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/${phoneNumberId}/messages`;
    const { data } = await firstValueFrom(
      this.http.post(
        url,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
              buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
            },
          },
        },
        { headers: { Authorization: `Bearer ${this.waToken}` } },
      ),
    );
    return data;
  }

  // ─── MESSENGER (FACEBOOK) ────────────────────────────────────────────────────

  async sendMessengerMessage(recipientId: string, text: string, accessToken: string) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/me/messages`;
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          url,
          {
            recipient: { id: recipientId },
            message: { text },
          },
          { params: { access_token: accessToken } },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`Failed to send Messenger message to ${recipientId}`, (err as any)?.response?.data);
      throw err;
    }
  }

  async replyToComment(commentId: string, message: string, accessToken: string) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/${commentId}/comments`;
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          url,
          { message },
          { params: { access_token: accessToken } },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`Failed to reply to comment ${commentId}`, (err as any)?.response?.data);
      throw err;
    }
  }

  // ─── INSTAGRAM ───────────────────────────────────────────────────────────────

  async sendInstagramMessage(recipientId: string, text: string, accessToken: string) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/me/messages`;
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          url,
          {
            recipient: { id: recipientId },
            message: { text },
          },
          { params: { access_token: accessToken } },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`Failed to send Instagram message to ${recipientId}`, (err as any)?.response?.data);
      throw err;
    }
  }

  // ─── WHATSAPP (per-client token) ─────────────────────────────────────────────

  async sendWhatsAppMessage(to: string, text: string, phoneNumberId: string, accessToken: string) {
    const url = `https://graph.facebook.com/${this.waApiVersion}/${phoneNumberId}/messages`;
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp message to ${to}`, (err as any)?.response?.data);
      throw err;
    }
  }

  // ─── MEDIA DOWNLOAD ──────────────────────────────────────────────────────────

  async downloadMediaUrl(mediaId: string): Promise<string> {
    const urlRes = await firstValueFrom(
      this.http.get(`https://graph.facebook.com/${this.waApiVersion}/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.waToken}` },
      }),
    );
    return urlRes.data.url; // signed CDN URL for download
  }

  // ─── DB HELPERS ──────────────────────────────────────────────────────────────

  private async upsertConversation(from: string, name: string, msg: MetaMessage) {
    // Find an existing active conversation for this phone number
    const existing = await this.prisma.conversationLog.findFirst({
      where: { senderPhone: from, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const newEntry = {
      id: msg.id,
      type: msg.type,
      body: msg.text?.body ?? `[${msg.type}]`,
      timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
      direction: 'inbound',
    };

    if (existing) {
      const messages = Array.isArray(existing.messages) ? existing.messages : [];
      await this.prisma.conversationLog.update({
        where: { id: existing.id },
        data: {
          senderName: name,
          messages: [...(messages as any[]), newEntry],
          updatedAt: new Date(),
        },
      });
    } else {
      // Need a clientId — look up by whatsapp number or fall back gracefully
      const client = await this.prisma.receptionistClient.findFirst({
        where: { whatsappNumber: from },
      });
      if (!client) {
        this.logger.warn(`No ReceptionistClient found for phone ${from}; skipping conversation log.`);
        return;
      }
      await this.prisma.conversationLog.create({
        data: {
          clientId: client.id,
          platform: 'WHATSAPP',
          externalId: msg.id,
          senderName: name,
          senderPhone: from,
          messages: [newEntry],
          status: 'ACTIVE',
        },
      });
    }
  }

  private async handleStatuses(statuses: MetaStatus[]) {
    // Messages are stored as a JSON array inside ConversationLog.
    // Update the delivery status of the matching message entry (non-critical).
    for (const s of statuses) {
      try {
        const conv = await this.prisma.conversationLog.findFirst({
          where: { externalId: s.id },
        });
        if (!conv) continue;
        const messages = Array.isArray(conv.messages) ? (conv.messages as any[]) : [];
        const updated = messages.map((m: any) =>
          m.id === s.id ? { ...m, deliveryStatus: s.status } : m,
        );
        await this.prisma.conversationLog.update({
          where: { id: conv.id },
          data: { messages: updated, updatedAt: new Date() },
        });
      } catch {
        // non-critical
      }
    }
  }
}