import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../../../database/prisma.service";
import { RedisService } from "../../../database/redis.service";
import { CreateApiKeyDto } from "./api-key.dto";
import { ApiTier } from "@prisma/client";

const KEY_PREFIX = "bm_live_";

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Creates a new API key. The full key is returned exactly once — only its
   * SHA-256 hash and an 8-char display prefix are ever persisted.
   */
  async create(userId: string, dto: CreateApiKeyDto) {
    const secret = randomBytes(24).toString("base64url");
    const fullKey = `${KEY_PREFIX}${secret}`;
    const keyHash = createHash("sha256").update(fullKey).digest("hex");
    const displayPrefix = fullKey.slice(0, 8 + KEY_PREFIX.length);

    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        prefix: displayPrefix,
        scopes: dto.scopes,
        tier: ApiTier.STARTER,
        rateLimit: 1000,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return {
      id: record.id,
      key: fullKey, // shown ONCE — caller must persist it client-side
      prefix: record.prefix,
      scopes: record.scopes,
      tier: record.tier,
      rateLimit: record.rateLimit,
      createdAt: record.createdAt,
    };
  }

  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        tier: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return keys;
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException("API key not found");
    if (key.userId !== userId) throw new ForbiddenException("Not your API key");

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    // Bust the ApiKeyGuard cache immediately so revocation takes effect
    // without waiting out the 5-minute TTL.
    await this.redis.cacheDel(`apikey:meta:${updated.keyHash}`);

    return { revoked: true };
  }

  /** Used by GET /developer/keys/validate — req.apiKey is attached by ApiKeyGuard. */
  validate(apiKey: { scopes: string[]; tier: ApiTier }) {
    return { valid: true, scopes: apiKey.scopes, tier: apiKey.tier };
  }
}
