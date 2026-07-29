# BoldmindNG Ecosystem — Master Design v3.0 (Unified)

**Single Source of Truth — supersedes `boldmind-system-design-v2.2.2.md` and `boldmind-system-design-v2.1.md`**
**Supporting/cross-reference sources folded in:** `boldmind-shared-monorepo.md` (canonical package reference), `boldmind-service-live-routes.md` (routes generated from the actual running NestJS app, 2026‑07‑27), `boldmind-env-reconciliation-v1.md` (canonical env authority)
**Africa/Lagos | v3.0 | July 2026**

> **MERGE NOTE (v3.0):** v2.2.2 positioned itself as the merged single source of truth but left several sections abbreviated ("due to space... see canonical source"). v2.1 had those sections in full (Wallet service code, OTP service code, PolyMind extension, EduCenter verticals, Enterprise API guard, migration waves, checklists). This document uses v2.2.2's structure and executive framing, but restores full detail from v2.1 wherever v2.2.2 stubbed it out. It also folds in the shared-monorepo canonical package reference (more complete/accurate than either prior doc's package tables) and cross-references the live-routes doc, flagging every place where the documented design and the actually-running routes disagree. **Section 20 (Environment Variables) is now sourced entirely from the env reconciliation doc — treat it as the only correct env list; the env sections that used to live in v2.1 §21 and v2.2.2 §9 are retired and should not be used.**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Repository Map & Tech Stack](#3-repository-map--tech-stack)
4. [boldmind-service — Module Inventory](#4-boldmind-service--module-inventory)
5. [Data Models](#5-data-models)
6. [Complete API Reference (Designed vs Live)](#6-complete-api-reference-designed-vs-live)
7. [Shared Packages (boldmind-shared canonical)](#7-shared-packages-boldmind-shared-canonical)
8. [Frontend Apps — Feature Overview](#8-frontend-apps--feature-overview)
9. [Redis Split Architecture](#9-redis-split-architecture)
10. [Wallet Service — Full Implementation](#10-wallet-service--full-implementation)
11. [OTP — WhatsApp First, SMS Fallback](#11-otp--whatsapp-first-sms-fallback)
12. [EduCenter — All Learning Verticals](#12-educenter--all-learning-verticals)
13. [Enterprise API & Developer Platform](#13-enterprise-api--developer-platform)
14. [Changelog, Docs & Status Pages](#14-changelog-docs--status-pages)
15. [PolyMind Chrome Extension](#15-polymind-chrome-extension)
16. [Background Jobs — Queue Map](#16-background-jobs--queue-map)
17. [Known Issues & Required Fixes](#17-known-issues--required-fixes)
18. [Cross-App Package Usage Matrix](#18-cross-app-package-usage-matrix)
19. [Deployment & Operations](#19-deployment--operations)
20. [Environment Variables — CANONICAL (authoritative)](#20-environment-variables--canonical-authoritative)
21. [Migration Waves](#21-migration-waves)
22. [Master Output Checklist](#22-master-output-checklist)
23. [Package Audit Checklists](#23-package-audit-checklists)
24. [Appendix A: Database ER Diagram](#24-appendix-a-database-er-diagram)
25. [Appendix B: Redis Reference Implementation](#25-appendix-b-redis-reference-implementation)
26. [Appendix C: Individual App Onboarding](#26-appendix-c-individual-app-onboarding)

---

## 1. Executive Summary

BoldmindNG is a **multi-product ecosystem** spanning **4 pillars**, **56+ products**, and **16 categories**, serving Nigerian entrepreneurs, students, and professionals. The codebase consists of:

- **8 repositories** (5 Next.js frontends, 1 NestJS backend, 1 monorepo of shared packages, 1 Chrome extension)
- **3 shared Redis instances** (session, queue, cache)
- **2 databases** (PostgreSQL for relational data, MongoDB for content)
- **~70 NestJS controllers** and **~90 services** in the backend monolith
- **~200 Next.js pages** across 5 frontend apps

**Key architectural decisions (all implemented):**

- **Redis split** → 3 separate instances (session, queue, cache) — prevents cross-contamination
- **Wallet service** → lives inside `boldmind-service` (Prisma transaction with payments)
- **OTP delivery** → WhatsApp-first, SMS fallback, email fallback (via `@boldmindng/sms`)
- **API-first** → all frontends consume REST APIs from `boldmind-service`
- **Enterprise API** → API keys + scopes + webhooks (fully implemented)
- **PolyMind** → proxy service for multi-model AI comparison (backend + extension)

**Current status:** ~90% complete. Remaining work: Google OAuth bug fix (§17.2), wallet webhook wiring, SMS OTP queue processor, Chrome extension packaging, and reconciling documented routes against the live route list (§6.3).

---

## 2. System Architecture

### 2.1 High-Level Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ VERCEL EDGE NETWORK (Next.js 16.2)                                          │
│ boldmind-web  planai-suite  amebogist-web  educenter-web  villagecircle-web │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │Layout:   │ │Layout:   │ │Layout:   │ │Layout:   │ │Layout:   │            │
│ │boldmind  │ │planai-   │ │amebogist │ │educenter │ │village-  │            │
│ │Layout.tsx│ │landing   │ │Layout.tsx│ │Layout.tsx│ │circle    │            │
│ │SSO: app/ │ │Layout.tsx│ │SSO: app/ │ │SSO: app/ │ │Layout.tsx│            │
│ │sso/route │ │SSO: via  │ │api/auth  │ │api/auth/ │ │SSO: via  │            │
│ │          │ │middleware│ │          │ │callback  │ │middleware│            │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │
└──────┴────────────┴────────────┴────────────┴────────────┴─────────────────┘
                  polymind-extension (Chrome MV3) — uses X-API-Key, not SSO
                              │ HTTPS REST + SSE — Authorization: Bearer <jwt>
                              │ packages/api-client (boldmind-shared)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RAILWAY — boldmind-service (NestJS)                                         │
│ 19 modules → see §4                                                         │
│ REDIS_SESSION · REDIS_QUEUE · REDIS_CACHE · Neon PostgreSQL · MongoDB Atlas │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL SERVICES                                                           │
│ WhatsApp Business (Meta) · Termii · Paystack · Flutterwave · OpenAI · Groq  │
│ Google Gemini · Cloudflare AI · fal.ai · Anthropic Claude (PolyMind) ·      │
│ Resend · Google OAuth · Meta Graph API · TikTok · ALOC · GIG Logistics ·   │
│ NIBSS · FIRS · Cloudflare R2/Stream · n8n · Hunter.io (biz directory)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Principles

- **Pillar-driven domain decomposition** — Awareness, Conviction, Education, Enablement
- **Event-driven architecture** — BullMQ + Redis today; Kafka/RabbitMQ planned
- **API-first design** — all frontends consume REST APIs; Swagger/OpenAPI auto-generated
- **Polyglot persistence** — PostgreSQL (transactional), MongoDB (content), Redis (cache & queues, 3-way split)
- **Security by design** — JWT with short expiry, refresh token rotation, API key scopes, NDPA compliance

### 2.3 Key Data Flows

1. User authenticates via `boldmind-service` → receives JWT (15 min) + refresh token (7 days)
2. Frontend uses JWT in `Authorization: Bearer` header for all API calls
3. SSO cross-domain: relay token (64-hex, TTL 60s) stored in `REDIS_SESSION`
4. Payments: Paystack webhook → `payment-webhook` queue → updates subscription, credits wallet
5. AI jobs: enqueued to `ai-generation` → processed by provider chain (OpenAI → Groq → fallback)
6. Notifications: OTP via WhatsApp first (Meta Cloud API) → SMS fallback (Termii) → email (Resend)

---

## 3. Repository Map & Tech Stack

| Repo                 | Type                  | Deploy              | Domain               | Package Manager | Key Files                                                             |
| -------------------- | --------------------- | ------------------- | -------------------- | --------------- | --------------------------------------------------------------------- |
| `boldmind-service`   | NestJS monolith       | Railway             | `api.boldmind.ng`    | pnpm            | `src/app.module.ts`, `prisma/schema.prisma`                           |
| `boldmind-web`       | Next.js 16.2          | Vercel              | `boldmind.ng`        | pnpm            | `app/boldmindLayout.tsx`, `app/sso/route.ts`                          |
| `planai-suite`       | Next.js 16.2          | Vercel              | `planai.boldmind.ng` | pnpm            | `app/planai-landingLayout.tsx`                                        |
| `amebogist-web`      | Next.js 16.2          | Vercel              | `amebogist.ng`       | pnpm            | `app/amebogistLayout.tsx`                                             |
| `educenter-web`      | Next.js 16.2          | Vercel              | `educenter.com.ng`   | pnpm            | `app/educenterLayout.tsx`                                             |
| `villagecircle-web`  | Next.js 16.2          | Vercel              | `villagecircle.ng`   | pnpm            | `app/villagecircleLayout.tsx`                                         |
| `polymind-extension` | Chrome Extension MV3  | Chrome Web Store    | —                    | pnpm            | `manifest.json`, `src/background/service-worker.ts`                   |
| `boldmind-shared`    | pnpm monorepo (turbo) | npm/GitHub Packages | —                    | pnpm            | `turbo.json`, `pnpm-workspace.yaml`, 18 packages + 3 tooling packages |

> `boldmind-portfolio`, `boldmind-brand-manual`, `boldmind-prompt-hub` are a **separate static-site system** — they do not depend on `@boldmindng/deploy-config` or any other shared package, and are out of scope for this document.

**Exact versions (use these, never Next.js 14 patterns):**

```json
{
  "node": "22.22.3",
  "pnpm": "10.34.1",
  "next": "16.2.x",
  "react": "19.2.x",
  "react-dom": "19.2.x",
  "typescript": "5.x",
  "nestjs": "^10.x",
  "@prisma/client": "^6.x",
  "mongoose": "^8.x",
  "bullmq": "^5.x",
  "ioredis": "^5.x"
}
```

---

## 4. boldmind-service — Module Inventory

19 modules confirmed present in `src/modules/`:

| Module            | Path             | Key Controllers                                                                                                             | Notable Services                                                                      |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **admin**         | `admin/`         | `admin.controller`, `health.controller`                                                                                     | AdminService                                                                          |
| **ai**            | `ai/`            | `ai.controller`                                                                                                             | OpenAI, Groq, Gemini, fal, Cloudflare, Ollama providers; trend service; video factory |
| **amebogist**     | `amebogist/`     | content controller (live: `ContentController`)                                                                              | RSS service; schemas: post, comment, reaction, creator-stats                          |
| **analytics**     | `analytics/`     | `analytics.controller`                                                                                                      | AnalyticsService                                                                      |
| **api**           | `api/`           | `api-key.controller`, `enterprise.controller`, `webhook.controller`                                                         | ApiKeyService, WebhookService                                                         |
| **auth**          | `auth/`          | `auth.controller`, `sso.controller`                                                                                         | AuthService, SsoService, GoogleStrategy, JwtStrategy                                  |
| **automation**    | `automation/`    | `automation.controller`                                                                                                     | Queue processors: AI, email-campaign, social-post                                     |
| **educenter**     | `educenter/`     | `educenter.controller`, `lms.controller`, `school.controller`                                                               | AlocService, LmsService, SchoolService                                                |
| **hub**           | `hub/`           | `hub.controller`                                                                                                            | HubService                                                                            |
| **media**         | `media/`         | `media.controller`                                                                                                          | MediaService (R2 uploads)                                                             |
| **notification**  | `notification/`  | `notification.controller`                                                                                                   | NotificationService, OTP (WhatsApp-first), Push broadcast                             |
| **payment**       | `payment/`       | `payment.controller`                                                                                                        | PaymentService, SubscriptionService                                                   |
| **planai**        | `planai/`        | 13 controllers (one per tool)                                                                                               | 14 services covering all PlanAI tools                                                 |
| **polymind**      | `polymind/`      | `polymind.controller`                                                                                                       | PolymindService (proxies AI providers)                                                |
| **user**          | `user/`          | `user.controller`, `user-me.controller`                                                                                     | UserService, ReferralService                                                          |
| **villagecircle** | `villagecircle/` | 10 sub-module controllers (waitlist, vibecoders, kolo, remit, receipts, safeai, farmgate, naijagig, skill2cash, afrohustle) | Corresponding services                                                                |
| **wallet**        | `wallet/`        | `wallet.controller`                                                                                                         | WalletService, wallet-credit queue processor                                          |
| **common**        | `common/`        | constants, decorators, filters, interceptors, utils                                                                         | —                                                                                     |
| **database**      | `database/`      | —                                                                                                                           | PrismaService, RedisService (3 instances)                                             |

---

## 5. Data Models

### 5.1 PostgreSQL (Prisma) — Key Models

| Model                                                    | Purpose                              | Relations                                |
| -------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| `User`                                                   | Authentication, profile, preferences | → Wallet, ApiKey, Referral, School, etc. |
| `Wallet` / `WalletLedger`                                | Naira balance (kobo), transactions   | → User                                   |
| `Subscription`                                           | Product subscriptions                | → User, Payment                          |
| `Payment`                                                | Paystack transactions                | → User, Subscription                     |
| `ApiKey`                                                 | Enterprise API keys (stored hash)    | → User                                   |
| `School`                                                 | School management portal             | → User (admin)                           |
| `Course`, `CourseLesson`, `CourseEnrollment`             | EduCenter LMS                        | → User                                   |
| `VibeCoderApplicant`, `VibeCoderCohort`                  | Vibe Coders program                  | → User                                   |
| `VibeCoderProjectSubmission`, `VibeCoderAttendance`      | Classroom progress                   | → Applicant                              |
| `CRMContact`, `CRMPipeline`, `CRMDeal`, `CRMInteraction` | PlanAI CRM                           | → User                                   |
| `HREmployee`, `Payroll`, `LeaveRequest`                  | HR & Payroll                         | → User                                   |
| `PlanAIJob`, `PlanAIUsage`                               | AI job tracking                      | → User                                   |
| `Storefront`, `Product`, `Order`                         | Brand & Digital Home e-commerce      | → User                                   |
| `MarketplaceListing`, `MarketplaceBooking`               | Marketplace                          | → User                                   |
| `ApiKey`, `WebhookSubscription`                          | Enterprise/Developer API (§13)       | → User                                   |
| `Referral`, `AffiliateEarning`                           | Referral commissions                 | → User                                   |

**Key enums:** `WalletTier`, `WalletEntryType`, `WalletSource`, `ApiTier`, `SubscriptionStatus`, `PaymentStatus`, `ExamType`, `PlanAIJobType`, `ConversationStatus`, `TaskStatus`, `OrderStatus`, etc.

Full addendum Prisma models for Wallet, ApiKey, School, VibeCoder classroom, Webhooks, Referrals/Affiliates are given in full in §10 and §13, plus consolidated below:

```prisma
// ─── WALLET ─────────────────────────────────────────────────────────────────
model Wallet {
  id              String        @id @default(cuid())
  userId          String        @unique
  balanceKobo     Int           @default(0)
  tier            WalletTier    @default(TIER1)
  dailyDebitKobo  Int           @default(0)
  lastDebitReset  DateTime      @default(now())
  isLocked        Boolean       @default(false)
  lockReason      String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  ledger  WalletLedger[]

  @@map("wallets")
}

model WalletLedger {
  id            String            @id @default(cuid())
  walletId      String
  type          WalletEntryType
  amountKobo    Int
  balanceAfter  Int
  description   String
  reference     String?
  source        WalletSource
  metadata      Json?
  createdAt     DateTime          @default(now())

  wallet Wallet @relation(fields: [walletId], references: [id])

  @@index([walletId])
  @@index([walletId, createdAt])
  @@index([reference])
  @@map("wallet_ledger")
}

enum WalletTier      { TIER1 TIER2 }
enum WalletEntryType { CREDIT DEBIT }
enum WalletSource {
  REFERRAL_COMMISSION
  AFFILIATE_EARNING
  SUBSCRIPTION_REFUND
  ADMIN_CREDIT
  PROMOTIONAL_BONUS
  MARKETPLACE_PAYOUT
  SUBSCRIPTION_PAYMENT
  MARKETPLACE_PURCHASE
  WITHDRAWAL
}

// ─── API KEYS / WEBHOOKS ──────────────────────────────────────────────────────
model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  name        String
  keyHash     String    @unique
  prefix      String
  scopes      String[]
  tier        ApiTier   @default(STARTER)
  isActive    Boolean   @default(true)
  rateLimit   Int       @default(1000)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([keyHash])
  @@map("api_keys")
}

enum ApiTier { STARTER GROWTH ENTERPRISE }

model WebhookSubscription {
  id        String   @id @default(cuid())
  userId    String
  apiKeyId  String
  url       String
  events    String[]
  secret    String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id])
  apiKey ApiKey @relation(fields: [apiKeyId], references: [id])

  @@index([userId])
  @@map("webhook_subscriptions")
}

// ─── SCHOOL ────────────────────────────────────────────────────────────────────
model School {
  id              String    @id @default(cuid())
  name            String
  state           String
  address         String?
  contactEmail    String
  adminUserId     String    @unique
  plan            String    @default("basic")
  studentSlots    Int       @default(50)
  usedSlots       Int       @default(0)
  payingUntil     DateTime?
  paystackSubCode String?   @unique
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  admin User @relation(fields: [adminUserId], references: [id])

  @@map("schools")
}

// ─── VIBE CODERS CLASSROOM ─────────────────────────────────────────────────────
model VibeCoderProjectSubmission {
  id          String   @id @default(cuid())
  applicantId String
  moduleId    String
  githubUrl   String?
  loomUrl     String?
  brief       String   @db.Text
  status      String   @default("submitted")
  mentorNote  String?  @db.Text
  reviewedBy  String?
  score       Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  applicant VibeCoderApplicant @relation(fields: [applicantId], references: [id])

  @@index([applicantId])
  @@map("vc_project_submissions")
}

model VibeCoderAttendance {
  id          String    @id @default(cuid())
  applicantId String
  sessionDate DateTime
  sessionType String
  moduleId    String
  attended    Boolean   @default(false)
  joinedAt    DateTime?
  duration    Int?
  createdAt   DateTime  @default(now())

  applicant VibeCoderApplicant @relation(fields: [applicantId], references: [id])

  @@unique([applicantId, sessionDate, moduleId])
  @@map("vc_attendance")
}

// ─── REFERRALS & AFFILIATES ────────────────────────────────────────────────────
model Referral {
  id             String   @id @default(cuid())
  referrerId     String
  referredId     String   @unique
  productSlug    String
  status         String   @default("pending")
  commissionKobo Int      @default(0)
  createdAt      DateTime @default(now())

  referrer User @relation("Referrer", fields: [referrerId], references: [id])
  referred User @relation("Referred", fields: [referredId], references: [id])

  @@index([referrerId])
  @@map("referrals")
}

model AffiliateEarning {
  id          String    @id @default(cuid())
  userId      String
  source      String
  amountKobo  Int
  reference   String?
  paidAt      DateTime?
  createdAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("affiliate_earnings")
}

// Relations to add to existing User model:
//   wallet Wallet? | apiKeys ApiKey[] | school School? | referralsMade Referral[] @relation("Referrer")
//   referredBy Referral? @relation("Referred") | affiliateEarnings AffiliateEarning[]
//   webhookSubscriptions WebhookSubscription[]
```

### 5.2 MongoDB (Mongoose) — Key Collections

| Collection                                          | Module               | Purpose                                 |
| --------------------------------------------------- | -------------------- | --------------------------------------- |
| `posts`, `comments`, `reactions`, `creator_stats`   | amebogist            | Content, engagement                     |
| `prompt_templates`, `playbooks`                     | educenter            | Prompt library, business playbooks      |
| `polymind_comparisons`                              | polymind             | AI comparison history (extension + web) |
| `webhook_deliveries`                                | api                  | Webhook delivery logs                   |
| `transfer_records`                                  | borderless-remit     | Remittance rates                        |
| `produce_listings`                                  | farmgate             | Agricultural produce                    |
| `kolo_groups` (file currently misnamed — see §17.1) | kolo-ai              | Digital thrift groups                   |
| `receipts`                                          | receiptgenius        | VAT-compliant invoices                  |
| `gig_listings`, `video_profiles`                    | naijagig, skill2cash | Marketplace gigs                        |
| `incidents`, `safety_alerts`                        | safeai               | Security reporting                      |
| `blueprints`                                        | afrohustle           | Business playbooks                      |
| `n8n_logs`                                          | automation           | n8n workflow logs                       |

Schema stubs (`PromptTemplate`, `Playbook`, `PolyMindComparison`, `WebhookDelivery`) are given in full in §12 and §13.

---

## 6. Complete API Reference (Designed vs Live)

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

### 6.1 How to use this section

The full per-group endpoint tables (Auth, SSO, Users, Payments, PlanAI's 13 tools, Amebogist, EduCenter, LMS, School, Automation, Media, Notifications, Admin, Wallet, Hub, all 10 VillageCircle sub-products, Developer Keys, Public Enterprise API, Webhooks, PolyMind) are the **designed** contract and live in the companion doc `boldmind-service-canonical-api-reference.md` (36 endpoint groups). The most current version of that reference is the **live-routes snapshot** generated directly from the running app's route table on 2026-07-27 (`boldmind-service-live-routes.md`) — treat the live snapshot as ground truth for anything currently deployed, and the designed contract as ground truth for anything still on the roadmap.

### 6.2 Quick lookup — which section covers what

| Section              | Groups Covered                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth                 | register, login, refresh, logout, verify, reset, 2FA, Google OAuth                                                              |
| SSO                  | relay, exchange, verify, logout-all                                                                                             |
| Users                | admin user mgmt + self-service (`/users`, `/users/me/*`)                                                                        |
| Payments             | initiate/initialize, verify, webhook, history, subscriptions                                                                    |
| Wallet               | balance, ledger, topup, upgrade                                                                                                 |
| Media                | upload, batch upload, presign, signed-url                                                                                       |
| Notifications        | push, email, WhatsApp, OTP                                                                                                      |
| Analytics            | track, dashboard, product metrics                                                                                               |
| AI                   | generate, image, social caption/video-script, trends                                                                            |
| Automation           | social schedule, email campaigns, n8n triggers                                                                                  |
| Amebogist            | posts/articles, reactions, comments, creator tools, RSS                                                                         |
| EduCenter            | CBT, courses, LMS builder, school portal, prompts, playbooks                                                                    |
| PlanAI               | all 13 tools — social, ads, brand, intelligence, investor, marketing, directory, agent, projects, CRM, HR, fitness, marketplace |
| VillageCircle        | waitlist, vibecoders pipeline, kolo, remit, receipts, safeai, farmgate, naijagig, skill2cash, afrohustle                        |
| Admin                | dashboard, user/wallet management, logs, revenue, vibecoder applicants                                                          |
| Developer/Enterprise | API key CRUD, scope enforcement, public enterprise endpoints, webhook subscriptions                                             |
| PolyMind             | multi-model comparison endpoints, query history                                                                                 |

### 6.3 Known drift between designed spec and live routes (reconcile before trusting either blindly)

Cross-referencing the live route snapshot against the designed contract surfaced these differences — worth resolving (either the docs are stale, or the implementation diverged intentionally):

| Area                       | Designed says                                                                               | Live route says                                                                                                                                                                                                                | Action                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Payment init               | `POST /payment/initiate`                                                                    | `POST /payment/initialize`                                                                                                                                                                                                     | Confirm which is actually deployed; update the stale one                                                                    |
| Amebogist controller/paths | `/amebogist/posts`, `/amebogist/posts/:slug` (`AmebogistController`)                        | `/amebogist/articles`, `/amebogist/articles/:slug` (`ContentController`) — plus extra live-only routes: `/amebogist/search`, `/amebogist/articles/generate-ai`, `/amebogist/articles/:id/video-factory`, `/amebogist/me/stats` | Live routes are more feature-rich than the designed doc describes — treat live as current, update the designed doc to match |
| EduCenter session flow     | `/educenter/sessions`, `/educenter/sessions/:id/answer`, `/educenter/sessions/:id/complete` | `/educenter/cbt/start`, `/educenter/cbt/:sessionId/submit`, `/educenter/cbt/:sessionId/abandon`, `/educenter/cbt/:sessionId/review` (separate `/educenter/sessions` for history list only)                                     | The live naming (`cbt/*`) is the real contract — designed doc's `sessions/*` naming for the exam flow itself is stale       |
| VibeCoders prefix          | `/villagecircle/vibecoders/portal/*`                                                        | `/vibecoders/*` (no `villagecircle` prefix)                                                                                                                                                                                    | Confirm intended public prefix — likely the live route is correct and the designed prefix is aspirational                   |
| Auth extras                | not documented                                                                              | `/auth/login/verify-2fa`, `/auth/change-password`, `/auth/users/:id/role` exist live                                                                                                                                           | Add these to the designed Auth table                                                                                        |
| Hub extras                 | not documented                                                                              | `/hub/pricing`, `/hub/team`, `/hub/team/invite`, `/hub/team/:userId`, `/hub/stats` exist live                                                                                                                                  | Add to designed Hub table                                                                                                   |
| Users extras               | not documented                                                                              | `/users/dashboard`, `/users/:id/profile` (admin override), `/users/onboarding`, `/users/me/products`, `/users/me/onboarding` exist live                                                                                        | Add to designed Users table                                                                                                 |
| Media extras               | not documented                                                                              | `/media/upload/batch`, `/media/presign`, `/media/admin/all` exist live                                                                                                                                                         | Add to designed Media table                                                                                                 |
| Notifications extras       | not documented                                                                              | `/notifications` (list), `/notifications/read`, `/notifications/:id` (delete), `/notifications/push/user`, `/notifications/broadcast/push`, `/notifications/broadcast/email` exist live                                        | Add to designed table                                                                                                       |
| Business Directory         | not previously documented at all                                                            | `BizDirectoryController` at `/planai/directory/*` with Hunter.io-backed `verify-email` and `intent-signals`                                                                                                                    | Confirms `HUNTER_IO_API_KEY` (see §20) is real and in active use                                                            |

**Recommendation:** run a full reconciliation pass — the live snapshot is authoritative for what's actually deployed; the designed contract is authoritative for what's planned but not yet built (Developer Keys, Public Enterprise API, Webhooks, PolyMind proxy — all confirmed live already per the live-routes doc, so these are no longer "planned," they're shipped).

---

## 7. Shared Packages (boldmind-shared canonical)

**Repo:** `boldmind-shared` (pnpm + turbo monorepo) — the only repo in the ecosystem using a monorepo layout. All other repos consume these via `@boldmindng/*` from GitHub Packages.

### 7.1 Confirmed project tree

```text
boldmind-shared
├─ packages/
│  ├─ analytics/        { flywheel.ts, tracker.ts, utm.ts, types.ts }
│  ├─ api-client/       { 27 files — see §7.4 }
│  ├─ api-docs/         { changelog.ts, openapi.ts, sdk-types.ts, types.ts, scripts/generate.ts }
│  ├─ auth/             { api, broadcast, config, middleware, sso, store, token, types + client/*, server/index.ts }
│  ├─ deploy-config/    { cors, domains, env-schema, health-check, security-headers, vercel-config, types + cli/validate-env.ts }
│  ├─ email/            { index, service + templates/ — 13 files, see §7.6 }
│  ├─ payments/         { paystack/client, flutterwave/client, utils, types }
│  ├─ pwa/              { install-prompt, manifest, offline-cache, push, service-worker, sw-template, twa, types }
│  ├─ sms/              { otp.service, termii.provider, whatsapp.provider, types }
│  ├─ ui/               { 23 components, hooks/, lib/{ecosystem-links,utils}, providers/, styles/, types/ }
│  ├─ utils/            { admin, constants, formatters, hooks, storage, styles, types, validators }
│  └─ wallet/           { formatters, types, hooks/useWallet }
└─ tooling/
   ├─ eslint-config/
   ├─ tailwind-config/
   └─ tsconfig/         { base.json, node-library.json, react-library.json }
```

### 7.2 `@boldmindng/utils`

| Export                                                             | Signature                            | Used in                                           |
| ------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------- |
| `formatNaira`, `koboToNaira`/`nairaToKobo`                         | `(kobo: number) => string / number`  | Everywhere a `*NGN`/kobo Prisma field is rendered |
| `formatLagosDate`, `formatRelativeTime`                            | date formatters                      | Dashboards, timestamps                            |
| `truncate`, `slugify`, `capitalizeFirst`, `pluralize`              | string helpers                       | UI copy across all apps                           |
| `useLocalStorage`, `useOffline`, `usePaystack`, `useStorage`       | hooks                                | Onboarding, offline banners, checkout             |
| `validateBVN`, `validateNigerianPhone`, `formatE164`               | validators                           | Wallet Tier-2 upgrade, phone verification         |
| `BOLDMIND_PRODUCTS` + getters                                      | re-export of `constants/products.ts` | Every product/pricing/nav lookup                  |
| `BOLDMIND_PRICING`, `getPricingForProduct`                         | re-export of `constants/pricing.ts`  | Pricing pages                                     |
| `BOLDMIND_COLOR_SCHEMES`, `getColorScheme`, `generateCSSVariables` | re-export of `constants/colors.ts`   | Theme provider, Tailwind preset                   |
| `AUTH_CONSTANTS`                                                   | `constants/auth.ts`                  | `packages/auth`                                   |
| `theme`                                                            | `styles/theme.ts`                    | `packages/ui`, Tailwind preset                    |

`constants/{products,pricing,colors}.ts` must stay **re-exports**, not copies — highest-drift-risk spot in the monorepo.

### 7.3 `@boldmindng/ui`

23 components: `Button`, `Card`, `Modal`, `LoadingSpinner`, `ErrorBoundary`, `Logo`, `SuperNavbar`, `SuperFooter`, `CrossLink`, `StatusBadge`, `SocialLinks`, `PricingContent`, `PrivacyPolicy`/`TermsAndConditions`, `CookieConsent`, `DyslexiaToggle`, `FontProvider`, `TypewriterEffect`, `Confetti`, `ParticleBackground`, `InstallPromptBanner`, `Input`, `Link`, `analytics/{FacebookLoginButton,FacebookSDK}`. Plus 4 hooks (`useClickOutside`, `useCookieConsent`, `useDebounce`, `useMediaQuery`), 2 providers (`AppLayout`, `theme-provider`), `lib/{ecosystem-links,utils}.ts`.

Audit: `SuperNavbar`/`SuperFooter` must read from `utils` product helpers, never hardcoded nav arrays. `InstallPromptBanner` only renders where `product.twa !== undefined`. `lib/ecosystem-links.ts` must stay a thin derivation from `products.ts`, not a second source of truth.

### 7.4 `@boldmindng/api-client`

27 files under `src/`: `admin`, `amebogist`, `analytics`, `auth`, `automation`, `client`, `developer`, `educenter`, `educenter-lms`, `educenter-school`, `fitness`, `hub`, `media`, `n8n-client`, `notifications`, `os`, `payment`, `planai`, `polymind`, `users`, `vibecoders`, `villagecircle`, `wallet`, plus `interceptors.ts`, `types.ts`, `types/api.ts`, `index.ts`. `wallet.api.ts`, `developer.api.ts`, `polymind.api.ts`, `educenter-lms.api.ts`, `educenter-school.api.ts` are all **confirmed present** (previously flagged missing in older drafts — that gap is now closed). `client.ts` supports dual auth mode (`jwt` | `apikey`) for the extension.

`os.api.ts` and `fitness.api.ts` are legacy aliases re-exporting `planaiApi.projects` / `planaiApi.fitness` respectively — retained for backward compatibility only, don't add new logic to them.

### 7.5 `@boldmindng/analytics`

`flywheel.ts` (`FLYWHEEL_STAGES`, `getNextPillarSuggestion`), `tracker.ts` (`track`, `usePageView`), `utm.ts` (`buildUtmUrl`, `ECOSYSTEM_UTM_PRESETS`, `parseUtmParams`).

### 7.6 `@boldmindng/email`

Confirmed templates: `CourseEnrolledEmail.tsx`, `EnterpriseApiKeyEmail.tsx`, `ResetPasswordEmail.tsx`, `SsoWelcomeExternal.tsx`, `SubscriptionStarted.tsx`, `VerifyEmail.tsx`, `VibeCodersAccepted.tsx`, `WaitlistJoined.tsx`, `WelcomeEmail.tsx`, `OTPEmail.tsx`, `PlaybookUnlockedEmail.tsx`, `WalletCreditEmail.tsx`, `WalletDebitEmail.tsx`.

### 7.7 `@boldmindng/payments`

`paystack/client.ts`, `flutterwave/client.ts`, `utils.ts` (`verifyPaystackWebhookSignature`, kobo/naira converters). **Server-side only** — never import into a Next.js frontend repo. If it ever appears in a frontend `package.json`, remove it immediately (see §17.5).

### 7.8 `@boldmindng/sms`

`otp.service.ts` (`OTPService.send()` — WhatsApp → Termii → email), `whatsapp.provider.ts`, `termii.provider.ts`. Server-side only, consumed by `boldmind-service`. Full implementation in §11.

### 7.9 `@boldmindng/wallet`

`formatters.ts` (`formatBalance`, `formatLedgerEntry`, `walletTierLabel`), `hooks/useWallet.ts` (react-query wrapper). `WalletSource` union must match the Prisma enum exactly — 9 confirmed values (see §5.1).

### 7.10 `@boldmindng/api-docs`

`openapi.ts` (`generateOpenApiSpec`), `sdk-types.ts` (`generateSdkTypes`), `changelog.ts` (`getChangelog`, reads every package's `CHANGELOG.md`), `scripts/generate.ts` (CLI).

### 7.11 `@boldmindng/pwa`

`manifest.ts` (`generateManifest`), `service-worker.ts` (`registerServiceWorker`, no-op outside production), `sw-template.ts`, `offline-cache.ts` (`cacheStrategies`: networkFirst/cacheFirst/staleWhileRevalidate), `install-prompt.tsx` (`useInstallPrompt`, `InstallPromptBanner`), `push.ts` (`subscribeToPush`/`unsubscribeFromPush`), `twa.ts` (`generateTwaConfig`).

Four confirmed TWA products: `project-manager-twa` (`ng.boldmind.projects`), `boldmind-fitness-twa` (`ng.boldmind.fit`), `amebogist-twa` (`ng.amebogist.app`), `educenter-twa` (`ng.educenter.app`).

Rules: `generateManifest` guards on `product.twa !== undefined`; `registerServiceWorker` no-ops when `NODE_ENV !== 'production'`; VAPID keys must exist in **both** service env and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in frontend envs (see §20).

### 7.12 `@boldmindng/deploy-config`

`env-schema.ts` (`APP_ENV_SCHEMAS`, `validateEnv`), `cors.ts` (`getCorsOrigins` — derives from `FRONTEND_URLS`), `domains.ts` (`DOMAIN_CONFIG`), `vercel-config.ts` (`generateVercelConfig`), `security-headers.ts`, `health-check.ts` (`createHealthCheckRoute`), `cli/validate-env.ts`.

`AppName` covers exactly seven values: `boldmind-web | planai-suite | amebogist-web | educenter-web | villagecircle-web | boldmind-service | polymind-extension`. Do **not** add `boldmind-prompt-hub`/`boldmind-brand-manual`/`boldmind-portfolio` — those are a separate static-site system with no `deploy-config` dependency.

CSP rules: `connect-src` must include `https://api.boldmind.ng`, Paystack endpoints, PostHog; must **not** expose Redis/Upstash URLs. `generateVercelConfig` rewrites must preserve `?sso_token=` query param.

**IMPORTANT: once §20 (canonical env list) is finalized, `APP_ENV_SCHEMAS` must be updated to match it exactly** — this is the enforcement mechanism that prevents future env-var drift.

### 7.13 Tooling packages

| Package                       | Purpose                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@boldmindng/eslint-config`   | Extends `next/core-web-vitals` + `turbo`; bans `localStorage`/`sessionStorage` in `ui`, `auth`, `pwa`                                             |
| `@boldmindng/tailwind-config` | `preset.ts` — colors from `colors.ts`, fonts from `products.ts`, spacing/radius from `utils/styles/theme.ts`                                      |
| `@boldmindng/tsconfig`        | `base.json` (root), `node-library.json` (api-client, payments, sms, wallet, api-docs, deploy-config), `react-library.json` (ui, pwa, auth/client) |

---

## 8. Frontend Apps — Feature Overview

Full per-app route trees and feature descriptions for `boldmind-web`, `planai-suite`, `amebogist-web`, `educenter-web` (expanded in §12), `villagecircle-web`, `polymind-extension` (expanded in §15) — see companion project-tree docs per repo. Always attach the relevant repo's project-tree.md before generating code for it; never infer file paths.

---

## 9. Redis Split Architecture

### Problem

A single Redis instance handling sessions, BullMQ queues, and caching simultaneously risks memory saturation, BullMQ's blocking commands competing with session reads, and a single `FLUSHDB` wiping all three data planes.

### Solution — Three Redis Instances

```text
REDIS_SESSION_URL   → SSO relay tokens, JWT refresh families, OTP, rate limits, feature flags (AOF persistence)
REDIS_QUEUE_URL     → BullMQ ONLY (RDB persistence)
REDIS_CACHE_URL     → ALOC questions, exchange rates, computed stats (no persistence, allkeys-lru)
```

### 9.1 What Goes Where

| Data                       | Instance | Key Pattern                       | TTL        |
| -------------------------- | -------- | --------------------------------- | ---------- |
| JWT refresh token families | SESSION  | `refresh:{family}:{tokenId}`      | 7 days     |
| SSO relay tokens           | SESSION  | `sso:relay:{64-hex}`              | 60 seconds |
| Rate limit counters        | SESSION  | `ratelimit:{endpoint}:{userId}`   | 60 seconds |
| OTP codes                  | SESSION  | `otp:{purpose}:{email}`           | 15 minutes |
| Feature flags              | SESSION  | `flags:{userId}` / `flags:global` | 5 minutes  |
| BullMQ queues (all)        | QUEUE    | BullMQ internal keys              | varies     |
| ALOC exam questions        | CACHE    | `aloc:{subject}:{type}:{year}`    | 24 hours   |
| Exchange rates             | CACHE    | `remit:rates:{currency}`          | 1 hour     |
| Trend data                 | CACHE    | `trends:ng:{date}`                | 2 hours    |
| Admin dashboard stats      | CACHE    | `admin:stats:{date}`              | 15 minutes |
| PlanAI tool access map     | CACHE    | `planai:access:{userId}`          | 5 minutes  |

Full `RedisService` and BullMQ wiring implementation: see §25 (Appendix B).

---

## 10. Wallet Service — Full Implementation

Prisma models are in §5.1. What follows is the service/controller implementation.

### 10.1 What the Wallet Does

- Holds a Naira balance per user (stored in kobo)
- Credits: subscription refunds, referral commissions, affiliate earnings, promotional bonuses, marketplace payouts
- Debits: subscription payments (pay from wallet), marketplace purchases
- Every credit/debit creates an immutable `WalletLedger` entry
- Daily debit cap: ₦50,000 (Tier 1); ₦5,000,000 (Tier 2 — requires BVN)
- CBN Tier 1 wallet — no direct bank withdrawal without BVN upgrade

### 10.2 NestJS Wallet Module

**Location:** `src/modules/wallet/` — `wallet.module.ts`, `wallet.controller.ts`, `wallet.service.ts`, `wallet.dto.ts`

```typescript
// src/modules/wallet/wallet.service.ts

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getOrCreate(userId: string): Promise<Wallet> {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balanceKobo: 0 },
    });
  }

  // All wallet mutations use a Prisma transaction to prevent race conditions
  async credit(params: {
    userId: string;
    amountKobo: number;
    source: WalletSource;
    description: string;
    reference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<WalletLedger> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId: params.userId },
        data: { balanceKobo: { increment: params.amountKobo } },
      });

      return tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amountKobo: params.amountKobo,
          balanceAfter: wallet.balanceKobo,
          description: params.description,
          reference: params.reference,
          source: params.source,
          metadata: params.metadata ?? {},
        },
      });
    });
  }

  async debit(params: {
    userId: string;
    amountKobo: number;
    source: WalletSource;
    description: string;
    reference?: string;
  }): Promise<WalletLedger> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: params.userId },
      });

      if (wallet.balanceKobo < params.amountKobo) {
        throw new BadRequestException(
          `Insufficient wallet balance. Available: ₦${wallet.balanceKobo / 100}`,
        );
      }

      const cap = wallet.tier === "TIER1" ? 5_000_000 : 500_000_000; // kobo
      await this.resetDailyDebitIfNeeded(tx, wallet);
      if (wallet.dailyDebitKobo + params.amountKobo > cap) {
        throw new BadRequestException(
          "Daily debit limit exceeded for this wallet tier",
        );
      }

      if (wallet.isLocked) {
        throw new ForbiddenException(`Wallet is locked: ${wallet.lockReason}`);
      }

      const updated = await tx.wallet.update({
        where: { userId: params.userId },
        data: {
          balanceKobo: { decrement: params.amountKobo },
          dailyDebitKobo: { increment: params.amountKobo },
        },
      });

      return tx.walletLedger.create({
        data: {
          walletId: updated.id,
          type: "DEBIT",
          amountKobo: -params.amountKobo,
          balanceAfter: updated.balanceKobo,
          description: params.description,
          reference: params.reference,
          source: params.source,
        },
      });
    });
  }

  private async resetDailyDebitIfNeeded(tx: any, wallet: any) {
    const now = new Date();
    const lagosNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }),
    );
    const lastReset = new Date(
      wallet.lastDebitReset.toLocaleString("en-US", {
        timeZone: "Africa/Lagos",
      }),
    );

    if (lagosNow.toDateString() !== lastReset.toDateString()) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { dailyDebitKobo: 0, lastDebitReset: now },
      });
      wallet.dailyDebitKobo = 0;
    }
  }

  async getBalance(userId: string) {
    const wallet = await this.getOrCreate(userId);
    return {
      balanceKobo: wallet.balanceKobo,
      balanceNaira: `₦${(wallet.balanceKobo / 100).toLocaleString("en-NG")}`,
      tier: wallet.tier,
      isLocked: wallet.isLocked,
    };
  }

  async getLedger(userId: string, page = 1, pageSize = 20) {
    const wallet = await this.getOrCreate(userId);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.walletLedger.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.walletLedger.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async upgradeTier(userId: string, bvnHash: string): Promise<void> {
    // bvnHash already verified via NIBSS; store hash only — never plain BVN
    await this.prisma.$transaction([
      this.prisma.wallet.update({ where: { userId }, data: { tier: "TIER2" } }),
      this.prisma.user.update({ where: { id: userId }, data: { bvnHash } }),
    ]);
  }
}
```

```typescript
// src/modules/wallet/wallet.controller.ts

@Controller("wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.wallet.getBalance(user.sub);
  }

  @Get("ledger")
  getLedger(
    @CurrentUser() user: JwtPayload,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.wallet.getLedger(user.sub, page, Math.min(pageSize, 50));
  }

  @Post("upgrade")
  @HttpCode(200)
  upgradeTier(@CurrentUser() user: JwtPayload, @Body() dto: UpgradeTierDto) {
    return this.wallet.upgradeTier(user.sub, dto.bvnHash);
  }
}
```

**Live endpoints (confirmed deployed, from live-routes doc):**

```text
GET  /api/v1/wallet               → balance + tier + lock status
GET  /api/v1/wallet/ledger        → paginated transaction history
POST /api/v1/wallet/topup/initiate → Paystack top-up init
POST /api/v1/wallet/upgrade       → upgrade to Tier 2 with BVN hash
```

### 10.3 Which Service Handles Wallet?

Keep wallet as a NestJS sub-module inside `boldmind-service`, not a separate service — wallet mutations must share a transaction with subscription activation and referral conversion, and no extra auth/network hop is needed. Extract to a dedicated `boldmind-wallet-service` only when bank withdrawals or lending are added.

### 10.4 Frontend Wallet Page (boldmind-web)

`app/(dashboard)/dashboard/wallet/page.tsx` — balance hero card, "Top Up" CTA (`productSlug='wallet-topup'`), tier upgrade section (visible if `tier === TIER1`), paginated ledger, upcoming earnings.

---

## 11. OTP — WhatsApp First, SMS Fallback

### 11.1 Strategy

```text
OTP Delivery Order:
  1. WhatsApp Business API (primary — ~95% delivery rate in Nigeria)
  2. Termii SMS (fallback — WhatsApp failure or no WhatsApp)
  3. Email OTP (final fallback — email-verify flows only)
```

### 11.2 `packages/sms` — `otp.service.ts`

```typescript
export type OTPPurpose =
  | "phone_verify"
  | "password_reset"
  | "login_2fa"
  | "transaction_confirm";
export type OTPChannel = "whatsapp" | "sms" | "email";

export interface SendOTPParams {
  to: string;
  code: string;
  purpose: OTPPurpose;
  name?: string;
  preferChannel?: OTPChannel;
}

export interface OTPResult {
  delivered: boolean;
  channel: OTPChannel;
  messageId?: string;
  error?: string;
}

export class OTPService {
  constructor(
    private readonly whatsapp: WhatsAppProvider,
    private readonly termii: TermiiProvider,
  ) {}

  async send(params: SendOTPParams): Promise<OTPResult> {
    const isNigerian = params.to.startsWith("+234");
    const preferred = params.preferChannel;

    if (preferred !== "sms" && isNigerian) {
      const result = await this.tryWhatsApp(params);
      if (result.delivered) return result;
    }

    const smsResult = await this.trySMS(params);
    if (smsResult.delivered) return smsResult;

    return {
      delivered: false,
      channel: "sms",
      error: "All delivery channels failed",
    };
  }

  private async tryWhatsApp(params: SendOTPParams): Promise<OTPResult> {
    try {
      const messageId = await this.whatsapp.sendOTP({
        to: params.to,
        code: params.code,
        name: params.name,
        purpose: params.purpose,
      });
      return { delivered: true, channel: "whatsapp", messageId };
    } catch (e) {
      return { delivered: false, channel: "whatsapp", error: String(e) };
    }
  }

  private async trySMS(params: SendOTPParams): Promise<OTPResult> {
    try {
      const messageId = await this.termii.sendOTP({
        to: params.to,
        code: params.code,
        purpose: params.purpose,
      });
      return { delivered: true, channel: "sms", messageId };
    } catch (e) {
      return { delivered: false, channel: "sms", error: String(e) };
    }
  }
}
```

**WhatsApp template (submitted to Meta for approval):** `boldmind_otp`, category `AUTHENTICATION`, body variables `{{1}}` name, `{{2}}` code, `{{3}}` purpose label, `{{4}}` expiry ("15 minutes").

**Termii fallback:** channel `dnd` (DND bypass for transactional messages), sender ID `BOLDMIND` (NCC-registered).

### 11.3 Integration in boldmind-service

```typescript
// BEFORE (SMS only):
await this.termii.send({ to: phone, message: `Your code: ${code}` });

// AFTER (WhatsApp first, SMS fallback):
const result = await this.otpService.send({
  to: phone,
  code: otp,
  purpose: "phone_verify",
  name: user.name.split(" ")[0],
});
// Store result.channel in OTPVerification.metadata for debugging
```

---

## 12. EduCenter — All Learning Verticals

Confirmed existing routes in `educenter-web`: `app/(dashboard)/{business-school,dashboard,study-hub/*,subscription}/page.tsx`.

### 12.1 LMS Builder

**Frontend routes:** `app/(dashboard)/lms/{page,create,templates}.tsx`, `app/(dashboard)/lms/[courseId]/{page,lessons,students,earnings}.tsx`

**Backend:** `src/modules/educenter/lms/` (`lms.controller.ts`, `lms.service.ts`) — uses existing `Course`/`CourseLesson`/`CourseEnrollment` models, no new Prisma models needed.

Live endpoints confirmed (`LmsController`, prefix `/api/v1/educenter/lms`):

```text
POST   /educenter/lms/courses                 → create course
GET    /educenter/lms/courses                 → list instructor's courses
GET    /educenter/lms/courses/:id             → course details + lessons
PATCH  /educenter/lms/courses/:id             → update course
POST   /educenter/lms/courses/:id/publish     → publish
POST   /educenter/lms/courses/:id/lessons     → add lesson
PATCH  /educenter/lms/lessons/:id             → update lesson
DELETE /educenter/lms/lessons/:id             → delete lesson
GET    /educenter/lms/courses/:id/students    → enrolled students
GET    /educenter/lms/courses/:id/earnings    → revenue breakdown
POST   /educenter/lms/generate                → AI-generate course outline (queued job)
```

### 12.2 School Management Portal

Licensed at ₦500/student/term. `School` Prisma model in §5.1.

**Frontend:** `app/(dashboard)/school/{page,students,teachers,classes,assignments,results,billing}.tsx`

Live endpoints (`SchoolController`, prefix `/api/v1/educenter/schools`):

```text
POST /educenter/schools/register        → school admin registers school
GET  /educenter/schools/me              → my school dashboard
POST /educenter/schools/me/students     → bulk enroll (CSV or array)
GET  /educenter/schools/me/students     → paginated student list
GET  /educenter/schools/me/performance  → class-level analytics
POST /educenter/schools/me/assignments  → create assignment for a class
```

### 12.3 AI Course Generator

Instructor provides `{ topic, targetAudience, level, numberOfModules, includeQuizzes }` → `POST /educenter/lms/generate` queues to `ai-generation` → poll job → editable preview before saving. System prompt: expert curriculum designer for Nigerian students and entrepreneurs.

### 12.4 Business School + Playbooks

**Frontend:** `app/(dashboard)/business-school/{page,playbooks/*,courses/*,certificates}.tsx`, plus public `app/prompts/{page,[slug]}.tsx`

**Gating pattern (applies to prompts, courses, playbooks alike):** first 6 items public (`isPublic=true`, no auth), remainder auth-gated, premium items Pro-subscription-gated. Download-as-PDF is Pro-only regardless of auth status.

`PromptTemplate` and `Playbook` MongoDB schemas — full definitions in §12.6.

### 12.5 Vibe Coders Classroom

Lives at `villagecircle.ng/vibe-coders/portal/*` (or `/vibecoders/*` per live routes — see §6.3 drift note). Curriculum data source is static: `lib/vibe-coders/curriculum-data.ts` — intentional, not CMS-driven.

Session types: self-paced modules (Cloudflare Stream + reading), live cohort sessions (external Zoom/Meet + attendance log), project submissions (GitHub + Loom + brief), mentor 1:1s (Calendly per mentor).

Prisma models `VibeCoderProjectSubmission`/`VibeCoderAttendance` in §5.1. Endpoints:

```text
GET   /villagecircle/vibecoders/portal/curriculum
GET   /villagecircle/vibecoders/portal/curriculum/:moduleId
POST  /villagecircle/vibecoders/portal/projects
GET   /villagecircle/vibecoders/portal/projects
PATCH /villagecircle/vibecoders/portal/projects/:id     (mentor only)
POST  /villagecircle/vibecoders/portal/attendance
GET   /villagecircle/vibecoders/portal/mentors
```

### 12.6 MongoDB Schemas

```typescript
// src/modules/educenter/schemas/prompt-template.schema.ts
@Schema({ timestamps: true, collection: "prompt_templates" })
export class PromptTemplate {
  @Prop({ required: true, unique: true }) slug: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) description: string;
  @Prop({ required: true }) category: string;
  @Prop({ required: true }) template: string;
  @Prop({ type: [String] }) variables: string[];
  @Prop({ default: false }) isPublic: boolean;
  @Prop({ default: false }) isPremium: boolean;
  @Prop({ default: 0 }) usageCount: number;
  @Prop({ type: [String] }) tags: string[];
  @Prop() authorId?: string;
}

// src/modules/educenter/schemas/playbook.schema.ts
@Schema({ timestamps: true, collection: "playbooks" })
export class Playbook {
  @Prop({ required: true, unique: true }) slug: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) description: string;
  @Prop({ required: true }) category: string;
  @Prop() thumbnailUrl: string;
  @Prop({ default: false }) isPublic: boolean;
  @Prop({ default: false }) isPremium: boolean;
  @Prop({ required: true }) content: string;
  @Prop({ type: Object }) sections: Array<{ heading: string; body: string }>;
  @Prop({ type: [String] }) tags: string[];
  @Prop({ default: 0 }) viewCount: number;
  @Prop({ default: 0 }) downloadCount: number;
  @Prop() authorId?: string;
  @Prop() publishedAt?: Date;
}
```

---

## 13. Enterprise API & Developer Platform

### 13.1 What It Is

Selected APIs exposed for (1) enterprise clients integrating BoldmindNG tools, (2) third-party developers building on AmeboGist, PlanAI, or EduCenter data.

### 13.2 Module Structure

```text
src/modules/api/
├── api.module.ts
├── api-key/{api-key.controller,api-key.service,api-key.guard}.ts
├── enterprise/{enterprise.controller,enterprise.service}.ts
└── rate-limit/api-rate-limit.guard.ts
```

`ApiKey`/`WebhookSubscription` Prisma models in §5.1. `WebhookDelivery` Mongo schema below.

**Scopes:**

```typescript
export const API_SCOPES = {
  "amebogist:read": "Read published articles and categories",
  "educenter:questions": "Fetch exam questions (JAMB/WAEC/NECO)",
  "educenter:submit": "Submit quiz attempts on behalf of students",
  "planai:social:generate": "Generate social media captions",
  "planai:branding:logo": "Generate logos",
  "villagecircle:waitlist": "Add emails to concept waitlists",
  "users:profile:read": "Read authenticated user profile",
  "payments:verify": "Verify payment status by reference",
  "webhook:subscribe": "Subscribe to BoldmindNG webhook events",
  "polymind:query": "Query PolyMind multi-model comparison",
} as const;
```

### 13.3 API Key Authentication Guard

```typescript
// src/modules/api/api-key/api-key.guard.ts

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const rawKey = req.headers["x-api-key"] as string;

    if (!rawKey || !rawKey.startsWith("bm_")) {
      throw new UnauthorizedException("Valid X-API-Key header required");
    }

    const prefix = rawKey.slice(0, 8);
    const rateLimitKey = `apikey:ratelimit:${prefix}`;
    const count = await this.redis.session.incr(rateLimitKey);
    if (count === 1) await this.redis.session.expire(rateLimitKey, 3600);

    const cacheKey = `apikey:meta:${prefix}`;
    const cached = await this.redis.cache.get(cacheKey);

    let keyRecord: ApiKey;
    if (cached) {
      keyRecord = JSON.parse(cached);
    } else {
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      keyRecord = await this.prisma.apiKey.findUniqueOrThrow({
        where: { keyHash },
      });
      await this.redis.cache.setex(cacheKey, 300, JSON.stringify(keyRecord));
    }

    if (!keyRecord.isActive) throw new UnauthorizedException("API key revoked");
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      throw new UnauthorizedException("API key expired");
    }
    if (count > keyRecord.rateLimit) {
      throw new HttpException(
        "Rate limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    req["apiKey"] = keyRecord;
    req["apiKeyUserId"] = keyRecord.userId;

    this.prisma.apiKey
      .update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } })
      .catch(() => null);

    return true;
  }
}
```

### 13.4 Endpoints (all confirmed live)

```text
── API Key Management ──────────────────────────────────────────
POST   /api/v1/developer/keys              → create key, returns full key ONCE
GET    /api/v1/developer/keys              → list (prefix + scopes, no full key)
DELETE /api/v1/developer/keys/:id          → revoke
GET    /api/v1/developer/keys/validate     → X-API-Key auth, returns scopes

── Public/Enterprise API (X-API-Key auth) ──────────────────────
GET  /api/v1/public/amebogist/posts              → amebogist:read
GET  /api/v1/public/amebogist/posts/:slug        → amebogist:read
GET  /api/v1/public/educenter/questions          → educenter:questions
POST /api/v1/public/educenter/submit             → educenter:submit
POST /api/v1/public/planai/social/caption        → planai:social:generate
POST /api/v1/public/planai/branding/logo         → planai:branding:logo
POST /api/v1/public/villagecircle/waitlist/:slug → villagecircle:waitlist
GET  /api/v1/public/payments/verify/:reference   → payments:verify

── Webhooks ─────────────────────────────────────────────────────
POST   /api/v1/developer/webhooks   → subscribe { url, events[], secret }
GET    /api/v1/developer/webhooks   → list subscriptions
DELETE /api/v1/developer/webhooks/:id → unsubscribe

Outgoing events: payment.success, payment.failed, subscription.activated,
subscription.cancelled, article.published, user.registered,
vibecoders.applicant.applied
```

### 13.5 Developer Documentation Page

`app/(public)/developers/{page,docs/*,keys,webhooks}.tsx` in `boldmind-web`, rendered via `@scalar/api-reference` fed by `packages/api-docs` OpenAPI JSON — no hand-written markdown.

### 13.6 WebhookDelivery Mongo Schema

```typescript
// src/modules/api/schemas/webhook-delivery.schema.ts
@Schema({ timestamps: true, collection: "webhook_deliveries" })
export class WebhookDelivery {
  @Prop({ required: true }) subscriptionId: string;
  @Prop({ required: true }) event: string;
  @Prop({ type: Object }) payload: Record<string, any>;
  @Prop({ required: true }) status: string; // pending | delivered | failed
  @Prop() responseCode?: number;
  @Prop() responseBody?: string;
  @Prop({ default: 0 }) attempts: number;
  @Prop() nextRetryAt?: Date;
  @Prop() deliveredAt?: Date;
}
```

---

## 14. Changelog, Docs & Status Pages

### 14.1 Changeset workflow (boldmind-shared)

```bash
pnpm changeset          # 1. describe what changed → .changeset/<name>.md
pnpm changeset version  # 2. bump versions + update CHANGELOG.md, delete changeset files
pnpm changeset publish  # 3. build + publish to GitHub Packages, tag release
```

CI triggers (`.github/workflows/release.yml`): merge to main → `changeset version` + commit; release tag → `changeset publish`. Each `CHANGELOG.md` entry should reference affected `BOLDMIND_PRODUCTS` slugs so `/changelog` can deep-link.

### 14.2 Public Changelog Page

`app/(public)/changelog/{page,[version]}.tsx` in `boldmind-web`, sourced from `packages/api-docs/src/changelog.ts` (ISR, revalidate 3600s).

```typescript
interface ChangelogEntry {
  version: string;
  date: string;
  packages: string[];
  type: "major" | "minor" | "patch";
  summary: string;
  highlights: string[];
  breaking?: string[];
  products?: string[];
}
```

### 14.3 System Status Page

`app/(public)/status/page.tsx` — polls `/health`, stores uptime in lightweight `SystemStatus` table, or via BetterUptime/UptimeRobot webhook.

---

## 15. PolyMind Chrome Extension

### 15.1 Overview

**Name:** Boldmind PolyMind — Multi-Model AI Comparator. **Manifest:** V3. **Repo:** `polymind-extension`. **Auth:** `X-API-Key` (from `/developer/keys`) — never SSO JWT, extensions can't rely on cookies.

### 15.2 Architecture: Proxy Through boldmind-service

Extension never calls OpenAI/Anthropic/Google directly — all calls route through `api.boldmind.ng/api/v1/polymind/:provider`, keeping keys server-side and enabling per-key rate limiting/billing.

```text
src/modules/polymind/
├── polymind.module.ts
├── polymind.controller.ts   ← POST /polymind/:provider (ApiKeyGuard, scope polymind:query)
└── polymind.service.ts       ← fans out to existing AI providers
```

Live endpoints confirmed: `POST /polymind/:provider`, `GET /polymind/history` — both `X-API-Key` with `polymind:query` scope.

### 15.3 Supported Models

GPT-4o (OpenAI), Claude Sonnet (Anthropic), Gemini Pro (Google), LLaMA 3.1 70B (Meta/Groq), Mistral Large — each proxied via its own `/api/v1/polymind/{provider}` route.

### 15.4 Repository Structure

```text
polymind-extension/
├── manifest.json
├── src/
│   ├── popup/{main.tsx, Popup.tsx, components/*}
│   ├── sidepanel/{main.tsx, SidePanel.tsx}
│   ├── background/service-worker.ts
│   ├── content/content.ts
│   └── lib/{api,models,storage,types}.ts
└── vite.config.ts   ← Vite + CRXJS plugin for MV3
```

### 15.5 UI Flow

First run: popup → `ApiKeySetup.tsx` → opens `boldmind.ng/developers` → paste key → `chrome.storage.local`. Normal use: prompt input → model selector (default GPT-4o + Claude) → parallel `Promise.allSettled()` calls → cards fill in as responses arrive → copy/rate/save. Context menu: right-click selected text → "Compare in PolyMind."

### 15.6 Pricing

Free tier: 50 comparisons/month, 2 models, last-10 history. Pro (₦3,500/mo): unlimited comparisons, all 5 models, unlimited history, PDF export, custom system prompts.

---

## 16. Background Jobs — Queue Map

Uses **REDIS_QUEUE** instance exclusively for BullMQ.

| Queue                 | Processor                                      | Priority     | Retries | Notes                 |
| --------------------- | ---------------------------------------------- | ------------ | ------- | --------------------- |
| `email-notifications` | `automation/queue/email-campaign.processor.ts` | 5 (Normal)   | 3× exp  | Via Resend            |
| `sms-otp`             | `notification/notification.service.ts`         | 2 (High)     | 2×      | WhatsApp→SMS fallback |
| `social-publishing`   | `automation/queue/social-post.processor.ts`    | 5            | 2×      | Delayed jobs          |
| `ai-generation`       | `automation/queue/ai-jobs.processor.ts`        | 5            | 2×      | Provider fallback     |
| `image-generation`    | `ai/processors/social-factory.processor.ts`    | 5            | 1×      | fal.ai → DALL-E       |
| `payroll-processing`  | `planai/processors/planai.processor.ts`        | 3 (High)     | 0       | Idempotent            |
| `media-processing`    | `media/media.service.ts`                       | 5            | 2×      | R2 upload + scan      |
| `payment-webhook`     | `payment/payment.service.ts`                   | 1 (Critical) | 5× 10s  | Paystack retries 72hr |
| `wallet-credit`       | `wallet/wallet.service.ts`                     | 2 (High)     | 3×      | Must succeed          |
| `trend-analysis`      | `ai/services/trend.service.ts`                 | 8 (Low)      | 1×      | Cron every 2h         |
| `kolo-reminders`      | `villagecircle/kolo-ai/kolo-ai.service.ts`     | 5            | 1×      | WhatsApp reminders    |
| `polymind-query`      | `polymind/polymind.service.ts`                 | 5            | 1×      | Fan-out AI calls      |
| `webhook-delivery`    | `api/webhook-delivery.service.ts`              | 5            | 3× exp  | Enterprise webhooks   |
| `ndpa-erasure`        | `user/user.service.ts`                         | 9 (Low)      | 0       | Cron: daily           |
| `seo-sitemap`         | `amebogist/rss.service.ts`                     | 9 (Low)      | 0       | Cron: nightly         |

Full typed `queues.ts` constants file — see §25 Appendix B.

---

## 17. Known Issues & Required Fixes

### 17.1 `kolo-ai/translation.schema.ts` — Probable Misnaming

```text
Current:  src/modules/villagecircle/kolo-ai/translation.schema.ts
Expected: src/modules/villagecircle/kolo-ai/kolo-group.schema.ts
```

Rename when building the Wave 5 KoloAI feature; update the import in `kolo-ai.module.ts`.

### 17.2 Google OAuth Double-Call Bug — Launch-Blocking

```typescript
// ❌ CURRENT (BUG):
const relayToken = await this.ssoService.createRelayToken(user.id, accessToken);
const relayUrl = await this.ssoService.createRelayToken(returnUrl, relayToken); // ← WRONG

// ✅ FIX:
const relayUrl = await this.ssoService.buildSsoRelayUrl(
  user.id,
  accessToken,
  returnUrl,
  {},
);
return res.redirect(relayUrl);
```

Do not ship Google OAuth cross-domain redirects until `buildSsoRelayUrl` replaces the second `createRelayToken` call.

### 17.3 Wallet credit not wired to Paystack webhook

`payment.service.ts` — add `walletService.credit()` on `charge.success` with `productSlug='wallet-topup'` only (not for subscriptions).

### 17.4 SMS OTP queue processor missing

`notification.service.ts` — implement `sms-otp` processor using `@boldmindng/sms`.

### 17.5 `@boldmindng/payments` — Server-Only Warning

Must never appear in any Next.js frontend `package.json` — contains secret payment SDK clients. Frontends use `paymentApi` from `@boldmindng/api-client` exclusively.

### 17.6 Live-routes drift

See §6.3 for the full reconciliation table between designed contract and actually-deployed routes.

---

## 18. Cross-App Package Usage Matrix

| Package                  |    boldmind-web     | planai-suite | amebogist-web | educenter-web | villagecircle-web |      boldmind-service      | polymind-extension |
| ------------------------ | :-----------------: | :----------: | :-----------: | :-----------: | :---------------: | :------------------------: | :----------------: |
| `utils`                  |         ✅          |      ✅      |      ✅       |      ✅       |        ✅         | ✅ (products/pricing only) |         ➖         |
| `ui`                     |         ✅          |      ✅      |      ✅       |      ✅       |        ✅         |             ➖             |    ➖ (own UI)     |
| `auth`                   |         ✅          |      ✅      |      ✅       |      ✅       |        ✅         |             ➖             |         ➖         |
| `api-client`             |         ✅          |      ✅      |      ✅       |      ✅       |        ✅         |             ➖             |  ✅ (apikey mode)  |
| `analytics`              |         ✅          |      ✅      |      ✅       |      ✅       |        ✅         |             ➖             |         ➖         |
| `email`/`payments`/`sms` |         ➖          |      ➖      |      ➖       |      ➖       |        ➖         |          ✅ only           |         ➖         |
| `wallet`                 |         ✅          |      ➖      |      ➖       |      ➖       |        ➖         |    ➖ (Prisma directly)    |         ➖         |
| `api-docs`               | ✅ (changelog/docs) |      ➖      |      ➖       |      ➖       |        ➖         |    ➖ (source of spec)     |         ➖         |
| `pwa`                    |         ✅          |      ➖      |   ✅ (TWA)    |   ✅ (TWA)    |        ➖         |             ➖             |         ➖         |
| `deploy-config`          |         ✅          |      ✅      |      ✅       |      ✅       |        ✅         |             ✅             |         ➖         |

**Rules from this matrix:** `email`/`payments`/`sms` server-side only; `wallet` client-side helper only (never talks to DB directly); `polymind-extension` uses `api-client` in `apikey` mode only; `boldmind-service` uses `utils` only for `BOLDMIND_PRODUCTS`/`BOLDMIND_PRICING` constants.

---

## 19. Deployment & Operations

- **Vercel** — all frontends, auto-deploy on main push
- **Railway** — `boldmind-service` via Dockerfile
- **GitHub Actions** — `boldmind-shared` packages via changeset publish
- **Chrome Web Store** — manual submit for `polymind-extension`

---

## 20. Environment Variables — CANONICAL (authoritative)

> **This section replaces every other environment-variable list in this document's source material** (the old v2.2.2 §9, v2.1 §21, and the canonical doc's §5 all had drift, duplicate names, and gaps). It is sourced entirely from the dedicated env reconciliation pass and is the **only** list that should be used going forward. `@boldmindng/deploy-config`'s `APP_ENV_SCHEMAS` should be updated to match this exactly.

### 20.1 Duplicate/alias resolutions applied

| Concern                                      | Names previously in use                                                           | Canonical name kept                        | Why                                                                                                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp access token                        | `META_WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_TOKEN`      | `META_WHATSAPP_ACCESS_TOKEN`               | Matches `WhatsAppProvider` constructor spec                                                                                                                                                                                                              |
| WhatsApp phone number ID                     | `META_WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_PHONE_NUMBER_ID`                       | `META_WHATSAPP_PHONE_NUMBER_ID`            | Same                                                                                                                                                                                                                                                     |
| Webhook verify token                         | `META_VERIFY_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `META_VERIFY_TOKEN`                        | Used by `GET /planai/social/webhook` handshake                                                                                                                                                                                                           |
| Webhook payload signature secret             | `META_APP_SECRET`                                                                 | `META_APP_SECRET` (new, not a duplicate)   | HMAC-signs inbound webhook payloads — distinct from the verify token. **Confirm the webhook handler actually validates this signature; if not, that's a real security gap.**                                                                             |
| Gemini key                                   | `GEMINI_API_KEY`, `GOOGLE_GEMINI_API_KEY`                                         | `GOOGLE_GEMINI_API_KEY`                    | Matches `ai/providers/gemini.provider.ts`                                                                                                                                                                                                                |
| ALOC key                                     | `ALOC_API_KEY` (old docs) vs `ALOC_API_TOKEN` (live env)                          | `ALOC_API_TOKEN`                           | Live env is deployed reality; docs were wrong                                                                                                                                                                                                            |
| Hunter.io key (Business Discovery Directory) | `HUNTER_API_KEY`, `HUNTER_IO_API_KEY`                                             | `HUNTER_IO_API_KEY`                        | Newly documented — confirmed live via `BizDirectoryController`                                                                                                                                                                                           |
| Cloudflare R2 bucket                         | `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_BUCKET_NAME`                               | `CLOUDFLARE_R2_BUCKET_NAME`                | —                                                                                                                                                                                                                                                        |
| MongoDB connection                           | `MONGODB_URI` (old docs) vs `MONGODB_URL` (live env)                              | `MONGODB_URL`                              | Live env is deployed reality; docs were wrong                                                                                                                                                                                                            |
| Redis legacy single instance                 | `REDIS_URL` alongside the 3-way split                                             | **Retired** — drop entirely                | Leftover from before Wave-0 split. **If anything still reads bare `REDIS_URL`, that's a Wave-0 regression — grep and fix before anything else**                                                                                                          |
| JWT signing secret                           | `JWT_SECRET` (old docs) vs `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` (live env)  | `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` | Live setup is better practice (separate secrets per token type); confirm they're genuinely different values, not one secret read twice                                                                                                                   |
| Frontend URLs / CORS                         | `FRONTEND_URL`, `FRONTEND_URLS`, `ALLOWED_ORIGINS`, `CORS_ORIGINS`                | `FRONTEND_URLS` (comma list) only          | `CORS_ORIGINS` retired — `getCorsOrigins()` derives from `FRONTEND_URLS` at runtime. `ALLOWED_ORIGINS`/singular `FRONTEND_URL` likely a per-app local var — rename scoped as `NEXT_PUBLIC_APP_URL` if so, don't conflate with the service-wide CORS list |
| Service/app base URL                         | `APP_URL` vs `HUB_URL`                                                            | Both, scoped differently                   | `HUB_URL` = always `https://boldmind.ng` (post-login redirect). `APP_URL`'s purpose needs confirming — keep separate if it's the service's own base URL for absolute links in emails/webhooks, delete if it duplicates `HUB_URL`                         |

### 20.2 Canonical variable list

```env
# ─── DATABASE ─────────────────────────────────────────────────────────────────
DATABASE_URL=                              # Neon PostgreSQL (Prisma)
MONGODB_URL=                                # MongoDB Atlas (Mongoose) — NOT MONGODB_URI
MONGODB_DB_MAIN=
MONGODB_DB_AMEBOGIST=

# ─── REDIS (3 instances — bare REDIS_URL is retired, see §20.1) ───────────────
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
GOOGLE_GEMINI_API_KEY=
GROQ_API_KEY=
CLOUDFLARE_AI_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
FAL_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434      # local dev only

# ─── COMMUNICATIONS ───────────────────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=                                  # Resend "from" address
TERMII_API_KEY=
TERMII_SENDER_ID=BOLDMIND
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_APP_SECRET=                             # HMAC-validates inbound webhook payloads — verify this is actually checked
META_VERIFY_TOKEN=

# ─── STORAGE ──────────────────────────────────────────────────────────────────
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_CDN_URL=                          # public media URL prefix, separate from R2 API endpoint
CLOUDFLARE_STREAM_TOKEN=

# ─── INTEGRATIONS ─────────────────────────────────────────────────────────────
ALOC_API_TOKEN=                              # NOT ALOC_API_KEY — live env is authoritative
ALOC_BASE_URL=
HUNTER_IO_API_KEY=                           # Business Discovery Directory (Hunter.io)

# ─── DRIVE AUTOMATION BRIDGE ───────────────────────────────────────────────────
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
APP_URL=                                     # pending decision — confirm purpose vs HUB_URL, see §20.1
HUB_URL=https://boldmind.ng                  # used in auth.controller.ts post-login redirect
FRONTEND_URLS=https://boldmind.ng,https://planai.boldmind.ng,https://educenter.com.ng,https://villagecircle.ng,https://amebogist.ng
                                              # canonical comma-list; CORS_ORIGINS/ALLOWED_ORIGINS/singular FRONTEND_URL retire into this
```

**Frontend env vars (all 5 Next.js apps):**

```env
# Common:
NEXT_PUBLIC_API_URL=https://api.boldmind.ng/api/v1
NEXT_PUBLIC_HUB_URL=https://boldmind.ng
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Per-app:
NEXT_PUBLIC_APP_URL=                        # change per app
NEXT_PUBLIC_PRODUCT_SLUG=                   # change per app

# Server-side only (no NEXT_PUBLIC_ prefix):
SSO_EXCHANGE_URL=https://api.boldmind.ng/api/v1/auth/sso/exchange
```

**CI/local-dev only — do NOT put in Railway service env (no prod-time access needed):**

```text
GITHUB_TOKEN
NODE_AUTH_TOKEN
```

### 20.3 Action checklist before treating this as fully reconciled

```text
[ ] Grep the 6 WhatsApp/Meta var name variants across notification/ and packages/sms/ —
    confirm which is actually read, consolidate to the canonical name above
[ ] Grep bare REDIS_URL specifically — any hit outside a one-time migration script
    is a Wave-0 regression; fix before anything else in this checklist
[ ] Confirm JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are genuinely different values
[ ] Decide what APP_URL is actually for — keep separate from HUB_URL or delete
[ ] Confirm META_APP_SECRET is actually used to validate inbound webhook signatures
[ ] Move GITHUB_TOKEN/NODE_AUTH_TOKEN out of Railway service env if present there
[ ] Update @boldmindng/deploy-config's APP_ENV_SCHEMAS to match §20.2 exactly so
    validateEnv() enforces this list going forward instead of drifting again
```

---

## 21. Migration Waves

### Wave 0 — Redis Split (do before any other work)

1. Provision 3 Redis instances
2. Rewrite `src/database/redis.service.ts` to 3 connections (§25)
3. Update BullMQ config to use `redis.queue` only
4. Migrate SSO relay/rate-limit keys from old single Redis to `REDIS_SESSION`
5. Deploy → verify BullMQ workers still process jobs
6. **Also grep for any remaining bare `REDIS_URL` reads (§20.3) — this is effectively part of Wave 0 even though it was caught later**

### Wave 1 — Foundation Data Models (weeks 1–3)

Prisma: Wallet/WalletLedger/enums, Referral/AffiliateEarning, ApiKey/WebhookSubscription, School, VibeCoderProjectSubmission/Attendance. Build `wallet/` module, wire wallet credit to Paystack `charge.success`, build `@boldmindng/sms`, upgrade `auth.service.ts` OTP, fix Google OAuth bug (§17.2).

### Wave 2 — PlanAI Completion (weeks 3–7)

CRM full CRUD + WhatsApp sync, HR & Payroll full flow, AI Business Agent, Business Intelligence unification, Marketplace escrow.

### Wave 3 — Education Platform (weeks 5–9)

LMS Builder routes + API, AI Course Generator job, School Portal, Prompt Library + Playbook Mongo schemas, Vibe Coders classroom API. Create `educenter-lms.api.ts` + `educenter-school.api.ts` (now confirmed already present per §7.4).

### Wave 4 — Enterprise API & PolyMind (weeks 8–12)

`src/modules/api/`, `@boldmindng/api-docs`, developer portal pages, changelog page, `src/modules/polymind/`, `polymind-extension` repo, Chrome Web Store submission. **All of these are confirmed already live per §6.3/§13/§15 — this wave is effectively complete; remaining work is documentation reconciliation, not new build.**

### Wave 5 — VillageCircle Concepts (weeks 10–16)

KoloAI, ReceiptGenius, BorderlessRemit, PowerAlert, FarmGate — one at a time per product status change in `products.ts`.

### Wave 6 — Platform Hardening (ongoing)

PgBouncer in front of Neon, full NDPA erasure pipeline, PostHog session replays, structured logging (Datadog/Axiom), k6 load test at 1000 concurrent users.

---

## 22. Master Output Checklist

Use for every code generation task, PR, scaffold, or AI-generated output.

### A — Foundation

```text
[ ] A1. Stack: next 16.2, react 19.2, pnpm 10.34.1, node 22.22.3. App Router only.
[ ] A2. Products/pricing/colors read from BOLDMIND_PRODUCTS/PRICING/COLOR_SCHEMES — never hardcoded.
[ ] A3. Check the project tree before inventing file paths.
[ ] A4. Field names match prisma/schema.prisma exactly. *NGN fields actually store kobo.
[ ] A5. Storage: kobo (integer). Display: formatNaira(kobo) → ₦12,500.
[ ] A6. Timestamps stored UTC, displayed Africa/Lagos via formatLagosDate().
[ ] A7. Mobile-first: functional at 375px, touch targets ≥44×44px, body font ≥14px.
```

### B — Auth & SSO

```text
[ ] B1. JWT access 15-min expiry, never localStorage — in-memory Zustand store.
[ ] B2. boldmind_sso cookie set/cleared ONLY by boldmind-service.
[ ] B3. Relay token one-time use, deleted from REDIS_SESSION on exchange.
[ ] B4. OTP order: WhatsApp → SMS (Termii) → email (email_verify only). Log channel used.
[ ] B5. Protected routes via createAuthMiddleware per app (dashboard/*, start/*, lms/*, portal/*).
[ ] B6. Use buildSsoRelayUrl (§17.2), never two createRelayToken calls.
```

### C — Redis

```text
[ ] C1. Three instances used correctly: SESSION (tokens/OTP/limits/flags), QUEUE (BullMQ only), CACHE (ALOC/rates/stats).
[ ] C2. BullMQ connection is ALWAYS redis.queue, never session or cache.
[ ] C3. Key naming: {namespace}:{entity}:{id}.
```

### D — Wallet

```text
[ ] D1. All mutations inside Prisma $transaction; every mutation creates a WalletLedger row.
[ ] D2. Daily cap checked via resetDailyDebitIfNeeded before every debit (₦50k Tier1 / ₦5M Tier2).
[ ] D3. Wallet credited on payment webhook only for productSlug='wallet-topup', never for subscriptions.
[ ] D4. Frontend reads GET /api/v1/wallet; dashboard page at app/(dashboard)/dashboard/wallet/page.tsx.
```

### E — API & File Structure

```text
[ ] E1. Success = data directly. Error = {statusCode, message, error, timestamp, path}. Paginated = {data,total,page,pageSize,totalPages,hasNext,hasPrev}.
[ ] E2. All DTOs use class-validator. Phone: @IsPhoneNumber('NG'). Money: @IsInt() @Min(1) (kobo).
[ ] E3. /api/v1/public/* uses ApiKeyGuard + scope check. /api/v1/developer/* uses JwtAuthGuard.
[ ] E4. Reconcile designed vs live routes per §6.3 before assuming either is current.
```

### F — EduCenter

```text
[ ] F1–F3. Prompt/course/playbook gating: 6 public, rest auth-gated, premium Pro-gated, downloads always Pro-only.
[ ] F4. ALOC cached in REDIS_CACHE, key aloc:{subject}:{examType}:{year}, TTL 24h.
[ ] F5. School portal: one adminUserId = one school, enforce usedSlots < studentSlots.
[ ] F6. Vibe Coders classroom requires VibeCoderApplicant.status = ENROLLED; curriculum from static file, not API.
```

### G — PolyMind Extension

```text
[ ] G1. X-API-Key auth only, stored in chrome.storage.local — never localStorage/cookies.
[ ] G2. All AI calls proxied through /api/v1/polymind/:provider — never direct provider calls.
[ ] G3. Promise.allSettled() for parallel model calls.
[ ] G4. polymind:query scope required, checked in ApiKeyGuard.
[ ] G5. Manifest V3 — service worker only, fetch() only, no XMLHttpRequest in content scripts.
```

### H — Changeset & Docs

```text
[ ] H1. changeset → changeset version → changeset publish workflow.
[ ] H2. /changelog reads from packages/api-docs (ISR revalidate 3600s).
[ ] H3. /developers renders OpenAPI spec via @scalar/api-reference; new endpoints need @ApiOperation/@ApiResponse.
```

### I — Security

```text
[ ] I1. ApiKey.keyHash is SHA-256 only; full key shown once at creation.
[ ] I2. Outgoing webhooks signed HMAC-SHA256, header X-BoldmindNG-Signature.
[ ] I3. BVN/NIN never stored plain, never returned in API responses.
[ ] I4. Locked wallets (isLocked=true) reject ALL debits with 403; lock/unlock admin-only.
[ ] I5. Paystack webhook: HMAC-SHA512 of raw body verified BEFORE queueing; 400 immediately if invalid.
```

---

## 23. Package Audit Checklists

Run these every time the corresponding package is touched.

**`@boldmindng/utils`** — constants are re-exports not copies; `formatNaira()` divides by 100 + `toLocaleString('en-NG')`; `useStorage` is client-only, not confused with Prisma/Redis.

**`@boldmindng/ui`** — `SuperNavbar`/`SuperFooter` read from `utils` helpers, no hardcoded nav; `InstallPromptBanner` only for `product.twa !== undefined`; CSS variables for product colors, no hex literals; `PricingContent` reads `BOLDMIND_PRICING`.

**`@boldmindng/auth`** — `createAuthMiddleware` paths match §22 B5; `buildSsoRelayUrl` used (§17.2); zero `localStorage` anywhere.

**`@boldmindng/api-client`** — every function returns unwrapped data; all 5 newer files (`wallet`, `developer`, `polymind`, `educenter-lms`, `educenter-school`) present (confirmed, §7.4); `client.ts` supports dual auth mode.

**`@boldmindng/sms`** — `boldmind_otp` WhatsApp template Meta-approved before go-live; send order WhatsApp→Termii→email; channel logged to `OTPVerification.metadata`.

**`@boldmindng/wallet`** — `WalletSource` union matches Prisma enum exactly (9 values); `useWallet` invalidates on payment success/referral conversion/marketplace payout.

**`@boldmindng/api-docs`** — `@scalar/api-reference` consumes `openapi.json`; `getChangelog` maps `products?` via `BOLDMIND_PRODUCTS` slugs.

**`@boldmindng/pwa`** — `generateManifest` guards on `product.twa !== undefined`; `registerServiceWorker` no-op outside production; VAPID keys in both service env and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

**`@boldmindng/deploy-config`** — `APP_ENV_SCHEMAS` matches §20.2 exactly; `DOMAIN_CONFIG` includes `planai.boldmind.ng` + `marketplace.boldmind.ng`; CSP `connect-src` includes `https://api.boldmind.ng`; `generateVercelConfig` preserves `?sso_token=`.

---

## 24. Appendix A: Database ER Diagram

```text
User ──┬─ Wallet ──┬─ WalletLedger
       ├─ ApiKey
       ├─ Subscription ── Payment
       ├─ School (admin)
       ├─ CourseEnrollment ── Course
       ├─ VibeCoderApplicant ── VibeCoderProjectSubmission / VibeCoderAttendance
       ├─ CRMContact ── CRMDeal ── CRMPipeline
       ├─ HREmployee
       ├─ Storefront ── Product ── Order
       ├─ Referral (as Referrer / Referred)
       ├─ AffiliateEarning
       ├─ WebhookSubscription
       └─ MarketplaceListing ── MarketplaceBooking
```

---

## 25. Appendix B: Redis Reference Implementation

```typescript
// src/database/redis.service.ts — COMPLETE FILE
import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly session: Redis;
  readonly queue: Redis;
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

```typescript
// src/common/constants/queues.ts — FULL FILE
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

## 26. Appendix C: Individual App Onboarding

Per-repo startup instructions — see each repo's own README and project-tree doc. Always attach the relevant project tree before generating code for any repo; never infer file paths from this document alone.

---

_BoldmindNG Master Design v3.0 (Unified) | July 2026_
_Supersedes: Master Design v2.2.2 + System Design v2.1_
_Env authority: §20, sourced from the dedicated env reconciliation pass — do not reintroduce the old env sections from either source doc_
_Next review trigger: any change to products.ts, pricing.ts, colors.ts, schema.prisma, or a live-route diff against §6.3_
