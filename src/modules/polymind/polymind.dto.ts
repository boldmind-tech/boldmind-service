import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export const POLYMIND_PROVIDERS = [
  "openai",
  "claude",
  "gemini",
  "groq",
  "mistral",
] as const;
export type PolyMindProvider = (typeof POLYMIND_PROVIDERS)[number];

export class PolyMindQueryDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;
}

export interface PolyMindResponse {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
}
