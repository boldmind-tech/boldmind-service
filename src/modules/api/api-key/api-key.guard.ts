import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { createHash } from "crypto";
import { PrismaService } from "../../../database/prisma.service";
import { RedisService } from "../../../database/redis.service";
import { API_SCOPES_KEY } from "../../../common/decorators/api-scopes.decorator";
import type { ApiKey } from "@prisma/client";

export interface AuthedApiRequest extends Request {
  apiKey: ApiKey;
  apiKeyUserId: string;
}

/**
 * ApiKeyGuard — validates the `X-API-Key` header against ApiKey.keyHash.
 *
 * Responsibilities (deliberately narrow — rate limiting lives in
 * ApiRateLimitGuard, see src/modules/api/rate-limit/api-rate-limit.guard.ts):
 *   1. Parse + validate the raw key format (`bm_live_...` / `bm_test_...`)
 *   2. Resolve the ApiKey record (REDIS_CACHE-fronted, 5 min TTL)
 *   3. Reject revoked / expired keys
 *   4. Enforce @ApiScopes(...) declared on the handler, if any
 *   5. Attach `req.apiKey` + `req.apiKeyUserId` for downstream use
 *   6. Fire-and-forget `lastUsedAt` bump (never blocks the request)
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedApiRequest>();
    const rawKey = (req.headers["x-api-key"] as string | undefined)?.trim();

    if (!rawKey || !rawKey.startsWith("bm_")) {
      throw new UnauthorizedException("Valid X-API-Key header required");
    }

    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    const cacheKey = `apikey:meta:${keyHash}`;

    let apiKey: ApiKey | null = null;
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) {
      apiKey = JSON.parse(cached) as ApiKey;
    } else {
      apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });
      if (apiKey) {
        await this.redis.cacheSet(cacheKey, JSON.stringify(apiKey), 300);
      }
    }

    if (!apiKey) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (!apiKey.isActive) {
      throw new UnauthorizedException("API key has been revoked");
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException("API key has expired");
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      API_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredScopes?.length) {
      const missing = requiredScopes.filter((s) => !apiKey!.scopes.includes(s));
      if (missing.length) {
        throw new ForbiddenException(
          `API key missing required scope(s): ${missing.join(", ")}`,
        );
      }
    }

    req.apiKey = apiKey;
    req.apiKeyUserId = apiKey.userId;

    // Fire-and-forget — never let a slow write stall the request path.
    this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    void prefix; // reserved for future per-prefix diagnostics/logging
    return true;
  }
}
