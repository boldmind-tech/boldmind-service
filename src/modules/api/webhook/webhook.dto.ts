import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";
import { WEBHOOK_EVENTS } from "./webhook-events.constant";

export class CreateWebhookDto {
  /** Must reference an ApiKey belonging to the requesting user. */
  @IsString()
  apiKeyId!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];

  @IsOptional()
  @IsString()
  secret?: string;
}
