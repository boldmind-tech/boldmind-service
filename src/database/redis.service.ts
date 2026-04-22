import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis;

  constructor(private readonly config: ConfigService) { }

  async onModuleInit() {
    let redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl && redisUrl.includes('-u ')) {
      redisUrl = redisUrl.split('-u ')[1].split(' ')[0];
    }

    const options: any = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    };

    if (redisUrl && (redisUrl.startsWith('rediss://') || redisUrl.includes('.upstash.io'))) {
      options.tls = { rejectUnauthorized: false };
    }

    this.client = new Redis(redisUrl, options);

    this.client.on('connect', () =>
      this.logger.log('Redis connected (Upstash)'),
    );

    this.client.on('error', (err) =>
      this.logger.error('Redis error:', err.message),
    );

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ── Basic key helpers ───────────────────────────────────

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  // NEW: direct setex support
  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.setex(key, ttlSeconds, value);
  }

  async del(...keys: string[]): Promise<void> {
    await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  // ── Hash helpers ────────────────────────────────────────

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  // ── Cache helper ────────────────────────────────────────

  async cache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    const cached = await this.get(key);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    const data = await fetchFn();
    await this.setex(key, ttlSeconds, JSON.stringify(data));

    return data;
  }

  // ── SSO token store ─────────────────────────────────────

  async storeSSOToken(
    token: string,
    userId: string,
    ttlSeconds = 300,
  ): Promise<void> {
    await this.setex(`sso:${token}`, ttlSeconds, userId);
  }

  async consumeSSOToken(token: string): Promise<string | null> {
    const userId = await this.get(`sso:${token}`);

    if (userId) {
      await this.del(`sso:${token}`);
    }

    return userId;
  }

  // ── Refresh token revocation ────────────────────────────

  async revokeRefreshToken(
    tokenId: string,
    ttlSeconds = 60 * 60 * 24 * 30,
  ): Promise<void> {
    await this.setex(`revoked:${tokenId}`, ttlSeconds, '1');
  }

  async isRefreshTokenRevoked(tokenId: string): Promise<boolean> {
    return this.exists(`revoked:${tokenId}`);
  }

  // ── Rate limiting ───────────────────────────────────────

  async checkRateLimit(
    key: string,
    limit: number,
    windowSecs: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.incr(key);

    if (current === 1) {
      await this.expire(key, windowSecs);
    }

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
    };
  }
}