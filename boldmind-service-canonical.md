# boldmind-service — Canonical Reference

## Project Structure · Implementation Flow · Full API Documentation

### Aligned with `boldmind-system-design-v3.0.md` (Master Design, Unified) | July 2026 | v1.2 (updated)

### Supersedes v1.1. Reconciled against>

- `boldmind-service-live-routes.md` (live NestJS route snapshot, 2026‑07‑27)
- `boldmind-env-reconciliation-v1.md` (canonical env authority)
- `boldmind-shared-monorepo.md` (canonical shared-package reference)

#### Stack: NestJS 10 · Prisma 6 · Node 22.22.3 · pnpm 10.34.1

> **v1.2 change summary:**
>
> 1. §2 API Reference now points to the **live route snapshot as ground truth** for anything deployed, with a drift table showing every place the old "designed" paths disagreed with what's actually running (payment init path, Amebogist naming, EduCenter CBT flow, VibeCoders prefix, plus several previously-undocumented route groups).
> 2. §4 Known Issues: the Google OAuth double-call bug fix is now specified as **required before next deploy** (unresolved as of this snapshot); added `kolo-ai` misnaming, wallet-webhook wiring gap, and missing SMS-OTP processor, all carried forward from Master Design v3.0 §17.
> 3. §5 Environment Variables replaced wholesale with the reconciled canonical list — `ALOC_API_TOKEN` (not `_KEY`), `MONGODB_URL` (not `_URI`), `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (not one shared `JWT_SECRET`), `META_APP_SECRET` added, `HUNTER_IO_API_KEY` added, `GAS_WEBHOOK_URL`/`GAS_WEBHOOK_SECRET` added, bare `REDIS_URL` retired.
> 4. §1 Project structure unchanged — still matches the confirmed repo tree.
> 5. §3 Redis & Queue reference implementation unchanged — already correct in v1.1, re-verified against Appendix B of Master Design v3.0.

---

## Table of Contents

- [boldmind-service — Canonical Reference](#boldmind-service--canonical-reference)
  - [Project Structure · Implementation Flow · Full API Documentation](#project-structure--implementation-flow--full-api-documentation)
    - [Aligned with `boldmind-system-design-v3.0.md` (Master Design, Unified) | July 2026 | v1.2 (updated)](#aligned-with-boldmind-system-design-v30md-master-design-unified--july-2026--v12-updated)
    - [Supersedes v1.1. Reconciled against\>](#supersedes-v11-reconciled-against)
      - [Stack: NestJS 10 · Prisma 6 · Node 22.22.3 · pnpm 10.34.1](#stack-nestjs-10--prisma-6--node-22223--pnpm-10341)
  - [Table of Contents](#table-of-contents)
  - [1. Complete Project Structure](#1-complete-project-structure)
    - [Note: unchanged from v1.1 — confirmed against the live repo tree, no drift detected](#note-unchanged-from-v11--confirmed-against-the-live-repo-tree-no-drift-detected)
  - [2. Full API Reference (Live Routes — Ground Truth)](#2-full-api-reference-live-routes--ground-truth)
    - [2.1 Designed-vs-Live Drift (resolve before trusting either blindly)](#21-designed-vs-live-drift-resolve-before-trusting-either-blindly)
    - [2.2 Live Route Groups](#22-live-route-groups)
  - [3. Redis \& Queue Reference Implementation](#3-redis--queue-reference-implementation)
    - [Note: unchanged from v1.1 — re-verified against Master Design v3.0 Appendix B, no drift](#note-unchanged-from-v11--re-verified-against-master-design-v30-appendix-b-no-drift)
    - [3.1 `src/database/redis.service.ts` — Complete File](#31-srcdatabaseredisservicets--complete-file)
    - [3.2 `src/common/constants/queues.ts` — Complete File](#32-srccommonconstantsqueuests--complete-file)
  - [4. Known Issues — Launch Blockers in This Repo](#4-known-issues--launch-blockers-in-this-repo)
    - [4.1 Google OAuth Double-Call Bug — `auth.controller.ts` (BLOCKING, unresolved)](#41-google-oauth-double-call-bug--authcontrollerts-blocking-unresolved)
    - [4.2 `kolo-ai/translation.schema.ts` — Probable Misnaming (unresolved)](#42-kolo-aitranslationschemats--probable-misnaming-unresolved)
    - [4.3 Wallet credit not wired to Paystack webhook (unresolved)](#43-wallet-credit-not-wired-to-paystack-webhook-unresolved)
    - [4.4 SMS OTP queue processor missing (unresolved)](#44-sms-otp-queue-processor-missing-unresolved)
    - [4.5 Live-routes drift (tracked, see §2.1)](#45-live-routes-drift-tracked-see-21)
  - [5. Environment Variables — Canonical (Reconciled)](#5-environment-variables--canonical-reconciled)

---

## 1. Complete Project Structure

### Note: unchanged from v1.1 — confirmed against the live repo tree, no drift detected

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
│  ├─ schema.prisma
│  └─ seed.ts
├─ prisma.config.ts
├─ railway.toml
├─ redis setup.md
├─ src
│  ├─ app.module.ts
│  ├─ common/
│  │  ├─ constants/queues.ts
│  │  ├─ decorators/
│  │  ├─ filters/http.exception.filter.ts
│  │  ├─ interceptors/
│  │  ├─ queues/queues.module.ts
│  │  └─ utils/slug.util.ts
│  ├─ database/
│  │  ├─ database.module.ts
│  │  ├─ prisma.service.ts
│  │  ├─ redis.service.ts
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
│  │  ├─ planai/
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

> **Ground-truth policy (per Master Design v3.0 §6.1):** the previous version of this document specified a "designed" contract that had drifted from what is actually deployed. As of this update, **the live route snapshot (`boldmind-service-live-routes.md`, generated 2026‑07‑27) is authoritative for anything currently running.** The full per-group endpoint tables live in that companion doc; this section carries forward only the reconciliation summary and flags what changed.

### 2.1 Designed-vs-Live Drift (resolve before trusting either blindly)

| Area                                         | Previously documented (v1.1, stale)                                                         | Actually live                                                                                                                                                                                                               | Status                                                                                                                                         |
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
| Social Media Manager          | `SocialMediaController`     | `/planai/social`                                               |
| Ads Center                    | `AdsCenterController`       | `/planai/ads`                                                  |
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

**Wallet — live endpoints (confirmed deployed):**

```text
GET  /api/v1/wallet                → balance + tier + lock status
GET  /api/v1/wallet/ledger         → paginated transaction history
POST /api/v1/wallet/topup/initiate → Paystack top-up init
POST /api/v1/wallet/upgrade        → upgrade to Tier 2 with BVN hash
```

Internal-only (not HTTP routes, called from other services): `wallet.credit(...)`, `wallet.debit(...)`. Trigger points: `payment.service.ts` (`charge.success` webhook, `productSlug=wallet-topup` only — **see §4, not yet wired**), `user.service.ts` (referral conversion), `admin.service.ts` (manual credit), `marketplace.service.ts` (seller payout).

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

**Outgoing webhook events:** `payment.success`, `payment.failed`, `subscription.activated`, `subscription.cancelled`, `article.published`, `user.registered`, `vibecoders.applicant.applied`.

---

## 3. Redis & Queue Reference Implementation

### Note: unchanged from v1.1 — re-verified against Master Design v3.0 Appendix B, no drift

### 3.1 `src/database/redis.service.ts` — Complete File

```typescript
// boldmind-service/src/database/redis.service.ts
import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** SESSION — SSO relay tokens, JWT refresh families, OTP codes, rate limit counters, feature flags. */
  readonly session: Redis;

  /** QUEUE — BullMQ ONLY. Never use for reads/writes directly. */
  readonly queue: Redis;

  /** CACHE — ALOC questions, exchange rates, computed stats, feature flags. */
  readonly cache: Redis;

  constructor(private config: ConfigService) {
    this.session = this.createClient("REDIS_SESSION_URL", "session");
    this.queue = this.createClient("REDIS_QUEUE_URL", "queue");
    this.cache = this.createClient("REDIS_CACHE_URL", "cache");
  }

  private createClient(envKey: string, label: string): Redis {
    const url = this.config.getOrThrow<string>(envKey);
    const client = new Redis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      lazyConnect: false,
      reconnectOnError: (err) => {
        this.logger.error(`Redis [${label}] error: ${err.message}`);
        return true;
      },
    });

    client.on("connect", () => this.logger.log(`Redis [${label}] connected`));
    client.on("error", (e) =>
      this.logger.error(`Redis [${label}] error`, e.message),
    );
    client.on("close", () =>
      this.logger.warn(`Redis [${label}] connection closed`),
    );

    return client;
  }

  onModuleDestroy(): void {
    this.logger.log("Closing Redis connections...");
    this.session.quit();
    this.queue.quit();
    this.cache.quit();
  }
}
```

```typescript
// src/app.module.ts — BullMQ uses QUEUE redis only
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

### 3.2 `src/common/constants/queues.ts` — Complete File

```typescript
export const QUEUES = {
  EMAIL_NOTIFICATIONS: "email-notifications",
  SMS_OTP: "sms-otp",
  SOCIAL_PUBLISHING: "social-publishing",
  AI_GENERATION: "ai-generation",
  IMAGE_GENERATION: "image-generation",
  PAYROLL_PROCESSING: "payroll-processing",
  MEDIA_PROCESSING: "media-processing",
  PAYMENT_WEBHOOK: "payment-webhook",
  WALLET_CREDIT: "wallet-credit",
  TREND_ANALYSIS: "trend-analysis",
  KOLO_REMINDERS: "kolo-reminders",
  POLYMIND_QUERY: "polymind-query",
  WEBHOOK_DELIVERY: "webhook-delivery",
  NDPA_ERASURE: "ndpa-erasure",
  SEO_SITEMAP: "seo-sitemap",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const QUEUE_PRIORITIES: Record<QueueName, number> = {
  [QUEUES.PAYMENT_WEBHOOK]: 1,
  [QUEUES.WALLET_CREDIT]: 2,
  [QUEUES.SMS_OTP]: 2,
  [QUEUES.PAYROLL_PROCESSING]: 3,
  [QUEUES.EMAIL_NOTIFICATIONS]: 5,
  [QUEUES.SOCIAL_PUBLISHING]: 5,
  [QUEUES.AI_GENERATION]: 5,
  [QUEUES.IMAGE_GENERATION]: 5,
  [QUEUES.MEDIA_PROCESSING]: 5,
  [QUEUES.KOLO_REMINDERS]: 5,
  [QUEUES.POLYMIND_QUERY]: 5,
  [QUEUES.WEBHOOK_DELIVERY]: 5,
  [QUEUES.TREND_ANALYSIS]: 8,
  [QUEUES.SEO_SITEMAP]: 9,
  [QUEUES.NDPA_ERASURE]: 9,
};
```

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

---

## 5. Environment Variables — Canonical (Reconciled)

> Replaces the v1.1 env list wholesale. Sourced from `boldmind-env-reconciliation-v1.md` and Master Design v3.0 §20 — treat this as the only correct list. Key fixes from v1.1: `ALOC_API_TOKEN` (not `_KEY`), `MONGODB_URL` (not `_URI`), split `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (not one shared `JWT_SECRET`), bare `REDIS_URL` retired entirely, `CORS_ORIGINS` retired in favor of deriving from `FRONTEND_URLS`.

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

_boldmind-service-canonical.md v1.2 (updated) | July 2026_
_Merged with: boldmind-system-design-v3.0.md, boldmind-service-live-routes.md (2026-07-27), boldmind-env-reconciliation-v1.md_
