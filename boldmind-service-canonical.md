# boldmind-service — Canonical Reference

## Project Structure · Implementation Flow · Full API Documentation

### Aligned with `boldmind-system-design-v3.0.md` (Master Design, Unified, incl. v3.1 §27) | July 2026 | v1.3 (updated)

### Supersedes v1.2. Reconciled against

- `boldmind-service-live-routes.md` (live NestJS route snapshot, 2026‑07‑27)
- `boldmind-env-reconciliation-v1.md` (canonical env authority)
- `boldmind-shared-monorepo-v1.1.md` (canonical shared-package reference, updated for §27)
- Master Design v3.0 **Appendix B (§25)** and **§27 / Wave 7 / Checklist J** — both had drifted from v1.2

#### Stack: NestJS 10 · Prisma 6 · Node 22.22.3 · pnpm 10.34.1

> **v1.3 change summary — two real gaps found and closed:**
>
> 1. **§3 Redis & Queue reference implementation was stale and incorrectly marked "no drift."** v1.2 claimed this section was "re-verified against Appendix B, no drift," but Master Design v3.0's Appendix B (§25) was **rewritten wholesale** to fix a real production incident (clients silently defaulting to `127.0.0.1:6379`, root-caused and fixed 2026‑07‑15 — see new §4.6) and to expand `queues.ts` from 15 to 21 queues with a `JOBS` grouping object and per-queue default retry policy. This document's §3 now carries the hardened files in full, replacing the old simplified versions.
> 2. **§4 Known Issues did not cover the Social Media Management build (§27/Wave 7) or its unresolved placeholders.** Added §4.7/§4.8 flagging that `Workspace`/`BrandKit`/`SocialPost` have no corresponding Prisma migration in this repo yet (§1), and that several pieces of the tone/ad-copy system in Master Design §27 are documented as empty placeholders in the source and are not safe to wire into production.
> 3. §1 Project structure — added an explicit callout that no migration for the new §27.5 models exists yet (was previously silent on this).
> 4. §2 API Reference — unchanged in substance, added a note on the Social Media Manager/Ads Center endpoint gap (no live per-endpoint table exists for these two controllers the way it does for Wallet).
> 5. §5 Environment Variables — unchanged; confirmed no new env vars were introduced by §27.

---

## Table of Contents

- [1. Complete Project Structure](#1-complete-project-structure)
- [2. Full API Reference (Live Routes — Ground Truth)](#2-full-api-reference-live-routes--ground-truth)
- [3. Redis & Queue Reference Implementation (hardened, replaces v1.2)](#3-redis--queue-reference-implementation-hardened-replaces-v12)
- [4. Known Issues — Launch Blockers in This Repo](#4-known-issues--launch-blockers-in-this-repo)
- [5. Environment Variables — Canonical (Reconciled)](#5-environment-variables--canonical-reconciled)
- [6. New Prisma Models Pending Migration — Social Media Management (Wave 7)](#6-new-prisma-models-pending-migration--social-media-management-wave-7)

---

## 1. Complete Project Structure

**Note:** unchanged from v1.2 — confirmed against the live repo tree. **New in v1.3: flagging that this tree has no migration for the Workspace/BrandKit/SocialPost models introduced in Master Design v3.0 §27.5 — see §6.**

```text
boldmind-service
├─ .npmrc
├─ Dockerfile
├─ PLANAI-GES.md
├─ README.md
├─ TEST.TS
├─ boldmind-env-reconciliation-v1.md
├─ boldmind-service-canonical.md
├─ boldmind-service-live-routes.md
├─ boldmind-service-project-tree.md
├─ boldmind-system-design-v3.0.md
├─ nest-cli.json
├─ package.json
├─ pnpm-lock.yaml
├─ prisma
│  ├─ migrations
│  │  ├─ 20260312113544_new
│  │  ├─ 20260428153216_safeai_villagecirle
│  │  ├─ 20260428160307_viralkit
│  │  ├─ 20260612094453_hr_crm_contact
│  │  ├─ 20260621035316_wallet
│  │  ├─ 20260622220602_add_hr_enum
│  │  ├─ 20260711235234_user_update
│  │  ├─ 20260716183055_update_missing_columu
│  │  ├─ 20260725022003_add_school_management
│  │  └─ migration_lock.toml
│  │  ⚠️ NO migration for Workspace / BrandKit / SocialPost (§6) as of this snapshot —
│  │     if one lands after 2026-07-27 it will postdate this doc; verify before assuming shipped
│  ├─ schema.prisma
│  └─ seed.ts
├─ prisma.config.ts
├─ railway.toml
├─ redis setup.md
├─ src
│  ├─ app.module.ts
│  ├─ common/
│  │  ├─ constants/queues.ts          ← §3.2, hardened v3.1 version, 21 queues
│  │  ├─ decorators/
│  │  ├─ filters/http.exception.filter.ts
│  │  ├─ interceptors/
│  │  ├─ queues/queues.module.ts
│  │  └─ utils/slug.util.ts
│  ├─ database/
│  │  ├─ database.module.ts
│  │  ├─ prisma.service.ts
│  │  ├─ redis.service.ts             ← §3.1, hardened v3.1 version, synchronous constructor
│  │  └─ validate-env.ts
│  ├─ main.ts
│  ├─ modules/
│  │  ├─ admin/
│  │  ├─ ai/
│  │  ├─ amebogist/
│  │  ├─ analytics/
│  │  ├─ api/
│  │  ├─ auth/
│  │  ├─ automation/
│  │  ├─ educenter/
│  │  ├─ hub/
│  │  ├─ media/
│  │  ├─ notification/
│  │  ├─ payment/
│  │  ├─ planai/                       ← Social Media Manager / Ads Center controllers live here (§2.2); no BrandKit/SocialPost service yet (§6)
│  │  ├─ polymind/
│  │  ├─ user/
│  │  ├─ villagecircle/
│  │  └─ wallet/
│  └─ types/express-multer.d.ts
├─ tsconfig.build.json
├─ tsconfig.json
└─ upgrade.md
```

19 confirmed modules under `src/modules/` — see Master Design v3.0 §4 for the full controller/service inventory per module.

---

## 2. Full API Reference (Live Routes — Ground Truth)

**Base URL:** `https://api.boldmind.ng/api/v1`
**Auth header:** `Authorization: Bearer <jwt>` (15-min access token)
**API key header:** `X-API-Key: bm_live_xxxxxxxxxx` (enterprise/developer API only)

**Standard error shape:**

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-07-27T16:36:00.000Z",
  "path": "/api/v1/..."
}
```

**Standard paginated response:**

```json
{
  "data": [...],
  "total": 120,
  "page": 1,
  "pageSize": 20,
  "totalPages": 6,
  "hasNext": true,
  "hasPrev": false
}
```

> **Ground-truth policy (unchanged from v1.2, per Master Design v3.0 §6.1):** the live route snapshot (`boldmind-service-live-routes.md`, generated 2026‑07‑27) is authoritative for anything currently running. Full per-group endpoint tables live in that companion doc; this section carries forward the reconciliation summary and flags drift.

### 2.1 Designed-vs-Live Drift (unchanged from v1.2, resolve before trusting either blindly)

| Area                                         | Previously documented (stale)                                                               | Actually live                                                                                                                                                                                                               | Status                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment init                                 | `POST /payment/initiate`                                                                    | `POST /payment/initialize`                                                                                                                                                                                                  | **Fixed in this doc** — use `/payment/initialize`                                                                                              |
| Amebogist controller/paths                   | `AmebogistController` at `/amebogist/posts`, `/amebogist/posts/:slug`                       | `ContentController` at `/amebogist/articles`, `/amebogist/articles/:slug`, plus live-only additions: `/amebogist/search`, `/amebogist/articles/generate-ai`, `/amebogist/articles/:id/video-factory`, `/amebogist/me/stats` | **Fixed in this doc** — live naming (`articles`) is more feature-rich; adopted below                                                           |
| EduCenter session flow                       | `/educenter/sessions`, `/educenter/sessions/:id/answer`, `/educenter/sessions/:id/complete` | `/educenter/cbt/start`, `/educenter/cbt/:sessionId/submit`, `/educenter/cbt/:sessionId/abandon`, `/educenter/cbt/:sessionId/review` (`/educenter/sessions` now list-only, for history)                                      | **Fixed in this doc** — `cbt/*` naming adopted for the exam flow                                                                               |
| VibeCoders prefix                            | `/villagecircle/vibecoders/portal/*`                                                        | `/vibecoders/*` (no `villagecircle` prefix)                                                                                                                                                                                 | **Fixed in this doc** — live prefix adopted; confirm this is intentional and not accidental drift, since the "portal" sub-path also disappears |
| Auth extras                                  | not previously documented                                                                   | `/auth/login/verify-2fa`, `/auth/change-password`, `/auth/users/:id/role`                                                                                                                                                   | **Added**                                                                                                                                      |
| Hub extras                                   | not previously documented                                                                   | `/hub/pricing`, `/hub/team`, `/hub/team/invite`, `/hub/team/:userId`, `/hub/stats`                                                                                                                                          | **Added**                                                                                                                                      |
| Users extras                                 | not previously documented                                                                   | `/users/dashboard`, `/users/:id/profile` (admin override), `/users/onboarding`, `/users/me/products`, `/users/me/onboarding`                                                                                                | **Added**                                                                                                                                      |
| Media extras                                 | not previously documented                                                                   | `/media/upload/batch`, `/media/presign`, `/media/admin/all`                                                                                                                                                                 | **Added**                                                                                                                                      |
| Notifications extras                         | not previously documented                                                                   | `/notifications` (list), `/notifications/read`, `/notifications/:id` (delete), `/notifications/push/user`, `/notifications/broadcast/push`, `/notifications/broadcast/email`                                                | **Added**                                                                                                                                      |
| Business Directory                           | not previously documented at all                                                            | `BizDirectoryController` at `/planai/directory/*`, Hunter.io-backed `verify-email` + `intent-signals`                                                                                                                       | **Added** — confirms `HUNTER_IO_API_KEY` (§5) is real and in active use                                                                        |
| Developer/Enterprise API, Webhooks, PolyMind | previously listed as "to create"                                                            | **All confirmed live** — `/developer/keys/*`, `/public/*`, `/developer/webhooks/*`, `/polymind/:provider`, `/polymind/history`                                                                                              | **Status corrected** — these already shipped, not roadmap items                                                                                |

**New in v1.3 — flagged, not a fix (no live snapshot data available yet):**

| Area                                                                 | What we know                                                  | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Social Media Manager (`/planai/social`) / Ads Center (`/planai/ads`) | Both controllers are confirmed present in §2.2's group index. | Unlike Wallet (§2.2 below has a full 4-line endpoint list) or LMS/School (Master Design §12), **no per-endpoint table exists for these two controllers** in either this doc or the live-routes snapshot. `BrandKit`/`SocialPost` CRUD, scheduling, and `AdCopyGenerator`-backed endpoints described in Master Design §27.4/§27.8 have no confirmed live paths. Do not assume method names/paths — pull the actual live-routes snapshot for `/planai/social/*` and `/planai/ads/*` before building a client against them. See also `boldmind-shared-monorepo-v1.1.md` §2.4, which flags the same gap on the `api-client` side. |

### 2.2 Live Route Groups

The following controllers are confirmed live as of the 2026‑07‑27 snapshot. Full per-endpoint tables (method, path, auth, description) live in `boldmind-service-live-routes.md` — attach that doc alongside this one when generating client code. Group index:

| Group                         | Controller                  | Prefix                                                         |
| ----------------------------- | --------------------------- | -------------------------------------------------------------- |
| Auth                          | `AuthController`            | `/auth`                                                        |
| SSO                           | `SsoController`             | `/sso`                                                         |
| Users (Admin)                 | `UserController`            | `/users`                                                       |
| Users (Me)                    | `UserMeController`          | `/users/me`                                                    |
| Payments                      | `PaymentController`         | `/payment`                                                     |
| PlanAI Suite (shell)          | `PlanAISuiteController`     | `/planai`                                                      |
| Social Media Manager          | `SocialMediaController`     | `/planai/social` ⚠️ no per-endpoint table yet, see 2.1         |
| Ads Center                    | `AdsCenterController`       | `/planai/ads` ⚠️ no per-endpoint table yet, see 2.1            |
| Brand & Digital Home          | `BrandHomeController`       | `/planai/brand`                                                |
| Business Intelligence         | `BizIntelController`        | `/planai/intelligence`                                         |
| Investor Readiness            | `InvestorKitController`     | `/planai/investor`                                             |
| Marketing Automation          | `MarketingAutoController`   | `/planai/marketing`                                            |
| Business Directory            | `BizDirectoryController`    | `/planai/directory`                                            |
| AI Business Agent             | `BizAgentController`        | `/planai/agent`                                                |
| Project Manager               | `ProjectManagerController`  | `/planai/projects`                                             |
| CRM & Client Management       | `PlanCRMController`         | `/planai/crm`                                                  |
| HR & Payroll                  | `HRPayrollController`       | `/planai/hr`                                                   |
| Fitness Center                | `FitnessCenterController`   | `/planai/fitness`                                              |
| Marketplace                   | `MarketplaceController`     | `/planai/marketplace`                                          |
| AmeboGist (Content)           | `ContentController`         | `/amebogist`                                                   |
| EduCenter                     | `EduCenterController`       | `/educenter`                                                   |
| LMS Builder                   | `LmsController`             | `/educenter/lms`                                               |
| School Portal                 | `SchoolController`          | `/educenter/schools`                                           |
| Automation                    | `AutomationController`      | `/automation`                                                  |
| Media                         | `MediaController`           | `/media`                                                       |
| Notifications                 | `NotificationController`    | `/notifications`                                               |
| Admin                         | `AdminController`           | `/admin`                                                       |
| Health                        | `HealthController`          | `/health`                                                      |
| Wallet                        | `WalletController`          | `/wallet`                                                      |
| Hub                           | `HubController`             | `/hub`                                                         |
| ReceiptGenius                 | `ReceiptGeniusController`   | `/villagecircle/receiptgenius`                                 |
| KoloAI                        | `KoloAiController`          | `/villagecircle/kolo-ai`                                       |
| NaijaGig                      | `NaijaGigController`        | `/villagecircle/naijagig`                                      |
| Skill2Cash                    | `Skill2CashController`      | `/villagecircle/skill2cash`                                    |
| FarmGate                      | `FarmgateController`        | `/villagecircle/farmgate`                                      |
| AfroHustle                    | `AfroHustleController`      | `/villagecircle/afrohustle`                                    |
| BorderlessRemit               | `BorderlessRemitController` | `/villagecircle/borderless-remit`                              |
| SafeAI                        | `SafeAiController`          | `/villagecircle/safeai`                                        |
| VibeCoders                    | `VibeCodersController`      | `/vibecoders` _(no `/villagecircle` prefix — see drift table)_ |
| Waitlist (concept catch-alls) | `WaitlistController`        | `/villagecircle/{afrocopy-ai,anontruth-mic,power-alert}/*`     |
| Developer API Keys            | `ApiKeyController`          | `/developer/keys`                                              |
| Public Enterprise API         | `EnterpriseController`      | `/public`                                                      |
| Webhooks                      | `WebhookController`         | `/developer/webhooks`                                          |
| PolyMind Proxy                | `PolymindController`        | `/polymind`                                                    |

**Wallet — live endpoints (confirmed deployed, unchanged):**

```text
GET  /api/v1/wallet                → balance + tier + lock status
GET  /api/v1/wallet/ledger         → paginated transaction history
POST /api/v1/wallet/topup/initiate → Paystack top-up init
POST /api/v1/wallet/upgrade        → upgrade to Tier 2 with BVN hash
```

Internal-only (not HTTP routes, called from other services): `wallet.credit(...)`, `wallet.debit(...)`. Trigger points: `payment.service.ts` (`charge.success` webhook, `productSlug=wallet-topup` only — **see §4.3, not yet wired**), `user.service.ts` (referral conversion), `admin.service.ts` (manual credit), `marketplace.service.ts` (seller payout).

**PolyMind — response shape (unchanged):**

```typescript
interface PolyMindResponse {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
}
```

**Developer scopes map (unchanged, all confirmed live):**

```text
amebogist:read           educenter:questions        educenter:submit
planai:social:generate   planai:branding:logo       villagecircle:waitlist
users:profile:read       payments:verify             polymind:query
webhook:subscribe
```

Note: `planai:social:generate` scope already exists and is live — it predates and is distinct from the Wave 7 workspace-level `BrandKit`/`SocialPost` build (§6). The scope covers AI caption/copy generation today; it does not imply the scheduling/publishing pipeline is done.

**Outgoing webhook events:** `payment.success`, `payment.failed`, `subscription.activated`, `subscription.cancelled`, `article.published`, `user.registered`, `vibecoders.applicant.applied`.

---

## 3. Redis & Queue Reference Implementation (hardened, replaces v1.2)

> **This entire section is new content as of v1.3.** v1.2 carried forward a simplified, illustrative version of `redis.service.ts`/`queues.ts` and incorrectly labeled it "no drift" against Master Design v3.0 Appendix B. Appendix B was in fact rewritten wholesale in the master design to fix a real production incident. **Copy the files below in full — do not hand-merge with the old v1.2 versions.**

### 3.0 What changed and why (incident writeup, informational — already fixed in code)

On 2026‑07‑15, Redis clients were intermittently connecting to `127.0.0.1:6379` instead of the configured `REDIS_*_URL` hosts.

**Root cause:** the three `Redis` clients were being constructed inside an async `onModuleInit()` using `lazyConnect: true` + `await client.connect()`. Nest resolves `useFactory` dependency injection (e.g. `BullModule.forRootAsync`'s `inject: [RedisService]` → `connection: redis.queue`) while building the provider graph — **before** any `onModuleInit()` hook runs anywhere in the app. `redis.queue` was therefore still `undefined` at the moment BullMQ read it, so ioredis silently fell back to its hardcoded default.

**Fix:** construct all three clients synchronously in the constructor (§3.1 below). Nest always finishes running a provider's constructor before that provider can be injected anywhere else, so `session`/`queue`/`cache` are guaranteed to be real Redis instances the moment anything else asks for them.

**No action needed** unless `redis.service.ts` is ever reverted to construct clients inside `onModuleInit()` — if that happens, this incident will recur. Treat this as a permanent constraint on this file, not a one-time fix.

### 3.1 `src/database/redis.service.ts` — Complete File (hardened)

```typescript
import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * RedisService — Three-instance split
 * ─────────────────────────────────────────────────────────────────────────────
 * SESSION  → SSO relay tokens, JWT refresh family revocation, OTP codes,
 *            rate-limit counters, feature flags
 *            env: REDIS_SESSION_URL
 *
 * QUEUE    → BullMQ exclusively (passed to BullModule.forRootAsync)
 *            env: REDIS_QUEUE_URL
 *
 * CACHE    → ALOC exam questions, exchange rates, trend data, computed stats
 *            eviction: allkeys-lru  |  no persistence
 *            env: REDIS_CACHE_URL
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INCIDENT FIX (2026-07-15) — see §3.0. Clients are built synchronously in the
 * constructor, never inside onModuleInit. Connection itself is still async in
 * the background (ioredis default lazyConnect: false connects immediately
 * without blocking the constructor) — BullMQ, session ops, and cache ops all
 * internally queue commands until the socket is ready, so this does not stall
 * bootstrap.
 *
 * Retained resilience characteristics:
 *   1. Exponential backoff w/ jitter, capped at 10s, never gives up.
 *   2. `family: 0` — Happy Eyeballs (IPv4 + IPv6) for Railway/Upstash
 *      endpoints that intermittently resolve unroutable AAAA records.
 *   3. `keepAlive: 30_000` — prevents managed-Redis load balancers from
 *      silently dropping idle sockets (which otherwise surfaces as a
 *      confusing ECONNRESET on the next command).
 *   4. `connectTimeout: 10_000` — bounds half-open TCP connects.
 *   5. `reconnectOnError` distinguishes READONLY/CLUSTERDOWN (retry) from
 *      NOAUTH/WRONGPASS (surface immediately, do not hot-loop).
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** Auth, SSO, OTP, rate-limit — persistence: AOF, policy: noeviction */
  public readonly session: Redis;

  /** BullMQ only — persistence: RDB, policy: noeviction */
  public readonly queue: Redis;

  /** Short-lived computed data — no persistence, policy: allkeys-lru */
  public readonly cache: Redis;

  /**
   * Resolves once all three clients have fired `ready`. Optional — nothing
   * in the DI graph needs to await this (commands are queued internally by
   * ioredis until ready), but main.ts can await it before calling
   * `app.listen()` if you want a hard guarantee before accepting traffic.
   */
  public readonly whenReady: Promise<void>;

  constructor(private readonly config: ConfigService) {
    this.session = this.createClient("REDIS_SESSION_URL", "session", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = this.createClient("REDIS_QUEUE_URL", "queue", {
      // Required by BullMQ — do not change.
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.cache = this.createClient("REDIS_CACHE_URL", "cache", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

    this.whenReady = Promise.all([
      this.onceReady(this.session, "session"),
      this.onceReady(this.queue, "queue"),
      this.onceReady(this.cache, "cache"),
    ]).then(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.session?.quit(),
      this.queue?.quit(),
      this.cache?.quit(),
    ]);
  }

  // ─── Private: client factory ────────────────────────────────────────────────

  private createClient(
    envKey: string,
    label: string,
    options: Record<string, unknown>,
  ): Redis {
    let url = this.config.getOrThrow<string>(envKey);

    // Strip CLI-style flags that may have crept into env values, e.g. "-u rediss://..."
    if (url.includes("-u ")) {
      url = url.split("-u ")[1].split(" ")[0];
    }
    url = url.trim();

    const tlsRequired =
      url.startsWith("rediss://") || url.includes(".upstash.io");

    let consecutiveFailures = 0;

    const client = new Redis(url, {
      ...options,
      ...(tlsRequired ? { tls: { rejectUnauthorized: false } } : {}),

      // ── Network resilience ────────────────────────────────────────────────
      family: 0,
      connectTimeout: 10_000,
      keepAlive: 30_000,
      noDelay: true,

      retryStrategy: (times: number) => {
        consecutiveFailures = times;
        const base = Math.min(times * 200, 10_000);
        const jitter = Math.floor(Math.random() * 300);
        const delay = base + jitter;

        if (times % 5 === 0) {
          this.logger.warn(
            `Redis [${label}] still reconnecting after ${times} attempts (next retry in ${delay}ms)`,
          );
        }
        return delay;
      },

      reconnectOnError: (err: Error) => {
        const msg = err.message || "";
        if (msg.includes("READONLY") || msg.includes("CLUSTERDOWN")) {
          return true;
        }
        if (msg.includes("NOAUTH") || msg.includes("WRONGPASS")) {
          this.logger.error(
            `Redis [${label}] auth error — check ${envKey}: ${msg}`,
          );
          return false;
        }
        return true;
      },
    });

    client.on("connect", () => {
      this.logger.log(`Redis [${label}] TCP connected`);
    });
    client.on("ready", () => {
      if (consecutiveFailures > 0) {
        this.logger.log(
          `Redis [${label}] ready after ${consecutiveFailures} retries — connection recovered`,
        );
      } else {
        this.logger.log(`Redis [${label}] ready`);
      }
      consecutiveFailures = 0;
    });
    client.on("error", (err) => {
      this.logger.error(`Redis [${label}] error: ${err.message}`);
    });
    client.on("close", () => {
      this.logger.warn(`Redis [${label}] connection closed`);
    });
    client.on("reconnecting", (delay: number) => {
      this.logger.debug?.(`Redis [${label}] reconnecting in ${delay}ms`);
    });
    client.on("end", () => {
      this.logger.error(
        `Redis [${label}] connection ended — no more automatic reconnects will occur`,
      );
    });

    return client;
  }

  private onceReady(client: Redis, label: string): Promise<void> {
    if (client.status === "ready") return Promise.resolve();
    return new Promise((resolve) => {
      client.once("ready", () => resolve());
      setTimeout(() => {
        if (client.status !== "ready") {
          this.logger.warn(
            `Redis [${label}] not ready after 15s — continuing bootstrap; retries continue in background`,
          );
        }
        resolve();
      }, 15_000);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION INSTANCE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  async get(key: string): Promise<string | null> {
    return this.session.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.session.setex(key, ttlSeconds, value);
    } else {
      await this.session.set(key, value);
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.session.setex(key, ttlSeconds, value);
  }

  async del(...keys: string[]): Promise<void> {
    await this.session.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.session.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    return this.session.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.session.expire(key, ttlSeconds);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.session.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.session.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.session.hgetall(key);
  }

  /**
   * SCAN-based key listing — avoids KEYS blocking the event loop on the
   * shared Redis instance under production load. Prefer this over `keys()`.
   */
  async scanKeys(pattern: string, count = 100): Promise<string[]> {
    const found: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await this.session.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        count,
      );
      cursor = nextCursor;
      found.push(...batch);
    } while (cursor !== "0");
    return found;
  }

  /** @deprecated Prefer scanKeys() — KEYS blocks the Redis event loop under load. */
  async keys(pattern: string): Promise<string[]> {
    return this.session.keys(pattern);
  }

  // ─── SSO relay tokens (session) ─────────────────────────────────────────────

  async storeSSOToken(
    token: string,
    userId: string,
    ttlSeconds = 60,
  ): Promise<void> {
    await this.session.setex(`sso:relay:${token}`, ttlSeconds, userId);
  }

  async consumeSSOToken(token: string): Promise<string | null> {
    const key = `sso:relay:${token}`;
    const result = (await this.session.eval(
      `local v = redis.call("GET", KEYS[1])
       if v then redis.call("DEL", KEYS[1]) end
       return v`,
      1,
      key,
    )) as string | null;
    return result;
  }

  // ─── JWT refresh token revocation (session) ─────────────────────────────────

  async revokeRefreshToken(
    tokenId: string,
    ttlSeconds = 60 * 60 * 24 * 30,
  ): Promise<void> {
    await this.session.setex(`revoked:${tokenId}`, ttlSeconds, "1");
  }

  async isRefreshTokenRevoked(tokenId: string): Promise<boolean> {
    return (await this.session.exists(`revoked:${tokenId}`)) === 1;
  }

  // ─── OTP storage (session) ──────────────────────────────────────────────────

  async storeOTP(
    purpose: string,
    recipient: string,
    hashedCode: string,
    ttlSeconds = 900,
  ): Promise<void> {
    await this.session.setex(
      `otp:${purpose}:${recipient}`,
      ttlSeconds,
      hashedCode,
    );
  }

  async getOTP(purpose: string, recipient: string): Promise<string | null> {
    return this.session.get(`otp:${purpose}:${recipient}`);
  }

  async deleteOTP(purpose: string, recipient: string): Promise<void> {
    await this.session.del(`otp:${purpose}:${recipient}`);
  }

  // ─── Rate limiting (session) ────────────────────────────────────────────────

  async checkRateLimit(
    key: string,
    limit: number,
    windowSecs: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.session.incr(key);
    if (current === 1) {
      await this.session.expire(key, windowSecs);
    }
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
    };
  }

  // ─── Feature flags (session) ────────────────────────────────────────────────

  async getFeatureFlags(
    userId: string,
  ): Promise<Record<string, string> | null> {
    const data = await this.session.get(`flags:${userId}`);
    return data ? (JSON.parse(data) as Record<string, string>) : null;
  }

  async setFeatureFlags(
    userId: string,
    flags: Record<string, string>,
    ttlSeconds = 300,
  ): Promise<void> {
    await this.session.setex(
      `flags:${userId}`,
      ttlSeconds,
      JSON.stringify(flags),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE INSTANCE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  async cacheGet(key: string): Promise<string | null> {
    return this.cache.get(key);
  }

  async cacheSet(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.cache.setex(key, ttlSeconds, value);
  }

  async cacheDel(key: string): Promise<void> {
    await this.cache.del(key);
  }

  /**
   * withCache<T>() — read-through helper for the CACHE instance.
   */
  async withCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const data = await fetchFn();
    await this.cache.setex(key, ttlSeconds, JSON.stringify(data));
    return data;
  }

  /** @deprecated Use withCache() instead. */
  async cachet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    return this.withCache(key, fetchFn, ttlSeconds);
  }

  async getAlocQuestions(
    subject: string,
    examType: string,
    year: number | "all",
  ): Promise<unknown[] | null> {
    const raw = await this.cache.get(`aloc:${subject}:${examType}:${year}`);
    return raw ? (JSON.parse(raw) as unknown[]) : null;
  }

  async setAlocQuestions(
    subject: string,
    examType: string,
    year: number | "all",
    questions: unknown[],
  ): Promise<void> {
    await this.cache.setex(
      `aloc:${subject}:${examType}:${year}`,
      86400,
      JSON.stringify(questions),
    );
  }

  async getExchangeRate(currency: string): Promise<unknown | null> {
    const raw = await this.cache.get(`remit:rates:${currency}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setExchangeRate(currency: string, data: unknown): Promise<void> {
    await this.cache.setex(
      `remit:rates:${currency}`,
      3600,
      JSON.stringify(data),
    );
  }

  async getTrends(date: string): Promise<unknown | null> {
    const raw = await this.cache.get(`trends:ng:${date}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setTrends(date: string, data: unknown): Promise<void> {
    await this.cache.setex(`trends:ng:${date}`, 7200, JSON.stringify(data));
  }

  async getPlanAIAccess(userId: string): Promise<string[] | null> {
    const raw = await this.cache.get(`planai:access:${userId}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  }

  async setPlanAIAccess(userId: string, slugs: string[]): Promise<void> {
    await this.cache.setex(
      `planai:access:${userId}`,
      300,
      JSON.stringify(slugs),
    );
  }

  async invalidatePlanAIAccess(userId: string): Promise<void> {
    await this.cache.del(`planai:access:${userId}`);
  }

  async getAdminStats(date: string): Promise<unknown | null> {
    const raw = await this.cache.get(`admin:stats:${date}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setAdminStats(date: string, data: unknown): Promise<void> {
    await this.cache.setex(`admin:stats:${date}`, 900, JSON.stringify(data));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK — backs GET /health
  // ═══════════════════════════════════════════════════════════════════════════

  async health(): Promise<{
    session: "up" | "down";
    queue: "up" | "down";
    cache: "up" | "down";
  }> {
    const ping = async (client: Redis): Promise<"up" | "down"> => {
      try {
        const pong = await client.ping();
        return pong === "PONG" ? "up" : "down";
      } catch {
        return "down";
      }
    };

    const [session, queue, cache] = await Promise.all([
      ping(this.session),
      ping(this.queue),
      ping(this.cache),
    ]);

    return { session, queue, cache };
  }
}
```

```typescript
// src/app.module.ts — BullMQ uses QUEUE redis only (unchanged)
BullModule.forRootAsync({
  inject:      [RedisService],
  useFactory:  (redis: RedisService) => ({
    connection: redis.queue,   // ← QUEUE instance ONLY
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail:     { age: 7 * 24 * 3600 },
    },
  }),
}),
```

### 3.2 `src/common/constants/queues.ts` — Complete File (expanded, 15 → 21 queues)

> **New in v1.3:** the v1.2 version of this file had 15 queues. Master Design v3.0 confirmed 6 more were already registered in the running app (`MARKETING_AUTOMATION`, `NOTIFICATIONS_DISPATCH`, `SOCIAL_FACTORY`, `VIDEO_RENDER`, `CONTENT_SEO`, `CONTENT_PROCESSING`, `AI_AGENT_TASKS` — 7, not 6) but two of them (`NOTIFICATIONS_DISPATCH`, `CONTENT_PROCESSING`) have **no confirmed consumer** — see §4.7. This file also adds a `JOBS` object (job names grouped by domain, not by queue, to prevent name collisions) and `QUEUE_DEFAULT_JOB_OPTIONS` as the single source of truth for retry/backoff policy, replacing the old pattern of setting `{ attempts, backoff }` inline at each `queue.add()` call site.

```typescript
// src/common/constants/queues.ts
//
// SINGLE SOURCE OF TRUTH for every BullMQ queue + job name in boldmind-service.
// Nothing outside this file should contain a literal queue-name or job-name string.

import type { JobsOptions } from "bullmq";

export const QUEUES = {
  // ── Communication ──────────────────────────────────────────────
  EMAIL_NOTIFICATIONS: "email-notifications",
  MARKETING_AUTOMATION: "marketing-automation",
  PUSH_NOTIFICATIONS: "push-notifications",
  SMS_OTP: "sms-otp",
  NOTIFICATIONS_DISPATCH: "notifications", // VERIFY — see §4.7

  // ── Content & Social ───────────────────────────────────────────
  SOCIAL_PUBLISHING: "social-publishing",
  AI_GENERATION: "ai-generation",
  IMAGE_GENERATION: "image-generation",
  SOCIAL_FACTORY: "social-factory",
  VIDEO_RENDER: "video-render",
  CONTENT_SEO: "content-seo",
  CONTENT_PROCESSING: "content", // VERIFY — see §4.7

  // ── Business Operations ────────────────────────────────────────
  PAYROLL_PROCESSING: "payroll-processing",
  MEDIA_PROCESSING: "media-processing",
  AI_AGENT_TASKS: "ai-agent-tasks",

  // ── Payments & Wallet ──────────────────────────────────────────
  PAYMENT_WEBHOOK: "payment-webhook",
  WALLET_CREDIT: "wallet-credit",

  // ── Background Intelligence ────────────────────────────────────
  TREND_ANALYSIS: "trend-analysis",
  KOLO_REMINDERS: "kolo-reminders",

  // ── Enterprise & Extensions ────────────────────────────────────
  POLYMIND_QUERY: "polymind-query",
  WEBHOOK_DELIVERY: "webhook-delivery",

  // ── Data Hygiene ───────────────────────────────────────────────
  NDPA_ERASURE: "ndpa-erasure",
  SEO_SITEMAP: "seo-sitemap",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  EMAIL: {
    SEND_BATCH: "send-batch",
    EXPIRY_REMINDER: "expiry-reminder",
    BROADCAST: "broadcast-email",
  },
  PUSH: {
    BROADCAST: "broadcast-push",
  },
  SOCIAL: {
    POST: "post",
  },
  AI: {
    EMAIL_SCRAPE: "email-scrape",
  },
  AGENT: {
    TASK: "agent-task", // taskType lives in job.data, not job.name
  },
} as const;

export const QUEUE_PRIORITIES: Record<QueueName, number> = {
  [QUEUES.PAYMENT_WEBHOOK]: 1,
  [QUEUES.WALLET_CREDIT]: 2,
  [QUEUES.SMS_OTP]: 2,
  [QUEUES.PAYROLL_PROCESSING]: 3,
  [QUEUES.AI_AGENT_TASKS]: 4,
  [QUEUES.MARKETING_AUTOMATION]: 5,
  [QUEUES.NOTIFICATIONS_DISPATCH]: 5, // VERIFY
  [QUEUES.CONTENT_PROCESSING]: 6, // VERIFY
  [QUEUES.EMAIL_NOTIFICATIONS]: 5,
  [QUEUES.PUSH_NOTIFICATIONS]: 5,
  [QUEUES.SOCIAL_PUBLISHING]: 5,
  [QUEUES.AI_GENERATION]: 5,
  [QUEUES.IMAGE_GENERATION]: 5,
  [QUEUES.SOCIAL_FACTORY]: 5, // VERIFY
  [QUEUES.VIDEO_RENDER]: 5, // VERIFY
  [QUEUES.CONTENT_SEO]: 7, // VERIFY
  [QUEUES.MEDIA_PROCESSING]: 5,
  [QUEUES.KOLO_REMINDERS]: 5,
  [QUEUES.POLYMIND_QUERY]: 5,
  [QUEUES.WEBHOOK_DELIVERY]: 5,
  [QUEUES.TREND_ANALYSIS]: 8,
  [QUEUES.SEO_SITEMAP]: 9,
  [QUEUES.NDPA_ERASURE]: 9,
};

export const QUEUE_DEFAULT_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  [QUEUES.PAYMENT_WEBHOOK]: {
    attempts: 5,
    backoff: { type: "fixed", delay: 10_000 },
  },
  [QUEUES.WALLET_CREDIT]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
  },
  [QUEUES.SMS_OTP]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3_000 },
  },
  [QUEUES.PAYROLL_PROCESSING]: { attempts: 1 },
  [QUEUES.AI_AGENT_TASKS]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
  [QUEUES.MARKETING_AUTOMATION]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
  [QUEUES.EMAIL_NOTIFICATIONS]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
  [QUEUES.PUSH_NOTIFICATIONS]: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
  [QUEUES.SOCIAL_PUBLISHING]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
  },
  [QUEUES.AI_GENERATION]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 4_000 },
  },
  [QUEUES.NOTIFICATIONS_DISPATCH]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3_000 },
  }, // VERIFY
  [QUEUES.CONTENT_PROCESSING]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
  }, // VERIFY
  [QUEUES.IMAGE_GENERATION]: { attempts: 1 },
  [QUEUES.SOCIAL_FACTORY]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 4_000 },
  }, // VERIFY
  [QUEUES.VIDEO_RENDER]: { attempts: 1 }, // VERIFY
  [QUEUES.CONTENT_SEO]: { attempts: 1 }, // VERIFY
  [QUEUES.MEDIA_PROCESSING]: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3_000 },
  },
  [QUEUES.TREND_ANALYSIS]: { attempts: 1 },
  [QUEUES.KOLO_REMINDERS]: { attempts: 1 },
  [QUEUES.POLYMIND_QUERY]: { attempts: 1 },
  [QUEUES.WEBHOOK_DELIVERY]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 4_000 },
  },
  [QUEUES.NDPA_ERASURE]: { attempts: 1 },
  [QUEUES.SEO_SITEMAP]: { attempts: 1 },
};
```

**Queue-to-processor map (unchanged content, now covering all 21 queues):**

| Queue                      | Processor                                             | Notes                                                               |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| `email-notifications`      | `automation/queue/email-campaign.processor.ts`        | Via Resend                                                          |
| `sms-otp`                  | `notification/notification.service.ts`                | **Missing processor — see §4.4**                                    |
| `push-notifications`       | `notification/processors/push-broadcast.processor.ts` | Confirmed live                                                      |
| `marketing-automation`     | _(processor TBD)_                                     | Confirmed registered, processor not yet located                     |
| `notifications` (dispatch) | _(no confirmed consumer)_                             | **VERIFY — §4.7**                                                   |
| `social-publishing`        | `automation/queue/social-post.processor.ts`           | Delayed jobs, job name `post`                                       |
| `ai-generation`            | `automation/queue/ai-jobs.processor.ts`               | Job name `email-scrape` (Business Discovery)                        |
| `image-generation`         | `ai/processors/social-factory.processor.ts`           | fal.ai → DALL-E                                                     |
| `social-factory`           | _(processor TBD)_                                     | **VERIFY** — may overlap with `image-generation`, §4.7              |
| `video-render`             | _(processor TBD)_                                     | **VERIFY**                                                          |
| `content-seo`              | _(processor TBD)_                                     | **VERIFY**                                                          |
| `content` (processing)     | _(no confirmed consumer)_                             | **VERIFY — §4.7**, possibly `rss.service.ts`/`amebogist.service.ts` |
| `payroll-processing`       | `planai/processors/planai.processor.ts`               | Idempotent, `attempts: 1`                                           |
| `media-processing`         | `media/media.service.ts`                              | R2 upload + scan                                                    |
| `ai-agent-tasks`           | _(processor TBD — BizAgentTaskProcessor)_             | Job name `agent-task` — `taskType` in `job.data`                    |
| `payment-webhook`          | `payment/payment.service.ts`                          | Paystack retries 72hr — **wallet credit not wired here yet, §4.3**  |
| `wallet-credit`            | `wallet/wallet.service.ts`                            | Must succeed                                                        |
| `trend-analysis`           | `ai/services/trend.service.ts`                        | Cron every 2h                                                       |
| `kolo-reminders`           | `villagecircle/kolo-ai/kolo-ai.service.ts`            | WhatsApp reminders                                                  |
| `polymind-query`           | `polymind/polymind.service.ts`                        | Fan-out AI calls                                                    |
| `webhook-delivery`         | `api/webhook-delivery.service.ts`                     | Enterprise webhooks                                                 |
| `ndpa-erasure`             | `user/user.service.ts`                                | Cron: daily                                                         |
| `seo-sitemap`              | `amebogist/rss.service.ts`                            | Cron: nightly                                                       |

**Before relying on the VERIFY rows:** open `notification.service.ts` (for `notifications`/dispatch) and `amebogist.service.ts` + `rss.service.ts` (for `content`/processing) and confirm whether these queues have live consumers or are dead registrations from an earlier refactor. Don't delete them from `queues.ts` without that confirmation — a queue with jobs already sitting in Redis that gets un-registered will silently orphan those jobs.

---

## 4. Known Issues — Launch Blockers in This Repo

### 4.1 Google OAuth Double-Call Bug — `auth.controller.ts` (BLOCKING, unresolved)

```typescript
// ❌ CURRENT (BUG — wrong args on the second call):
const relayToken = await this.ssoService.createRelayToken(user.id, accessToken);
const relayUrl = await this.ssoService.createRelayToken(returnUrl, relayToken); // ← WRONG

// ✅ FIX — use buildSsoRelayUrl instead:
const relayUrl = await this.ssoService.buildSsoRelayUrl(
  user.id,
  accessToken,
  returnUrl,
  {}, // empty UTM on OAuth redirect
);
return res.redirect(relayUrl);
```

Affects `GET /auth/google/callback`. Do not ship Google OAuth cross-domain redirects until this is fixed.

### 4.2 `kolo-ai/translation.schema.ts` — Probable Misnaming (unresolved)

```text
Current file: src/modules/villagecircle/kolo-ai/translation.schema.ts
Expected:     src/modules/villagecircle/kolo-ai/kolo-group.schema.ts
```

Rename when building/touching the KoloAI feature; update the import in `kolo-ai.module.ts`.

### 4.3 Wallet credit not wired to Paystack webhook (unresolved)

`payment.service.ts` needs `walletService.credit()` invoked on `charge.success`, scoped to `productSlug='wallet-topup'` only — must not fire for ordinary subscription payments.

### 4.4 SMS OTP queue processor missing (unresolved)

`notification.service.ts` needs a `sms-otp` BullMQ processor implemented using `@boldmindng/sms`'s `OTPService` (WhatsApp → Termii → email order, per Master Design v3.0 §11).

### 4.5 Live-routes drift (tracked, see §2.1)

Multiple designed-vs-live naming mismatches — resolved in this document's route tables (§2), but the underlying `boldmind-service-canonical-api-reference.md` companion doc referenced by Master Design v3.0 §6.1 should also be updated to match, since it's still the source of the "designed contract" language.

### 4.6 Redis `127.0.0.1:6379` incident (informational — fixed in code, no action needed unless reverted)

See §3.0 for the full root-cause writeup. Resolved by the constructor-based client instantiation in §3.1. Listed here so it isn't lost from the known-issues history — if anyone reintroduces `onModuleInit()`-based Redis client construction, this incident will recur silently (BullMQ jobs would appear to enqueue successfully against a local dev Redis that doesn't exist in production, then simply never process).

### 4.7 Queue registrations without confirmed consumers (new in v1.3)

`notifications` (dispatch, `QUEUES.NOTIFICATIONS_DISPATCH`) and `content` (processing, `QUEUES.CONTENT_PROCESSING`) are both registered in `queues.ts` (§3.2) but have no `@Processor` class currently visible consuming them. Additionally, `social-factory`, `video-render`, `content-seo`, and `ai-agent-tasks` have registered queues/priorities/job-options but their processor files are marked "TBD" in §3.2's map — confirm each exists before assuming jobs pushed to these queues will actually run. Resolve before assuming any of these are safe to remove (a queue with jobs already sitting in Redis that gets un-registered will silently orphan those jobs) or safe to build new features against.

### 4.8 Social Media Management (Wave 7) — no migration, and source-doc placeholders unresolved (new in v1.3)

Two separate gaps, both blocking Master Design v3.0 §27/Wave 7:

1. **No Prisma migration exists yet** for `Workspace`, `BrandKit`, `SocialPost`, `PostStatus`, `Platform` (§27.5's schema). §1's migration list has nothing past `20260725022003_add_school_management`. Until a migration lands, the `SocialMediaController`/`AdsCenterController` routes confirmed live in §2.2 cannot be backed by the workspace-level branding/scheduling data model the master design describes — they may currently only cover simpler AI-generation endpoints under the existing `planai:social:generate` scope (§2.2 note).
2. **Master Design v3.0 itself flags several §27 code snippets as containing empty placeholder arrays**: `SYSTEM_TONE_REFERENCE_MAP[*].coreDirectives`/`.prohibitions` (mostly empty), `HASHTAG_SETS` (fully empty), and `AdCopyGenerator.generateAdCopy()`'s `interests`/`lgaDemographics` for the `conviction`/`education`/`enablement` funnel stages (only `awareness` is populated). Do not wire `composeSystemPrompt()` into `ai.service.ts` or ship the ad-copy generator against these stages until they're populated — see `boldmind-shared-monorepo-v1.1.md` §5.2 for the full do-not-consume-yet list and §5.3 for the action checklist.

---

## 5. Environment Variables — Canonical (Reconciled)

**Unchanged from v1.2.** Confirmed no new environment variables were introduced by Master Design v3.0 §27 (Social Media Management) — `BrandKit`/`SocialPost` config (colors, fonts, logos) is stored per-workspace in Postgres, not env-level, and the AI tone system reads from the same `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/etc. already listed below.

```env
# ─── DATABASE ─────────────────────────────────────────────────────────────────
DATABASE_URL=                              # Neon PostgreSQL (Prisma)
MONGODB_URL=                                # MongoDB Atlas (Mongoose) — NOT MONGODB_URI
MONGODB_DB_MAIN=
MONGODB_DB_AMEBOGIST=

# ─── REDIS (3 instances — bare REDIS_URL is retired) ──────────────────────────
REDIS_SESSION_URL=                          # SSO, OTP, rate limits, feature flags (AOF)
REDIS_QUEUE_URL=                            # BullMQ ONLY (RDB)
REDIS_CACHE_URL=                            # ALOC, rates, computed stats (allkeys-lru)

# ─── AUTH ─────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=                          # NOT a single shared JWT_SECRET
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SSO_COOKIE_DOMAIN=                          # e.g. .boldmind.ng — must be a var, not hardcoded
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.boldmind.ng/api/v1/auth/google/callback
API_KEY_ENCRYPTION_SECRET=<32-char hex>     # used in ApiKeyGuard SHA-256 hash

# ─── PAYMENTS ─────────────────────────────────────────────────────────────────
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=

# ─── AI PROVIDERS ─────────────────────────────────────────────────────────────
OPENAI_API_KEY=
ANTHROPIC_API_KEY=                          # Claude, used by PolyMind proxy
GOOGLE_GEMINI_API_KEY=                      # NOT GEMINI_API_KEY
GROQ_API_KEY=
CLOUDFLARE_AI_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
FAL_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434      # local dev only

# ─── COMMUNICATIONS ───────────────────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=                                  # Resend "from" address
TERMII_API_KEY=
TERMII_SENDER_ID=BOLDMIND                    # NCC-registered sender ID
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_APP_SECRET=                             # HMAC-validates inbound webhook payloads — confirm this is actually checked in the handler
META_VERIFY_TOKEN=

# ─── STORAGE ──────────────────────────────────────────────────────────────────
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_ENDPOINT=                      # https://<accountid>.r2.cloudflarestorage.com
CLOUDFLARE_CDN_URL=                          # public media URL prefix, separate from R2 API endpoint
CLOUDFLARE_STREAM_TOKEN=

# ─── INTEGRATIONS ─────────────────────────────────────────────────────────────
ALOC_API_TOKEN=                              # NOT ALOC_API_KEY — live env is authoritative
ALOC_BASE_URL=
HUNTER_IO_API_KEY=                           # Business Discovery Directory (Hunter.io) — newly documented

# ─── DRIVE AUTOMATION BRIDGE (newly documented) ───────────────────────────────
GAS_WEBHOOK_URL=                             # Google Apps Script doPost bridge
GAS_WEBHOOK_SECRET=

# ─── WEB PUSH / PWA ───────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=                            # also required as NEXT_PUBLIC_VAPID_PUBLIC_KEY in frontend envs
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:hello@boldmind.ng

# ─── ENTERPRISE API ───────────────────────────────────────────────────────────
WEBHOOK_DELIVERY_TIMEOUT_MS=5000

# ─── APP ──────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
API_VERSION=v1
APP_URL=                                     # pending decision — confirm purpose vs HUB_URL before relying on both
HUB_URL=https://boldmind.ng                  # used in auth.controller.ts post-login redirect
FRONTEND_URLS=https://boldmind.ng,https://planai.boldmind.ng,https://educenter.com.ng,https://villagecircle.ng,https://amebogist.ng
                                              # canonical comma-list; CORS_ORIGINS/ALLOWED_ORIGINS/singular FRONTEND_URL retire into this
```

**CI/local-dev only — do NOT put in Railway service env:**

```text
GITHUB_TOKEN
NODE_AUTH_TOKEN
```

**Reconciliation checklist still outstanding (carried forward, not yet verified against source):**

```text
[ ] Grep the WhatsApp/Meta var name variants across notification/ and packages/sms/ —
    confirm which is actually read, consolidate to the canonical names above
[ ] Grep bare REDIS_URL specifically — any hit outside a one-time migration script
    is a Wave-0 regression; fix before anything else
[ ] Confirm JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are genuinely different values
[ ] Decide what APP_URL is actually for — keep separate from HUB_URL or delete
[ ] Confirm META_APP_SECRET is actually used to validate inbound webhook signatures
[ ] Move GITHUB_TOKEN/NODE_AUTH_TOKEN out of Railway service env if present there
[ ] Update @boldmindng/deploy-config's APP_ENV_SCHEMAS to match this list exactly
```

---

## 6. New Prisma Models Pending Migration — Social Media Management (Wave 7)

> **New section in v1.3.** Master Design v3.0 §27.5 specifies these models as part of the Social Media Manager/Ads Center build. As of this repo snapshot (migrations through `20260725022003_add_school_management`), **no corresponding migration exists.** This section exists so a future migration can be checked against a known-correct target — and so nobody assumes `BrandKit`/`SocialPost` are live just because `SocialMediaController`/`AdsCenterController` show up in the live-routes snapshot (§2.2).

```prisma
model Workspace {
  id           String        @id @default(uuid())
  name         String
  brandKit     BrandKit?
  socialPosts  SocialPost[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model BrandKit {
  id               String    @id @default(uuid())
  workspaceId      String    @unique
  workspace        Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  primaryColor     String    @default("#2B4D87")
  secondaryColor   String    @default("#E9A825")
  accentColor      String    @default("#5B8ADE")
  headingFont      String    @default("Plus Jakarta Sans")
  bodyFont         String    @default("Inter")
  logoUrl          String
  logoWhiteUrl     String
  faviconUrl       String
  profilePhotoUrl  String
  brandVoice       String    @default("professional")
  industry         String
  targetAudience   String
}

model SocialPost {
  id          String       @id @default(uuid())
  workspaceId String
  workspace   Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  productSlug String       // References ProductColorScheme slug (e.g., "planai")
  contentText String       @db.VarChar(2000)
  mediaUrls   String[]     // NOTE: master design flags this as fixed from a bare `String` in its
                           // source doc to `String[]` — confirm this array type against whatever
                           // migration actually gets generated, don't assume it's already correct.
  scheduledAt DateTime
  publishedAt DateTime?
  status      PostStatus   @default(QUEUED)
  targets     Platform[]   // Same caveat as mediaUrls — confirm array type in the real migration.
  errorLog    String?      @db.Text
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([scheduledAt, status])
}

enum PostStatus {
  QUEUED
  PROCESSING
  PUBLISHED
  FAILED
}

enum Platform {
  TWITTER
  INSTAGRAM
  TIKTOK
  LINKEDIN
  FACEBOOK
}
```

**Relations to add to the existing ER diagram once this migrates:** `Workspace ── BrandKit` (1:1), `Workspace ── SocialPost[]` (1:many). Neither model relates to `User` directly in the source spec — worth confirming whether that's intentional (workspace membership handled elsewhere, e.g. `Hub` team endpoints at `/hub/team/*`, §2.2) or a gap in the spec itself before migrating.

**Before writing the actual migration:**

```text
[ ] Fix mediaUrls/targets array types per the inline note above
[ ] Decide how Workspace relates to User/team membership (not specified in v3.0 §27.5)
[ ] Populate SYSTEM_TONE_REFERENCE_MAP directives and HASHTAG_SETS (§4.8) before wiring
    composeSystemPrompt() into ai.service.ts — the migration can land independently of this,
    but don't ship the AI copy engine against empty placeholders
[ ] Confirm whether SocialMediaController/AdsCenterController's currently-live routes (§2.2)
    need to change once this model exists, or whether they're additive
```

---

_boldmind-service-canonical.md v1.3 | July 2026_
_Merged with: boldmind-system-design-v3.0.md (incl. v3.1 §25 Redis/Queue hardening and §27 Social Media Management), boldmind-service-live-routes.md (2026-07-27), boldmind-env-reconciliation-v1.md, boldmind-shared-monorepo-v1.1.md_
_Next review trigger: any change to redis.service.ts, queues.ts, a Workspace/BrandKit/SocialPost migration landing, or a live-route diff against §2.1_
