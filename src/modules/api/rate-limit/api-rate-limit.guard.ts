import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { RedisService } from "../../../database/redis.service";
import type { AuthedApiRequest } from "../api-key/api-key.guard";

/**
 * ApiRateLimitGuard — enforces ApiKey.rateLimit (requests/hour) per key.
 *
 * MUST run after ApiKeyGuard in the guard chain (`req.apiKey` must already
 * be attached). Uses a simple fixed-hour-window counter on REDIS_SESSION —
 * cheap, and good enough at the volumes the Enterprise API expects; a
 * sliding-window upgrade can swap the implementation without touching
 * callers since the key pattern (`apikey:ratelimit:{prefix}:{hour}`) is
 * self-contained here.
 *
 * Key pattern: apikey:ratelimit:{keyId}:{YYYYMMDDHH}   TTL: 3600s
 */
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedApiRequest>();
    const apiKey = req.apiKey;

    if (!apiKey) {
      // ApiKeyGuard should always run first; fail closed if it didn't.
      throw new HttpException("API key not resolved", HttpStatus.UNAUTHORIZED);
    }

    const hourBucket = new Date()
      .toISOString()
      .slice(0, 13)
      .replace(/[-T:]/g, "");
    const key = `apikey:ratelimit:${apiKey.id}:${hourBucket}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600);
    }

    if (count > apiKey.rateLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded (${apiKey.rateLimit} req/hr for this key)`,
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
