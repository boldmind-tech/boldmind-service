import mongoose, { Schema, Document } from "mongoose";

export interface IPolyMindResponse {
  modelId: string;
  content: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
}

export interface IPolyMindComparison extends Document {
  userId: string; // ApiKey.userId — extension auth is X-API-Key, not JWT
  prompt: string;
  systemPrompt?: string;
  responses: IPolyMindResponse[];
  userRatings: Map<string, number>; // modelId → 1 | 0
  savedModels: string[];
  source: "extension" | "web" | "api";
  createdAt: Date;
  updatedAt: Date;
}

export const PolyMindComparisonSchema = new Schema<IPolyMindComparison>(
  {
    userId: { type: String, required: true, index: true },
    prompt: { type: String, required: true },
    systemPrompt: String,
    responses: [
      {
        modelId: { type: String, required: true },
        content: { type: String, required: true },
        tokensUsed: { type: Number, default: 0 },
        latencyMs: { type: Number, default: 0 },
        error: String,
      },
    ],
    userRatings: { type: Map, of: Number, default: () => new Map() },
    savedModels: [{ type: String }],
    source: { type: String, enum: ["extension", "web", "api"], default: "web" },
  },
  {
    timestamps: true,
    collection: "polymind_comparisons",
  },
);

PolyMindComparisonSchema.index({ userId: 1, createdAt: -1 });

export const PolyMindComparison = mongoose.model<IPolyMindComparison>(
  "PolyMindComparison",
  PolyMindComparisonSchema,
);
