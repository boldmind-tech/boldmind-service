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
25. [Appendix B: Redis & Queue Reference Implementation](#25-appendix-b-redis--queue-reference-implementation)
26. [Appendix C: Individual App Onboarding](#26-appendix-c-individual-app-onboarding)
27. [Social Media Management & Branding Architecture](#27-social-media-management--branding-architecture)

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

Full `RedisService` and BullMQ wiring implementation: see §25 (Appendix B) — **now updated to the hardened, incident-fixed version; see §25.0 for what changed and why.**

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

> **v3.1 update:** `src/common/constants/queues.ts` was rewritten (see §25.2 for the full file). It adds several queues that previously existed in code but were undocumented, flags two queues (`NOTIFICATIONS_DISPATCH`, `CONTENT_PROCESSING`) as **VERIFY** — meaning they were found registered with no confirmed consumer/processor — and introduces a `JOBS` object so job names are grouped by domain instead of scattered as inline string literals. The table below is updated to match the new file; treat `queues.ts` itself as the source of truth going forward, this table as a human-readable summary of it.

| Queue                      | Processor                                             | Priority     | Retries           | Notes                                                                                                                                               |
| -------------------------- | ----------------------------------------------------- | ------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email-notifications`      | `automation/queue/email-campaign.processor.ts`        | 5 (Normal)   | 3× exp            | Via Resend. Job names: `send-batch`, `expiry-reminder`, `broadcast-email`                                                                           |
| `sms-otp`                  | `notification/notification.service.ts`                | 2 (High)     | 2× exp            | WhatsApp→SMS fallback                                                                                                                               |
| `push-notifications`       | `notification/processors/push-broadcast.processor.ts` | 5 (Normal)   | 2× fixed          | Job name: `broadcast-push`. **New** — previously undocumented, confirmed live                                                                       |
| `marketing-automation`     | _(processor TBD)_                                     | 5 (Normal)   | 3× exp            | **New** — previously undocumented, confirmed registered                                                                                             |
| `notifications` (dispatch) | _(no confirmed consumer)_                             | 5 (Normal)   | 2× exp            | ⚠️ **VERIFY** — flagged in `queues.ts` as possibly redundant with the three queues above; confirm in `notification.service.ts` before relying on it |
| `social-publishing`        | `automation/queue/social-post.processor.ts`           | 5            | 2× exp            | Delayed jobs. Job name: `post`                                                                                                                      |
| `ai-generation`            | `automation/queue/ai-jobs.processor.ts`               | 5            | 2× exp            | Provider fallback. Job name: `email-scrape` (Business Discovery)                                                                                    |
| `image-generation`         | `ai/processors/social-factory.processor.ts`           | 5            | 1×                | fal.ai → DALL-E                                                                                                                                     |
| `social-factory`           | _(processor TBD)_                                     | 5            | 2× exp            | ⚠️ VERIFY against `social-factory.processor.ts` intent — may overlap with `image-generation`                                                        |
| `video-render`             | _(processor TBD)_                                     | 5            | 1×                | ⚠️ VERIFY                                                                                                                                           |
| `content-seo`              | _(processor TBD)_                                     | 7 (Low-ish)  | 1×                | ⚠️ VERIFY                                                                                                                                           |
| `content` (processing)     | _(no confirmed consumer)_                             | 6            | 2× exp            | ⚠️ **VERIFY** — flagged as possibly used by `rss.service.ts`/`amebogist.service.ts`; no `@Processor` class currently visible                        |
| `payroll-processing`       | `planai/processors/planai.processor.ts`               | 3 (High)     | 0 (`attempts: 1`) | Idempotent                                                                                                                                          |
| `media-processing`         | `media/media.service.ts`                              | 5            | 2× exp            | R2 upload + scan                                                                                                                                    |
| `ai-agent-tasks`           | _(processor TBD — BizAgentTaskProcessor)_             | 4 (High-ish) | 3× exp            | **New.** Job name: `agent-task` — taskType lives in `job.data`, not `job.name`                                                                      |
| `payment-webhook`          | `payment/payment.service.ts`                          | 1 (Critical) | 5× fixed 10s      | Paystack retries 72hr                                                                                                                               |
| `wallet-credit`            | `wallet/wallet.service.ts`                            | 2 (High)     | 3× exp            | Must succeed                                                                                                                                        |
| `trend-analysis`           | `ai/services/trend.service.ts`                        | 8 (Low)      | 0 (`attempts: 1`) | Cron every 2h                                                                                                                                       |
| `kolo-reminders`           | `villagecircle/kolo-ai/kolo-ai.service.ts`            | 5            | 0 (`attempts: 1`) | WhatsApp reminders                                                                                                                                  |
| `polymind-query`           | `polymind/polymind.service.ts`                        | 5            | 0 (`attempts: 1`) | Fan-out AI calls                                                                                                                                    |
| `webhook-delivery`         | `api/webhook-delivery.service.ts`                     | 5            | 3× exp            | Enterprise webhooks                                                                                                                                 |
| `ndpa-erasure`             | `user/user.service.ts`                                | 9 (Low)      | 0 (`attempts: 1`) | Cron: daily                                                                                                                                         |
| `seo-sitemap`              | `amebogist/rss.service.ts`                            | 9 (Low)      | 0 (`attempts: 1`) | Cron: nightly                                                                                                                                       |

**Before relying on the two VERIFY rows:** open `notification.service.ts` (for `notifications`/dispatch) and `amebogist.service.ts` + `rss.service.ts` (for `content`/processing) and confirm whether these queues have live consumers or are dead registrations left over from an earlier refactor. Don't delete them from `queues.ts` without that confirmation — a queue with jobs already sitting in Redis that gets un-registered will silently orphan those jobs.

Full updated `queues.ts` and `redis.service.ts` — see §25 (Appendix B), which now supersedes the previous version of that appendix.

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

### 17.7 Queue registrations without confirmed consumers (new, v3.1)

`notifications` (dispatch) and `content` (processing) are both registered in `queues.ts` but have no `@Processor` class currently visible consuming them. See §16's VERIFY rows — resolve before assuming either queue is safe to remove or safe to rely on.

### 17.8 Prior Redis incident — root cause now documented and fixed in code (informational)

On 2026-07-15, Redis clients were intermittently connecting to `127.0.0.1:6379` instead of the configured `REDIS_*_URL` hosts. Root cause: the three `Redis` clients were being constructed inside an async `onModuleInit()` using `lazyConnect: true` + `await client.connect()`, but Nest resolves `useFactory` dependency injection (e.g. `BullModule.forRootAsync`'s `inject: [RedisService]` → `connection: redis.queue`) while building the provider graph — **before** any `onModuleInit()` hook runs anywhere in the app. `redis.queue` was therefore still `undefined` at the moment BullMQ read it, so ioredis silently fell back to its hardcoded default. **Fixed** in the current `redis.service.ts` (§25.1) by constructing all three clients synchronously in the constructor. No action needed unless this file is reverted to an older version — if anyone reintroduces `onModuleInit`-based client construction, this incident will recur.

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

### Wave 7 — Social Media Automation Rollout (new, v3.1)

Wire the Social Media Manager brand-kit engine (§27, Part 3) into `planai/social/*`: `BrandKit` Prisma model + migration, `SocialPost`/`PostStatus`/`Platform` enums, `SYSTEM_TONE_REFERENCE_MAP` prompt-composition helper wired into `ai.service.ts`, auto-branding canvas post-processor for fal.ai image outputs, `SocialAccountMetrics` analytics wiring with UTM-based `clicksToEcosystem`/`conversions` tracking. Depends on Wave 0 (Redis split, for queue-backed scheduling) and Wave 2 (Social Media Manager base CRUD).

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
[ ] C4. Clients are constructed synchronously in RedisService's constructor, never inside onModuleInit (§17.8).
[ ] C5. Prefer scanKeys() over the deprecated keys() — KEYS blocks the Redis event loop under load.
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

### J — Brand & Social Media (new, v3.1 — see §27)

```text
[ ] J1. Any auto-generated social/brand asset uses the product's linear-gradient background (135deg / diagonal), centered icon at 40% container size, product name bottom-left, tagline bottom-right — per §27 Part 1 spec, not ad-hoc layouts.
[ ] J2. Workspace-level BrandKit colors/fonts/logo are read from the workspace's saved BrandKit record, never hardcoded per post.
[ ] J3. AI copywriting for social content goes through composeSystemPrompt() / SYSTEM_TONE_REFERENCE_MAP (§27 Part 3) so tone stays consistent with the reference channel for that content type (pidgin_viral / professional_b2b / philosophical_cultural).
[ ] J4. Vertical video exports (TikTok/Shorts/Stories) use 1080×1920px, keep captions/branding inside the safe-zone bounds specified in §27 Part 6.
[ ] J5. UTM-tracked ecosystem links (clicksToEcosystem/conversions in SocialAccountMetrics) are used for any cross-product referral tracking — don't hand-roll a second attribution mechanism.
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

Workspace ──┬─ BrandKit           (new, §27 Part 4 — Social Media Manager)
            └─ SocialPost[]
```

---

## 25. Appendix B: Redis & Queue Reference Implementation

> **v3.1 replacement notice:** the code in this appendix replaces the previous version wholesale. The previous `redis.service.ts` and `queues.ts` were simplified illustrative versions; the files below are the actual hardened implementations, including a documented fix for a real production incident (§17.8) and an expanded, VERIFY-flagged queue registry (§16, §17.7). Do not mix-and-match old and new — copy these files in full.

### 25.0 What changed vs the previous version of this appendix

- **`redis.service.ts`** — completely rewritten. Adds: synchronous client construction in the constructor (fixes the `127.0.0.1:6379` incident, §17.8), Happy-Eyeballs (`family: 0`) + `keepAlive` + `connectTimeout` network resilience, jittered exponential backoff capped at 10s, `reconnectOnError` that distinguishes retryable errors from auth failures, a `whenReady` promise, a full library of typed helper methods for session/cache operations (SSO tokens, refresh-token revocation, OTP storage, rate limiting, feature flags, ALOC/exchange-rate/trend/admin-stats caching), a SCAN-based `scanKeys()` replacing the blocking `keys()`, and a `health()` method backing `GET /health`.
- **`queues.ts`** — expanded from 15 to 21 queue constants, adds a `JOBS` object grouping job names by domain (not by queue) to prevent name collisions, adds `QUEUE_DEFAULT_JOB_OPTIONS` as the single source of truth for retry/backoff policy (previously scattered inline at each `queue.add()` call site), and flags two queues as **VERIFY** pending confirmation against `notification.service.ts` and `amebogist.service.ts`/`rss.service.ts` (see §16, §17.7).

Both files below are the complete, current contents of their respective paths — copy in full, don't hand-merge with older versions.

### 25.1 `src/database/redis.service.ts` — Complete File

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
 * INCIDENT FIX (2026-07-15) — clients connecting to 127.0.0.1:6379 instead of
 * the configured REDIS_*_URL hosts:
 *
 *   Root cause: clients were built inside an async `onModuleInit()` using
 *   `lazyConnect: true` + `await client.connect()`. Nest resolves
 *   `useFactory` dependency injection (e.g. BullModule.forRootAsync's
 *   `inject: [RedisService]` → `connection: redis.queue`) while constructing
 *   the provider graph — BEFORE any `onModuleInit()` lifecycle hook runs
 *   anywhere in the app. That meant `redis.queue` was still `undefined` at
 *   the moment BullMQ read it, so ioredis silently fell back to its
 *   hardcoded default of 127.0.0.1:6379.
 *
 *   Fix: build all three clients synchronously in the CONSTRUCTOR, not in
 *   onModuleInit. Nest always finishes running a provider's constructor
 *   before that provider can be injected anywhere else, so `session`,
 *   `queue`, and `cache` are guaranteed to be real Redis instances the
 *   moment any other factory or service asks for them. Connection itself is
 *   still async/non-blocking in the background (ioredis default
 *   `lazyConnect: false` connects immediately without blocking the
 *   constructor) — BullMQ, session ops, and cache ops all internally queue
 *   commands until the socket is ready, so this does not stall bootstrap.
 *
 *   Retained resilience characteristics from the prior incident fix:
 *     1. Exponential backoff w/ jitter, capped at 10s, never gives up.
 *     2. `family: 0` — Happy Eyeballs (IPv4 + IPv6) for Railway/Upstash
 *        endpoints that intermittently resolve unroutable AAAA records.
 *     3. `keepAlive: 30_000` — prevents managed-Redis load balancers from
 *        silently dropping idle sockets (which otherwise surfaces as a
 *        confusing ECONNRESET on the next command).
 *     4. `connectTimeout: 10_000` — bounds half-open TCP connects.
 *     5. `reconnectOnError` distinguishes READONLY/CLUSTERDOWN (retry) from
 *        NOAUTH/WRONGPASS (surface immediately, do not hot-loop).
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

    // lazyConnect intentionally omitted → defaults to false, so ioredis
    // starts connecting the instant this client is constructed. Commands
    // issued before the socket is ready are queued internally by ioredis,
    // so nothing needs to `await connect()` here.
    const client = new Redis(url, {
      ...options,
      ...(tlsRequired ? { tls: { rejectUnauthorized: false } } : {}),

      // ── Network resilience (fixes the ECONNRESET reconnect storm) ────────
      family: 0, // Happy Eyeballs — try IPv4 + IPv6, use whichever connects
      connectTimeout: 10_000, // bound hung half-open connects
      keepAlive: 30_000, // ping the TCP socket so LBs don't silently drop it
      noDelay: true,

      // Exponential backoff with jitter, capped at 10s. Never gives up —
      // BullMQ / session / cache all need eventual reconnection — but never
      // hot-loops in a way that trips upstream connection-rate limits.
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

      // Only auto-retry the failed command on errors that are genuinely
      // transient. Auth/permission errors should surface immediately
      // instead of hot-looping reconnect attempts against bad credentials.
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
      // ioredis emits an 'error' event per failed attempt — avoid duplicate
      // full-stack spam beyond what's useful; message is enough here.
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
      // Don't hang bootstrap forever if a single instance never comes up —
      // log and resolve anyway after 15s; the retryStrategy above keeps
      // trying in the background regardless.
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
  // All helpers below use this.session unless the method name says "cache".
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Basic key ops (session) ────────────────────────────────────────────────

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

  // ─── Hash helpers (session) ─────────────────────────────────────────────────

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
   * shared Redis instance under production load. Prefer this over `keys()`
   * for anything not run interactively at small scale.
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
  // Key pattern: sso:relay:{64-hex}   TTL: 60s (default)

  async storeSSOToken(
    token: string,
    userId: string,
    ttlSeconds = 60,
  ): Promise<void> {
    await this.session.setex(`sso:relay:${token}`, ttlSeconds, userId);
  }

  async consumeSSOToken(token: string): Promise<string | null> {
    const key = `sso:relay:${token}`;
    // Lua script: atomic get-then-delete (prevents double-use)
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
  // Key pattern: revoked:{tokenId}   TTL: 30 days

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
  // Key pattern: otp:{purpose}:{email|phone}   TTL: 15 min

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
  // Key pattern: ratelimit:{endpoint}:{userId|ip}

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
  // Key pattern: flags:{userId} | flags:global   TTL: 5 min

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
  // Explicitly namespaced as cacheGet / cacheSet to distinguish from session ops.
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
   * withCache<T>()
   * Read-through helper for the CACHE instance.
   * If key is warm, returns parsed JSON.
   * On miss, calls fetchFn, stores result, returns it.
   *
   * Usage:
   *   const questions = await redis.withCache(
   *     `aloc:maths:JAMB:2025`,
   *     () => alocService.fetchQuestions('maths', 'JAMB', 2025),
   *     86400,  // 24h
   *   );
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

  /**
   * @deprecated Use withCache() instead.
   * Kept for backwards compatibility with any existing callers of cache().
   */
  async cachet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    return this.withCache(key, fetchFn, ttlSeconds);
  }

  // ─── Named cache-key helpers (ALOC, rates, trends) ─────────────────────────

  /**
   * ALOC question cache.
   * Key: aloc:{subject}:{examType}:{year}   TTL: 24h
   */
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

  /**
   * Exchange rate cache.
   * Key: remit:rates:{currency}   TTL: 1h
   */
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

  /**
   * Nigerian trend data cache.
   * Key: trends:ng:{YYYY-MM-DD}   TTL: 2h
   */
  async getTrends(date: string): Promise<unknown | null> {
    const raw = await this.cache.get(`trends:ng:${date}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setTrends(date: string, data: unknown): Promise<void> {
    await this.cache.setex(`trends:ng:${date}`, 7200, JSON.stringify(data));
  }

  /**
   * PlanAI tool access map per user.
   * Key: planai:access:{userId}   TTL: 5 min
   */
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

  /**
   * Admin dashboard stats.
   * Key: admin:stats:{YYYY-MM-DD}   TTL: 15 min
   */
  async getAdminStats(date: string): Promise<unknown | null> {
    const raw = await this.cache.get(`admin:stats:${date}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setAdminStats(date: string, data: unknown): Promise<void> {
    await this.cache.setex(`admin:stats:${date}`, 900, JSON.stringify(data));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // Used by GET /health (admin.module.ts health.controller.ts)
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

### 25.2 `src/common/constants/queues.ts` — Complete File

```typescript
// src/common/constants/queues.ts
//
// SINGLE SOURCE OF TRUTH for every BullMQ queue + job name in boldmind-service.
// Nothing outside this file should contain a literal queue-name or job-name string.
//
//   Registration (once, app-wide):  src/common/queues/queues.module.ts
//   Producers:   @InjectQueue(QUEUES.X)  →  queue.add(JOBS.GROUP.Y, payload)
//   Consumers:   @Processor(QUEUES.X)    →  switch (job.name) { case JOBS.GROUP.Y: ... }
//
// Retry/backoff policy is defined ONCE here (QUEUE_DEFAULT_JOB_OPTIONS) and applied
// at registration time. Producers should NOT pass { attempts, backoff } inline —
// that duplication is exactly what caused queue-name drift in the first place.

import type { JobsOptions } from "bullmq";

export const QUEUES = {
  // ── Communication ──────────────────────────────────────────────
  EMAIL_NOTIFICATIONS: "email-notifications",
  MARKETING_AUTOMATION: "marketing-automation",
  PUSH_NOTIFICATIONS: "push-notifications",
  SMS_OTP: "sms-otp",
  NOTIFICATIONS_DISPATCH: "notifications", // VERIFY: notification.module.ts — flagged in project notes as
  // previously unregistered/no-consumer. May be fully redundant
  // with EMAIL_NOTIFICATIONS/PUSH_NOTIFICATIONS/SMS_OTP above —
  // need notification.service.ts to confirm before deciding
  // keep-vs-delete.

  // ── Content & Social ───────────────────────────────────────────
  SOCIAL_PUBLISHING: "social-publishing",
  AI_GENERATION: "ai-generation",
  IMAGE_GENERATION: "image-generation",
  SOCIAL_FACTORY: "social-factory",
  VIDEO_RENDER: "video-render",
  CONTENT_SEO: "content-seo",
  CONTENT_PROCESSING: "content", // VERIFY: amebogist.module.ts — used by rss.service.ts/amebogist.service.ts?
  // No @Processor class currently visible consuming this. Need those two
  // files to confirm job names/purpose before finalizing JOBS group + defaults.

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

// ── Job names, grouped by DOMAIN rather than by queue, so a copy-paste across
//    queues can never silently collide on the same constant. ──────────────────
export const JOBS = {
  EMAIL: {
    SEND_BATCH: "send-batch", // EmailCampaignProcessor
    EXPIRY_REMINDER: "expiry-reminder", // EmailCampaignProcessor
    BROADCAST: "broadcast-email", // NotificationService → EmailCampaignProcessor
  },
  PUSH: {
    BROADCAST: "broadcast-push", // NotificationService → PushBroadcastProcessor
  },
  SOCIAL: {
    POST: "post", // SocialPostProcessor
  },
  AI: {
    EMAIL_SCRAPE: "email-scrape", // AIJobsProcessor (Business Discovery Directory)
  },
  AGENT: {
    TASK: "agent-task", // BizAgentTaskProcessor — taskType lives in job.data, not job.name
  },
} as const;

export const QUEUE_PRIORITIES: Record<QueueName, number> = {
  [QUEUES.PAYMENT_WEBHOOK]: 1, // Critical — never delay Paystack
  [QUEUES.WALLET_CREDIT]: 2, // High — financial integrity
  [QUEUES.SMS_OTP]: 2, // High — user is waiting
  [QUEUES.PAYROLL_PROCESSING]: 3, // High — time-sensitive
  [QUEUES.AI_AGENT_TASKS]: 4, // High-ish — agent tasks are time-sensitive (invoice followups, bookings)
  [QUEUES.MARKETING_AUTOMATION]: 5, // Normal
  // QUEUE_PRIORITIES — add:
  [QUEUES.NOTIFICATIONS_DISPATCH]: 5, // VERIFY
  [QUEUES.CONTENT_PROCESSING]: 6, // VERIFY

  [QUEUES.EMAIL_NOTIFICATIONS]: 5, // Normal
  [QUEUES.PUSH_NOTIFICATIONS]: 5, // Normal
  [QUEUES.SOCIAL_PUBLISHING]: 5, // Normal (may be delayed jobs)
  [QUEUES.AI_GENERATION]: 5, // Normal
  [QUEUES.IMAGE_GENERATION]: 5, // Normal
  [QUEUES.SOCIAL_FACTORY]: 5, // Normal — VERIFY against social-factory.processor.ts intent
  [QUEUES.VIDEO_RENDER]: 5, // Normal — VERIFY
  [QUEUES.CONTENT_SEO]: 7, // Low-ish — VERIFY
  [QUEUES.MEDIA_PROCESSING]: 5, // Normal
  [QUEUES.KOLO_REMINDERS]: 5, // Normal
  [QUEUES.POLYMIND_QUERY]: 5, // Normal
  [QUEUES.WEBHOOK_DELIVERY]: 5, // Normal
  [QUEUES.TREND_ANALYSIS]: 8, // Low
  [QUEUES.SEO_SITEMAP]: 9, // Low
  [QUEUES.NDPA_ERASURE]: 9, // Low
};

// ── Default BullMQ retry/backoff policy per queue. Applied once at registration
//    time in QueuesModule. `attempts: 1` == "no retries" (the first try counts).
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
  // QUEUE_DEFAULT_JOB_OPTIONS — add:
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

---

## 26. Appendix C: Individual App Onboarding

Per-repo startup instructions — see each repo's own README and project-tree doc. Always attach the relevant project tree before generating code for any repo; never infer file paths from this document alone.

---

## 27. Social Media Management & Branding Architecture

> **Added in v3.1.** Source: `Strategic Social Media Management and Branding Architecture for BoldmindNG`. This section is the operational playbook for running BoldmindNG's social presence — account setup, brand asset specs, content pillars per channel, the frontend styling engine those assets are rendered with, the Social Media Manager app's brand-kit + AI tone system, the automation pipeline and Prisma schema behind scheduled posts, and a standalone caption/hashtag/ad-copy playbook. It complements — doesn't replace — the product-level PlanAI Social Media Manager reference in §6 (live routes) and §16 (queue map: `social-publishing`, `social-factory`, `marketing-automation`). New build work implied by this section is tracked as **Wave 7** (§21) and **Checklist J** (§22).
>
> **Editorial note:** a handful of code snippets in the source document have incomplete array literals (e.g. `mediaUrls String` missing `[]`, several `interests:` / hashtag-set values left empty). These are reproduced as received below; treat them as illustrative structure, not copy-paste-ready code — fill in the missing array contents/types before shipping.

### 27.1 Overview — The Four-Pillar Flywheel

BoldmindNG's social strategy routes people sequentially through four pillars: **Awareness** (AmeboGist — high-volume Pidgin-language media), **Conviction** (VillageCircle — story-driven cultural/philosophical drops that validate product concepts before they're built), **Education** (Boldmind EduCenter — exam prep and vocational skill programs), and **Enablement** (BoldmindNG hub / PlanAI — SSO-gated SaaS tools). Every channel is expected to funnel its audience toward the next pillar rather than operate in isolation.

```text
+--------------------------------------------------+
|                    AMEBOGIST                     |
|               (Awareness Layer)                  |
|     High-volume news and viral trends in Pidgin  |
+------------------------+-------------------------+
                         |  Users engage with news
                         v
+--------------------------------------------------+
|                  VILLAGECIRCLE                   |
|               (Conviction Layer)                 |
|   Culturally resonant drops and product concepts |
+------------------------+-------------------------+
                         |  Conceptual buy-in achieved
                         v
+--------------------------------------------------+
|                    EDUCENTER                     |
|               (Education Layer)                  |
|     Exam preparation and vocational training     |
+------------------------+-------------------------+
                         |  Ready to build/operate
                         v
+--------------------------------------------------+
|                  BOLDMIND / PLANAI               |
|               (Enablement Layer)                 |
|     SSO platform, business SaaS, unified billing |
+--------------------------------------------------+
```

### 27.2 Part 1 — Account Setup & Branding Guide

**Account inventory (handles pending platform verification):**

| Product            | Platforms                                                | Handles                                                                                                                  |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| BoldmindNG         | TikTok, Twitter/X, LinkedIn, YouTube, Facebook, WhatsApp | `@boldmindng` (TikTok/X/YouTube), `/company/boldmindng` (LinkedIn), `boldmindng1` (Facebook), `2349138349271` (WhatsApp) |
| PlanAI             | TikTok, Twitter/X, Facebook, LinkedIn, WhatsApp          | `@planaibyboldmind` (TikTok/Facebook), `@planaibyboldmin` (X), `/company/planaibyboldmind` (LinkedIn)                    |
| AmeboGist          | TikTok, Twitter/X, Facebook, YouTube, WhatsApp           | `@amebogistng` (TikTok/X/YouTube), `amebogistng1` (Facebook)                                                             |
| Boldmind EduCenter | TikTok, Facebook, YouTube, WhatsApp                      | `@boldmindeducenter` (TikTok/YouTube/Facebook)                                                                           |
| VillageCircle      | YouTube, TikTok, Twitter/X, Facebook                     | `@villagecircleng1` (YouTube), `@villagecircleng` (TikTok/X), `villagecircleng1` (Facebook)                              |

All handles/statuses are marked `[confirm]` in the source inventory — verify current registration state before publishing under any of them.

**Bio templates per platform** are pre-written for all five public-facing brands (BoldmindNG master account, PlanAI, AmeboGist, Boldmind EduCenter, VillageCircle) at Twitter/X, Instagram, TikTok, LinkedIn-description, and YouTube-description lengths, each with product-specific links and character counts respected. See the source doc for full copy per platform — the pattern is consistent: a short punchy line + ecosystem tag + link for short formats, a fuller value-proposition paragraph for LinkedIn, and a channel description with a fixed weekly posting cadence for YouTube.

**Profile asset specs** — every product has a fixed dimension/format/color spec per asset type:

| Asset Type         | Dimensions  | Format |
| ------------------ | ----------- | ------ |
| Profile picture    | 1080×1080px | PNG    |
| Twitter header     | 1500×500px  | PNG    |
| Facebook cover     | 851×315px   | JPG    |
| LinkedIn banner    | 1128×191px  | PNG    |
| YouTube art        | 2560×1440px | JPG    |
| IG highlight cover | 1080×1920px | PNG    |

Brand primary/secondary hex pairs per product:

| Product            | Primary   | Secondary |
| ------------------ | --------- | --------- |
| BoldmindNG         | `#2B4D87` | `#E9A825` |
| PlanAI             | `#5B21B6` | `#059669` |
| AmeboGist          | `#065F46` | `#DC2626` |
| Boldmind EduCenter | `#1E40AF` | `#F59E0B` |
| VillageCircle      | `#3B1F0A` | `#E9A825` |

**Mandatory visual structure for every generated brand asset:**

1. **Background** — programmatic linear gradient, primary → secondary, 45° diagonal (prevents visual flatness).
2. **Logo/icon** — centered, 40% of container, white with clean alpha masking.
3. **Product name** — bottom-left, white, Plus Jakarta Sans Bold.
4. **Tagline/value prop** — bottom-right, smaller/lighter weight, 70% opacity.

This structure is enforced in code — see §27.4's reusable card components and Checklist J1 (§22).

**Content pillars per account** (full breakdown of strategic focus, content-mix percentages, and posting cadence per platform) exist for all five channels:

- **`@boldmindng`** (master): 40% ecosystem announcements, 20% founder journey, 20% Nigerian entrepreneur education, 20% cross-product spotlight. TikTok 2×/day, Twitter/X 1×/day thread, LinkedIn 3×/week.
- **`@amebogistng`**: 60% news posts, 20% Pidgin explainers, 20% community engagement. Twitter/X 4–6×/day, TikTok 2×/day.
- **`@planaibyboldmind`**: 30% product demos, 30% SME tips, 20% before/after case studies, 20% testimonials. TikTok 2×/day, Instagram 1×/day carousel, LinkedIn 3×/week case studies.
- **`@boldmindeducenter`**: 40% study tips, 30% exam countdowns, 20% student success stories, 10% product features. Twitter/X 3×/day drills, TikTok 1×/day.
- **`@villagecircleng`**: 80% daily philosophical drops, 20% behind-the-philosophy (product concept explainers). Cross-platform 1×/day at 08:30 Africa/Lagos.

### 27.3 Part 2 — Technical Frontend Integration & Styling Rules

Brand theming for social-facing web components (dashboards, automated preview cards) is generated programmatically from the product color config, not hand-coded per product.

```typescript
// Programmatic generation of CSS Variables using the product color configurations
export function generateCSSVariables(scheme: ProductColorScheme): string {
  return `
    --product-primary: ${scheme.primary};
    --product-secondary: ${scheme.secondary};
    --product-accent: ${scheme.accent};
    --product-background: ${scheme.background};
    --product-foreground: ${scheme.foreground};
    --product-muted: ${scheme.muted};
    --product-highlight: ${hexToRgba(scheme.secondary, 0.12)};
    --product-glow: ${hexToRgba(scheme.secondary, 0.25)};
  `.trim();
}

// Helper utility to calculate high-contrast text color on brand backgrounds
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1A202C" : "#FAFAF9";
}
```

**Font/accessibility engine** — defaults to `OpenDyslexic` across operational products (Hub, PlanAI, EduCenter, fitness, project-manager) for neurodiverse readability on business data and exam questions; VillageCircle deliberately overrides to `Playfair Display`/`Lora` serif for its story-driven register.

```typescript
export const BOLDMIND_FONT_CONFIG = {
  default: 'OpenDyslexic, "Comic Sans MS", sans-serif',
  heading: 'OpenDyslexic, "Plus Jakarta Sans", "Inter", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", monospace',
  overrides: {
    amebogist: 'OpenDyslexic, "Plus Jakarta Sans", sans-serif',
    educenter: 'OpenDyslexic, "Inter", sans-serif',
    "project-manager": "OpenDyslexic, sans-serif",
    "boldmind-fitness": 'OpenDyslexic, "Inter", sans-serif',
    "boldmind-hub": 'OpenDyslexic, "Plus Jakarta Sans", sans-serif',
    villagecircle: '"Playfair Display", "Lora", Georgia, serif',
  } as Record<string, string>,
  cssVariable: "--font-body",
  dyslexiaSpacing: {
    letterSpacing: "0.12em",
    wordSpacing: "0.25em",
    lineHeight: "1.8",
  },
} as const;

export function generateFontCSS(slug: string): string {
  const font =
    BOLDMIND_FONT_CONFIG.overrides[slug] ?? BOLDMIND_FONT_CONFIG.default;
  return `
    :root {
      ${BOLDMIND_FONT_CONFIG.cssVariable}: ${font};
    }
    body, * {
      font-family: var(${BOLDMIND_FONT_CONFIG.cssVariable});
    }
  `.trim();
}
```

**Reusable social post card components** — standard HTML/CSS markup for automated preview cards exists for both the operational (Boldmind Hub) and media (AmeboGist) registers; both follow the §27.2 mandatory visual structure (gradient background, centered icon, bottom-left product name, bottom-right ecosystem tag). Full markup is preserved in the source doc — reuse these templates rather than building new card layouts from scratch when adding a new automated card type; extend them rather than forking.

### 27.4 Part 3 — Social Media Manager App Integration (PlanAI `prod_101`)

The user-facing Social Media Manager exposes a per-workspace branding + AI-tone system so independent subscribers get on-brand, on-tone generated content without manual styling per post.

**`BrandKit` per workspace:**

```typescript
interface BrandKit {
  workspaceId: string;
  // Colors
  primaryColor: string; // hex
  secondaryColor: string;
  accentColor: string;
  // Typography
  headingFont: string; // Google Fonts name
  bodyFont: string;
  // Logos
  logoUrl: string; // Cloudflare R2 URL
  logoWhiteUrl: string;
  faviconUrl: string;
  // Social profile photos
  profilePhotoUrl: string;
  // Voice
  brandVoice:
    | "professional"
    | "casual"
    | "pidgin"
    | "youthful"
    | "authoritative";
  industry: string;
  targetAudience: string;
  // Auto-applied to all AI-generated content for this workspace
}
```

**Tone reference system** — rather than a generic style guide, the AI copywriting engine is prompted with BoldmindNG's own live channels as reference voices, selected by content type:

```typescript
// System Reference configuration map for dynamic LLM prompt orchestration
export const SYSTEM_TONE_REFERENCE_MAP = {
  pidgin_viral: {
    handle: "@amebogistng",
    referenceContext: "AmeboGist NG Pidgin Media Voice",
    coreDirectives: [], // fill in: short, punchy, street-Pidgin hooks
    prohibitions: [], // fill in: e.g. no overly formal register
  },
  professional_b2b: {
    handle: "@planaibyboldmind",
    referenceContext: "PlanAI SaaS Enterprise B2B Voice",
    coreDirectives: [], // fill in: ROI-first, feature-benefit framing
    prohibitions: [], // fill in
  },
  philosophical_cultural: {
    handle: "@villagecircle",
    referenceContext: "VillageCircle Philosophy and Story Voice",
    coreDirectives: [], // fill in: dignified, story-first, 5 Rivers framing
    prohibitions: [
      "Avoid hype words, business buzzwords, and immediate promotional calls-to-action.",
      "Never use casual abbreviations.",
    ],
  },
} as const;

// Backend helper function to inject reference parameters into the LLM system prompt
export function composeSystemPrompt(
  workspaceVoice: string,
  contentType: "viral" | "b2b" | "philosophical",
): string {
  let referencePreset = SYSTEM_TONE_REFERENCE_MAP.professional_b2b;

  if (contentType === "viral" || workspaceVoice === "pidgin") {
    referencePreset = SYSTEM_TONE_REFERENCE_MAP.pidgin_viral;
  } else if (contentType === "philosophical") {
    referencePreset = SYSTEM_TONE_REFERENCE_MAP.philosophical_cultural;
  }

  return `
    You are an elite copywriter operating within the BoldmindNG PlanAI suite.
    Your goal is to generate social media content tailored to the Nigerian market.

    Tone Guide: Apply the following directives which emulate the exact communication strategy of our master reference channel, ${referencePreset.handle}:
    ${referencePreset.coreDirectives.map((directive) => `- ${directive}`).join("\n")}

    Prohibitions:
    ${referencePreset.prohibitions.map((p) => `- ${p}`).join("\n")}
  `.trim();
}
```

> **Note:** `coreDirectives` arrays are empty placeholders in the source document — populate them with the actual per-channel voice rules (drawn from §27.2's content-pillar descriptions) before wiring `composeSystemPrompt()` into `ai.service.ts` (tracked in Wave 7, §21).

**Auto-branding on generated images** (fal.ai/FLUX outputs), applied via an HTML5 canvas post-processor:

- Programmatic brand border/tint — 2px frame or gradient boundary tinted with the workspace's `primaryColor`.
- Workspace logo watermark — bottom-right, opacity adjustable 15%–100%.
- Dynamic typography overlays — headline/quote text styled with the workspace's `headingFont`/`bodyFont`.

**Analytics — cross-platform + ecosystem-referral tracking:**

```typescript
interface SocialAccountMetrics {
  platform: string;
  handle: string;
  // Growth
  followersToday: number;
  followersGrowth7d: number;
  followersGrowth30d: number;
  // Engagement
  avgEngagementRate: number;
  topPost: { url: string; engagement: number; postedAt: Date };
  bestPostingTime: { dayOfWeek: string; hour: number };
  // BoldmindNG flywheel
  clicksToEcosystem: number; // UTM-tracked clicks to any boldmind domain
  conversions: number; // UTM clicks that resulted in signup
}
```

`clicksToEcosystem`/`conversions` is the standard attribution mechanism for measuring how a subscriber's own social output feeds the wider ecosystem flywheel — see Checklist J5 (§22): don't build a second, parallel tracking mechanism for this.

### 27.5 Part 4 — Content Automation Architecture & Prisma Schema

**Pipeline:**

```text
+-------------------+     Creates     +--------------------+     Queues     +------------------+
|    PlanAI OS /    | --------------> |   Workspace-Level  | --------------> |  BullMQ / Redis  |
|   Workspace UI    |                 |  Social Generator  |                 |  Message Broker  |
+-------------------+                 +--------------------+                 +------------------+
                                                                                      |
                                                                                      | Triggers
                                                                                      v
+-------------------+     Delivers    +--------------------+     Processes   +------------------+
|   Social Media    | <-------------- |    n8n Workflow    | <-------------- |  Background Job  |
|   Platform APIs   |                 |     Integrator     |                 |  Worker Thread   |
+-------------------+                 +--------------------+                 +------------------+
```

This pipeline is the intended consumer of the `social-publishing`, `social-factory`, and `marketing-automation` queues documented in §16 — wire new work through those queues rather than adding new ad-hoc ones (check §17.7's VERIFY items first in case one of the flagged queues is actually meant for this).

**Prisma schema (new models — add via migration, don't hand-edit the DB):**

```prisma
// Prisma Schema Definition for Ecosystem Social Media Management
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

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
  mediaUrls   String[]     // Array of programmatic visual asset paths
  scheduledAt DateTime
  publishedAt DateTime?
  status      PostStatus   @default(QUEUED)
  targets     Platform[]   // Targeted platforms
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

> Fixed from the source doc: `mediaUrls String` → `mediaUrls String[]` and `targets Platform` → `targets Platform[]` (both were plain scalars in the original, which doesn't match their stated purpose as arrays). Confirm against the actual migration before assuming this fix is already applied in the DB.

Add the corresponding relations to the ER diagram in §24 (already updated above): `Workspace ── BrandKit`, `Workspace ── SocialPost[]`.

### 27.6 Part 5 — Standalone Social Media Playbook

**Weekly content calendar template** (applies per subscriber workspace, not just BoldmindNG's own channels):

| Day       | Focus                     | Platforms                                |
| --------- | ------------------------- | ---------------------------------------- |
| Monday    | Motivation / inspiration  | All                                      |
| Tuesday   | Product feature highlight | TikTok, Instagram Reels                  |
| Wednesday | Educational content       | Twitter/X threads, LinkedIn articles     |
| Thursday  | Localized business tips   | All                                      |
| Friday    | Community & engagement    | Interactive stories, polls               |
| Saturday  | Behind the scenes         | TikTok, Stories                          |
| Sunday    | Week recap & preview      | Newsletter, cross-platform recap graphic |

**Caption formula library** — 20 named, reusable templates tuned for West African audiences (mixing English and Pidgin framing), including: The Story Hook, The Pidgin Opener, The Stats Flex, The Question Loop, The "No Shaking" Guarantee, The "Sapa" Solver, The Behind-the-Scenes Build, The "Hustle Go Pay" Motivation, The Hard Truth/Unpopular Opinion, The "Wetin Dey Occur" Trend Jack, The "Na Godwin" Milestone, The Step-by-Step Blueprint, The "E Choke" Feature Drop, The Before vs After Split, The Client Receipt/Testimonial Flex, The "No Be Today" Authority Build, The FOMO Warning, The Pidgin Explainer, The "Japa" Alternative, and The Interactive Choice Poll. Each has a fill-in-the-blank template with `[bracketed]` placeholders for product name, benefit, link, etc. — see the source document for the full copy of each; reuse these verbatim as starting points rather than freehand-writing new hook structures for every post.

**Hashtag strategy by platform** (max-count discipline per platform, since exceeding it tanks discoverability):

| Platform  | Max hashtags | Example                                                                                                                           |
| --------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| TikTok    | 5            | `#NaijaSME #PlanAI #NigerianEntrepreneur #BusinessOS #NaijaBusiness`                                                              |
| Instagram | 10           | `#MadeInNigeria #LagosLife #NaijaBusiness #TechNaija #ContentCreator #DigitalNaija #NaijaSME #PlanAI #NigerianTech #NaijaCreator` |
| Twitter/X | 3            | `#TechNaija #NigerianStartup #BoldmindNG`                                                                                         |
| LinkedIn  | 5            | `#NigerianTech #AfricanBusiness #SME #BusinessOS #PlanAI`                                                                         |

> The source `HASHTAG_SETS` object (`nigeria_business`, `tech`, `education`, `creator`, `planai`, `villagecircle`) was left with empty array values in the original — populate each set from the example hashtag lists above and the content-pillar language in §27.2 before wiring it into the caption generator.

### 27.7 Part 6 — Multimedia Strategy: Podcasts, YouTube Shorts & Stories

**VillageCircle Speculative Concept Explorer** — an interactive React map where speculative products (KoloAI, NaijaRent, SAFE AI, NaijaPrice Watch, etc.) are rendered as connected nodes:

```typescript
interface ConceptNode {
  id: string;
  title: string;
  icon: string;
  pillar: "awareness" | "conviction" | "education" | "enablement";
  fiveRiversTag:
    | "religion-culture"
    | "history"
    | "economic-liberation"
    | "tech-leap"
    | "governance";
  status: "CONCEPT" | "BUILDING" | "LIVE";
  narrativeUrl: string; // Links to deep-dive essay drop
  waitlistCount: number;
}
```

Clicking a node opens a side panel with an audio player reading the concept's deep-dive essay (Pidgin or dignified English) — the goal is ideological buy-in that drives waitlist signups ahead of the product actually being built (this is the concrete mechanism behind VillageCircle's "Conviction" role in the flywheel, §27.1).

**Two-podcast network:**

```text
+--------------------------------------------------+
|              "WETIN DEY OCCUR" PODCAST           |
|                (Top-of-Funnel News)              |
|   Target Audience: Broad consumer & creators     |
|   Style: Conversational, rapid-fire street Pidgin |
+------------------------+-------------------------+
                         | Leads to EduCenter / PlanAI
                         v
+--------------------------------------------------+
|              "CIRCLE TALK" PODCAST               |
|             (Conviction & Philosophy)            |
|   Target Audience: Builders, innovators, founders |
|   Style: Calming, deep, dignified, story-driven |
+--------------------------------------------------+
```

- **"Wetin Dey Occur"** (AmeboGist voice) — weekly 15-min news/creator-hack summary, street Pidgin, CTAs point to EduCenter.
- **"Circle Talk"** (VillageCircle voice) — deep 5 Rivers / economic-history / speculative-product discussions, dignified English, CTAs point to Explore-map waitlists.

**Vertical video specs (YouTube Shorts / TikTok / Stories):**

- Dimensions: 1080×1920px (9:16), 30–60 FPS, MP4/H.264+AAC, 4,000–6,000 kbps target bitrate.
- **YouTube Shorts safe zone:** keep critical graphics/subtitles/faces inside the central 900×1160px region; avoid the top 380px (search/title overlay) and bottom 380px (subscribe button/description).
- **TikTok safe zone:** keep critical text inside the central 70% horizontally/vertically; avoid the right 150px (like/comment buttons) and bottom 300px (caption area).

See Checklist J4 (§22).

### 27.8 Part 7 — Programmatic Ad Copy Generation & Distribution

The PlanAI Ads Center (`prod_102`) auto-generates platform-compliant ad copy per funnel stage, targeting Nigerian LGA-level demographics:

```typescript
interface AdCopyPayload {
  headline: string;
  primaryText: string;
  callToAction: string;
  targetPlatform: "meta" | "google" | "tiktok" | "linkedin";
  recommendedTargeting: {
    lgaDemographics: string[]; // Targeting specific Nigerian Local Government Areas
    interests: string[];
    ageRange: string;
  };
}

export class AdCopyGenerator {
  public static generateAdCopy(
    productSlug: string,
    funnelStage: "awareness" | "conviction" | "education" | "enablement",
  ): AdCopyPayload {
    switch (funnelStage) {
      case "awareness":
        return {
          headline: "Wetin Dey Occur For Tech Inside Naija? 📰",
          primaryText:
            "No let sapa catch your business this season! Stop paying for expensive foreign platforms. Get all the latest tech updates and business tools in clean, simple Pidgin English on AmeboGist NG.",
          callToAction: "Read Gist Now",
          targetPlatform: "meta",
          recommendedTargeting: {
            lgaDemographics: [
              "Ikeja",
              "Lagos Island",
              "Abuja Municipal",
              "Port Harcourt",
            ],
            interests: [], // fill in: tech news, entrepreneurship, Nigerian pop culture
            ageRange: "18 - 34",
          },
        };
      case "conviction":
        return {
          headline: "Build for Nigeria. Retain Your Heritage. 🌳",
          primaryText:
            'The "5 Rivers" doctrine outlines a blueprint for economic self-reliance. Stop chasing short-term business hacks. Explore tomorrow\'s software products while they are still stories on VillageCircle NG.',
          callToAction: "Join the Circle",
          targetPlatform: "linkedin",
          recommendedTargeting: {
            lgaDemographics: [], // fill in
            interests: [], // fill in
            ageRange: "24 - 45",
          },
        };
      case "education":
        return {
          headline: "JAMB & WAEC Prep Made Simple! 🎓",
          primaryText:
            "Ace your school exams and learn highly valuable digital skills! Get instant access to over 10,000 verified past questions, automated CBT exam simulations, and personalized AI tutoring on Boldmind EduCenter.",
          callToAction: "Start Free Practice",
          targetPlatform: "meta",
          recommendedTargeting: {
            lgaDemographics: [], // fill in
            interests: [], // fill in
            ageRange: "15 - 24",
          },
        };
      case "enablement":
        return {
          headline: "Run Your Nigerian Business on Autopilot ⚡",
          primaryText:
            "Tired of managing multiple software subscriptions? PlanAI unlocks 13 complete, AI-powered business tools—handling social media scheduling, VAT-compliant invoicing, accounting projections, and legal contracts in a single dashboard.",
          callToAction: "Unleash Your Business OS",
          targetPlatform: "linkedin",
          recommendedTargeting: {
            lgaDemographics: [], // fill in
            interests: [], // fill in
            ageRange: "22 - 50",
          },
        };
    }
  }
}
```

> Fixed from the source doc: added the `[]` array types to `lgaDemographics`/`interests` in the interface (present as bare `string`/missing in the original) and closed several object literals that were missing commas/braces in the raw source. `interests`/`lgaDemographics` values beyond the `awareness` case are placeholders — populate from the content-pillar targeting notes in §27.2 and the deployment guidelines below before shipping.

**Ad deployment guidelines by pillar:**

| Pillar                         | Where to run                                                  | When                                                           | Copy focus                                               |
| ------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| AmeboGist (Awareness)          | TikTok Ads, Meta in-feed video                                | Daily, 17:00–21:00 Africa/Lagos                                | Scroll-stopping Pidgin hooks ("Wetin Dey Occur", "Omo!") |
| VillageCircle (Conviction)     | Twitter/X in-stream, LinkedIn sponsored                       | Sunday mornings, public holidays                               | Dignified prose, economic independence framing           |
| Boldmind EduCenter (Education) | Meta link-preview/carousel                                    | JAMB registration (Jan–Mar), WAEC revision (Apr–Jun)           | Exam readiness, parent peace of mind                     |
| PlanAI/Ads Center (Enablement) | LinkedIn single-image, Instagram feed, WhatsApp click-to-chat | Year-round, budget spikes Q3 (back-to-school) and Q4 (festive) | Cost savings, "13 tools in one subscription"             |

### 27.9 Part 8 — Conclusions & Action Plan

Three standing execution priorities, applicable both to BoldmindNG's own channels and to subscriber workspaces using the Social Media Manager:

1. **Reinforce visual consistency** — every generated card/asset uses the exact dimensions/hex codes from §27.2; no ad-hoc spacing or typography.
2. **Coordinate flywheel referrals** — every channel points to the next pillar (AmeboGist → VillageCircle → EduCenter → PlanAI), tracked via the UTM mechanism in §27.4's `SocialAccountMetrics`.
3. **Automate publishing workflows** — scheduling runs through the §27.5 pipeline (Workspace UI → BullMQ → n8n → platform APIs), not manual posting, to keep management overhead flat as the number of brands/workspaces grows.

---

_BoldmindNG Master Design v3.0 (Unified) | July 2026 — updated to v3.1 with Redis/Queue hardening and Social Media Management & Branding Architecture (§27)_
_Supersedes: Master Design v2.2.2 + System Design v2.1_
_Env authority: §20, sourced from the dedicated env reconciliation pass — do not reintroduce the old env sections from either source doc_
_Redis/Queue authority: §25, sourced from the current production `redis.service.ts` and `queues.ts` — do not reintroduce the earlier illustrative versions of these files_
_Social media authority: §27, sourced from `Strategic Social Media Management and Branding Architecture for BoldmindNG` — several code snippets there had incomplete array literals/empty placeholder arrays, fixed and flagged inline in §27.4–§27.8_
_Next review trigger: any change to products.ts, pricing.ts, colors.ts, schema.prisma, queues.ts, redis.service.ts, or a live-route diff against §6.3_
