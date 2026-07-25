import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/** Canonical list — keep in sync with boldmind-system-design-v2.md §8.2 */
export const API_SCOPES = {
  "amebogist:read": "Read published articles and categories",
  "educenter:questions": "Fetch exam questions (JAMB/WAEC/NECO)",
  "educenter:submit": "Submit quiz attempts on behalf of students",
  "planai:social:generate": "Generate social media captions",
  "planai:branding:logo": "Generate logos",
  "villagecircle:waitlist": "Add emails to concept waitlists",
  "users:profile:read": "Read authenticated user profile",
  "payments:verify": "Verify payment status",
  "polymind:query": "PolyMind AI comparison proxy",
  "webhook:subscribe": "Subscribe to BoldmindNG events",
} as const;

export type ApiScopeName = keyof typeof API_SCOPES;
const VALID_SCOPES = Object.keys(API_SCOPES) as ApiScopeName[];

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_SCOPES, { each: true })
  scopes!: ApiScopeName[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
