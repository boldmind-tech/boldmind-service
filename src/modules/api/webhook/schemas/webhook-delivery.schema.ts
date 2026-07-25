import mongoose, { Schema, Document } from "mongoose";

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed";

export interface IWebhookDelivery extends Document {
  subscriptionId: string;
  event: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  responseCode?: number;
  responseBody?: string;
  attempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const WebhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    subscriptionId: { type: String, required: true, index: true },
    event: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "delivered", "failed"],
      default: "pending",
      index: true,
    },
    responseCode: Number,
    responseBody: String,
    attempts: { type: Number, default: 0 },
    nextRetryAt: Date,
    deliveredAt: Date,
  },
  {
    timestamps: true,
    collection: "webhook_deliveries",
  },
);

WebhookDeliverySchema.index({ subscriptionId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 }); // retry sweep

export const WebhookDelivery = mongoose.model<IWebhookDelivery>(
  "WebhookDelivery",
  WebhookDeliverySchema,
);
