import { SetMetadata } from "@nestjs/common";

/**
 * Declares the API_SCOPES required to call a handler guarded by ApiKeyGuard.
 * The set of valid scope strings is documented in api-key.service.ts
 * (API_SCOPES map) and boldmind-system-design-v2.md §8.2.
 *
 * Usage:
 *   @ApiScopes('amebogist:read')
 *   @UseGuards(ApiKeyGuard, ApiRateLimitGuard)
 *   @Get('posts')
 *   listPosts() { ... }
 */
export const API_SCOPES_KEY = "api_scopes";
export const ApiScopes = (...scopes: string[]) =>
  SetMetadata(API_SCOPES_KEY, scopes);
