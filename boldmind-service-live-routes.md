# BoldmindNG API Reference — Live Routes

**Generated from `boldmind-service` startup log**
**Base URL:** `http://localhost:4001/api/v1` (dev) / `https://api.boldmind.ng/api/v1` (prod)
**Date:** 2026‑07‑27

---

This document lists **every route currently registered** in the running NestJS monolith.
For each endpoint you’ll find:

- HTTP method and full path
- A short description
- Authentication required (Public, JWT, Admin, X-API-Key, etc.)

Standard **error shape** and **paginated response** are described at the end of the document.

---

## Table of Contents

- [BoldmindNG API Reference — Live Routes](#boldmindng-api-reference--live-routes)
  - [Table of Contents](#table-of-contents)
  - [Auth](#auth)
  - [SSO](#sso)
  - [Users (Admin)](#users-admin)
  - [Users (Me / Self‑service)](#users-me--selfservice)
  - [Payments](#payments)
  - [PlanAI Suite](#planai-suite)
  - [Social Media Manager](#social-media-manager)
  - [Ads Center](#ads-center)
  - [Brand \& Digital Home](#brand--digital-home)
  - [Business Intelligence](#business-intelligence)
  - [Investor Readiness](#investor-readiness)
  - [Marketing Automation](#marketing-automation)
  - [Business Directory](#business-directory)
  - [AI Business Agent](#ai-business-agent)
  - [Project Manager](#project-manager)
  - [CRM \& Client Management](#crm--client-management)
  - [HR \& Payroll](#hr--payroll)
  - [Fitness Center](#fitness-center)
  - [Marketplace](#marketplace)
  - [AmeboGist (Content)](#amebogist-content)
  - [EduCenter](#educenter)
  - [LMS Builder](#lms-builder)
  - [School Portal](#school-portal)
  - [Automation](#automation)
  - [Media](#media)
  - [Notifications](#notifications)
  - [Admin](#admin)
  - [Health](#health)
  - [Wallet](#wallet)
  - [Hub](#hub)
  - [ReceiptGenius](#receiptgenius)
  - [KoloAI](#koloai)
  - [NaijaGig](#naijagig)
  - [Skill2Cash](#skill2cash)
  - [FarmGate](#farmgate)
  - [AfroHustle](#afrohustle)
  - [BorderlessRemit](#borderlessremit)
  - [SafeAI](#safeai)
  - [VibeCoders](#vibecoders)
  - [Waitlist (VillageCircle)](#waitlist-villagecircle)
  - [Developer API Keys](#developer-api-keys)
  - [Public Enterprise API](#public-enterprise-api)
  - [Webhooks](#webhooks)
  - [PolyMind Proxy](#polymind-proxy)
  - [Standard Response Shapes](#standard-response-shapes)
    - [Success (single item)](#success-single-item)
    - [Paginated](#paginated)
    - [Error](#error)

---

## Auth

**Controller:** `AuthController`
**Prefix:** `/api/v1/auth`

| Method | Path                     | Auth   | Description                               |
| ------ | ------------------------ | ------ | ----------------------------------------- |
| POST   | `/auth/register`         | Public | Create a new user account                 |
| POST   | `/auth/login`            | Public | Log in with email/password                |
| POST   | `/auth/login/verify-2fa` | Public | Complete login with 2FA code              |
| POST   | `/auth/refresh`          | Public | Obtain new access & refresh tokens        |
| POST   | `/auth/logout`           | JWT    | Invalidate current refresh token          |
| POST   | `/auth/logout-all`       | JWT    | Invalidate all user sessions              |
| GET    | `/auth/me`               | JWT    | Get current user profile                  |
| POST   | `/auth/verify-email`     | JWT    | Verify email address with code            |
| POST   | `/auth/send-phone-otp`   | JWT    | Send OTP via WhatsApp (or SMS fallback)   |
| POST   | `/auth/verify-phone`     | JWT    | Verify phone number with OTP              |
| POST   | `/auth/enable-2fa`       | JWT    | Enable two-factor authentication          |
| POST   | `/auth/verify-2fa`       | JWT    | Verify 2FA setup                          |
| POST   | `/auth/forgot-password`  | Public | Request password reset OTP                |
| POST   | `/auth/reset-password`   | Public | Reset password using OTP and new password |
| PATCH  | `/auth/change-password`  | JWT    | Change password (authenticated)           |
| GET    | `/auth/google`           | Public | Initiate Google OAuth flow                |
| GET    | `/auth/google/callback`  | Public | Google OAuth callback                     |
| PATCH  | `/auth/users/:id/role`   | Admin  | Change a user’s role (admin only)         |

---

## SSO

**Controller:** `SsoController`
**Prefix:** `/api/v1/sso`

| Method | Path              | Auth   | Description                                |
| ------ | ----------------- | ------ | ------------------------------------------ |
| POST   | `/sso/relay`      | JWT    | Create cross‑domain relay token            |
| GET    | `/sso/exchange`   | Public | Exchange relay token for session tokens    |
| GET    | `/sso/validate`   | JWT    | Validate an existing cross‑domain session  |
| POST   | `/sso/logout-all` | JWT    | Invalidate all sessions across all domains |

---

## Users (Admin)

**Controller:** `UserController`
**Prefix:** `/api/v1/users`

| Method | Path                       | Auth  | Description                            |
| ------ | -------------------------- | ----- | -------------------------------------- |
| GET    | `/users`                   | Admin | List all users (paginated, filterable) |
| GET    | `/users/dashboard`         | Admin | Admin dashboard summary                |
| GET    | `/users/:id`               | Admin | Get user by ID                         |
| PATCH  | `/users/:id`               | Admin | Update user details (role, ban, etc.)  |
| DELETE | `/users/:id`               | Admin | Delete user (NDPA erasure scheduled)   |
| GET    | `/users/:id/subscriptions` | Admin | Get user’s subscriptions               |
| GET    | `/users/:id/activity`      | Admin | Get user activity log                  |
| PATCH  | `/users/:id/profile`       | Admin | Update user profile (admin override)   |
| POST   | `/users/onboarding`        | Admin | (Admin) trigger onboarding for user    |

---

## Users (Me / Self‑service)

**Controller:** `UserMeController`
**Prefix:** `/api/v1/users/me`

| Method | Path                               | Auth | Description                                      |
| ------ | ---------------------------------- | ---- | ------------------------------------------------ |
| GET    | `/users/me`                        | JWT  | Get my full profile + user data                  |
| PATCH  | `/users/me`                        | JWT  | Update my basic info (name, phone, etc.)         |
| GET    | `/users/me/profile`                | JWT  | Get my extended profile (bio, preferences, etc.) |
| PATCH  | `/users/me/profile`                | JWT  | Update my extended profile                       |
| PATCH  | `/users/me/avatar`                 | JWT  | Upload a new avatar (multipart)                  |
| GET    | `/users/me/products`               | JWT  | List products I have access to                   |
| GET    | `/users/me/notifications`          | JWT  | Get my notifications (paginated)                 |
| PATCH  | `/users/me/notifications/read-all` | JWT  | Mark all notifications as read                   |
| PATCH  | `/users/me/notifications/:id/read` | JWT  | Mark a single notification as read               |
| GET    | `/users/me/activity`               | JWT  | Get my recent activity log                       |
| POST   | `/users/me/onboarding`             | JWT  | Complete onboarding steps                        |
| DELETE | `/users/me`                        | JWT  | Request account deletion (GDPR/NDPA)             |

---

## Payments

**Controller:** `PaymentController`
**Prefix:** `/api/v1/payment`

| Method | Path                           | Auth   | Description                                    |
| ------ | ------------------------------ | ------ | ---------------------------------------------- |
| POST   | `/payment/initialize`          | JWT    | Start a new payment (Paystack)                 |
| GET    | `/payment/verify/:reference`   | JWT    | Verify payment by reference                    |
| POST   | `/payment/webhook`             | Public | Paystack webhook (HMAC verified)               |
| GET    | `/payment/history`             | JWT    | Get payment history for current user           |
| GET    | `/payment/subscriptions`       | JWT    | Get current user’s subscriptions               |
| GET    | `/payment/access/:productSlug` | JWT    | Check if user has access to a specific product |
| POST   | `/payment/waitlist`            | JWT    | Join a product waitlist (pre‑launch)           |

---

## PlanAI Suite

**Controller:** `PlanAISuiteController`
**Prefix:** `/api/v1/planai`

| Method | Path                          | Auth | Description                          |
| ------ | ----------------------------- | ---- | ------------------------------------ |
| GET    | `/planai/jobs`                | JWT  | List AI generation jobs (filterable) |
| GET    | `/planai/jobs/:id`            | JWT  | Get a single job’s status + result   |
| POST   | `/planai/planning`            | JWT  | Generate a business plan             |
| POST   | `/planai/finance`             | JWT  | Financial projections / calculations |
| POST   | `/planai/branding`            | JWT  | Branding assets generation           |
| POST   | `/planai/marketing`           | JWT  | Marketing content generation         |
| POST   | `/planai/credibility`         | JWT  | Credibility / trust signals analysis |
| POST   | `/planai/investor`            | JWT  | Investor‑readiness documents         |
| POST   | `/planai/hr`                  | JWT  | HR documents / tools                 |
| POST   | `/planai/legal`               | JWT  | Legal document generation            |
| POST   | `/planai/store/content`       | JWT  | Generate content for digital stores  |
| POST   | `/planai/analytics/insights`  | JWT  | AI‑powered business insights         |
| POST   | `/planai/operations`          | JWT  | Operational optimisation tasks       |
| POST   | `/planai/emailscraper/enrich` | JWT  | Enrich email contacts / lead data    |

---

## Social Media Manager

**Controller:** `SocialMediaController`
**Prefix:** `/api/v1/planai/social`

| Method | Path                                          | Auth   | Description                            |
| ------ | --------------------------------------------- | ------ | -------------------------------------- |
| GET    | `/planai/social/webhook`                      | Public | Meta webhook verification (GET)        |
| POST   | `/planai/social/webhook`                      | Public | Receive WhatsApp / Meta webhook events |
| POST   | `/planai/social/setup`                        | JWT    | Configure social media automation      |
| GET    | `/planai/social/my`                           | JWT    | Get my social manager settings         |
| PATCH  | `/planai/social/my`                           | JWT    | Update my social manager settings      |
| PATCH  | `/planai/social/my/toggle`                    | JWT    | Toggle social manager on/off           |
| GET    | `/planai/social/conversations`                | JWT    | List all conversations                 |
| GET    | `/planai/social/conversations/:phone`         | JWT    | Get conversation by phone number       |
| POST   | `/planai/social/conversations/:phone/reply`   | JWT    | Send a reply in a conversation         |
| PATCH  | `/planai/social/conversations/:phone/resolve` | JWT    | Mark conversation as resolved          |
| POST   | `/planai/social/knowledge`                    | JWT    | Add to social knowledge base           |
| GET    | `/planai/social/knowledge`                    | JWT    | List knowledge base entries            |
| DELETE | `/planai/social/knowledge/:id`                | JWT    | Remove a knowledge base entry          |
| GET    | `/planai/social/analytics`                    | JWT    | Social engagement analytics            |
| GET    | `/planai/social/admin/all`                    | Admin  | List all social setups (admin)         |
| PATCH  | `/planai/social/admin/:id/suspend`            | Admin  | Suspend a social setup                 |
| GET    | `/planai/social/content`                      | JWT    | Get generated/pending content          |
| DELETE | `/planai/social/content/:id`                  | JWT    | Delete a generated content item        |
| POST   | `/planai/social/generate/image`               | JWT    | Generate image for social              |
| POST   | `/planai/social/generate/video`               | JWT    | Generate video for social              |

---

## Ads Center

**Controller:** `AdsCenterController`
**Prefix:** `/api/v1/planai/ads`

| Method | Path                                                    | Auth | Description                                  |
| ------ | ------------------------------------------------------- | ---- | -------------------------------------------- |
| POST   | `/planai/ads/campaigns`                                 | JWT  | Create a new ad campaign                     |
| GET    | `/planai/ads/campaigns`                                 | JWT  | List all ad campaigns                        |
| GET    | `/planai/ads/campaigns/:platformCampaignId/performance` | JWT  | Get performance for a specific campaign      |
| POST   | `/planai/ads/creative`                                  | JWT  | Generate ad creative (headline, image, etc.) |
| POST   | `/planai/ads/compliance-check`                          | JWT  | Check ad compliance with platform policies   |

---

## Brand & Digital Home

**Controller:** `BrandHomeController`
**Prefix:** `/api/v1/planai/brand`

| Method | Path                                     | Auth | Description                    |
| ------ | ---------------------------------------- | ---- | ------------------------------ |
| POST   | `/planai/brand/logo`                     | JWT  | Generate logo designs          |
| POST   | `/planai/brand/palette`                  | JWT  | Generate colour palette        |
| POST   | `/planai/brand/flyer`                    | JWT  | Generate marketing flyer       |
| POST   | `/planai/brand/portfolio`                | JWT  | Create/update brand portfolio  |
| POST   | `/planai/brand/resume`                   | JWT  | Generate a professional resume |
| POST   | `/planai/brand/stores`                   | JWT  | Create a digital store         |
| GET    | `/planai/brand/stores`                   | JWT  | List my digital stores         |
| POST   | `/planai/brand/stores/:storeId/products` | JWT  | Add a product to store         |
| GET    | `/planai/brand/stores/:storeId/products` | JWT  | List products in store         |
| GET    | `/planai/brand/stores/:storeId/orders`   | JWT  | Get orders for store           |

---

## Business Intelligence

**Controller:** `BizIntelController`
**Prefix:** `/api/v1/planai/intelligence`

| Method | Path                                        | Auth | Description                     |
| ------ | ------------------------------------------- | ---- | ------------------------------- |
| GET    | `/planai/intelligence/dashboard`            | JWT  | Intelligence suite dashboard    |
| POST   | `/planai/intelligence/business-plan`        | JWT  | Generate business plan          |
| POST   | `/planai/intelligence/forecast`             | JWT  | Revenue / growth forecast       |
| POST   | `/planai/intelligence/pitch-deck`           | JWT  | Generate investor pitch deck    |
| POST   | `/planai/intelligence/swot`                 | JWT  | SWOT analysis                   |
| GET    | `/planai/intelligence/market/:industry`     | JWT  | Market research for an industry |
| POST   | `/planai/intelligence/break-even`           | JWT  | Break‑even analysis             |
| GET    | `/planai/intelligence/regulatory/:industry` | JWT  | Regulatory info for an industry |

---

## Investor Readiness

**Controller:** `InvestorKitController`
**Prefix:** `/api/v1/planai/investor`

| Method | Path                               | Auth | Description               |
| ------ | ---------------------------------- | ---- | ------------------------- |
| POST   | `/planai/investor/safe`            | JWT  | Generate SAFE agreement   |
| POST   | `/planai/investor/cap-table`       | JWT  | Manage cap table          |
| POST   | `/planai/investor/data-room`       | JWT  | Create investor data room |
| GET    | `/planai/investor/vc-tracker`      | JWT  | View tracked VCs          |
| POST   | `/planai/investor/investor-update` | JWT  | Send an investor update   |

---

## Marketing Automation

**Controller:** `MarketingAutoController`
**Prefix:** `/api/v1/planai/marketing`

| Method | Path                                  | Auth | Description                      |
| ------ | ------------------------------------- | ---- | -------------------------------- |
| POST   | `/planai/marketing/campaigns`         | JWT  | Create email/WhatsApp campaign   |
| GET    | `/planai/marketing/campaigns`         | JWT  | List campaigns                   |
| POST   | `/planai/marketing/drip`              | JWT  | Set up drip sequences            |
| POST   | `/planai/marketing/abandoned-cart`    | JWT  | Trigger abandoned cart reminders |
| GET    | `/planai/marketing/segments`          | JWT  | Get audience segments            |
| GET    | `/planai/marketing/festive-templates` | JWT  | Get festive campaign templates   |

---

## Business Directory

**Controller:** `BizDirectoryController`
**Prefix:** `/api/v1/planai/directory`

| Method | Path                                | Auth | Description                      |
| ------ | ----------------------------------- | ---- | -------------------------------- |
| GET    | `/planai/directory/search`          | JWT  | Search business/contact listings |
| POST   | `/planai/directory/contacts`        | JWT  | Add a new contact                |
| POST   | `/planai/directory/verify-email`    | JWT  | Verify email deliverability      |
| GET    | `/planai/directory/intent-signals`  | JWT  | Get intent signals for leads     |
| GET    | `/planai/directory/recent-searches` | JWT  | Recent searches by user          |

---

## AI Business Agent

**Controller:** `BizAgentController`
**Prefix:** `/api/v1/planai/agent`

| Method | Path                      | Auth | Description                  |
| ------ | ------------------------- | ---- | ---------------------------- |
| POST   | `/planai/agent/configure` | JWT  | Configure AI agent behaviour |
| GET    | `/planai/agent/status`    | JWT  | Check agent status           |
| POST   | `/planai/agent/task`      | JWT  | Dispatch a task to the agent |
| GET    | `/planai/agent/logs`      | JWT  | View agent action logs       |
| GET    | `/planai/agent/briefing`  | JWT  | Get agent daily briefing     |

---

## Project Manager

**Controller:** `ProjectManagerController`
**Prefix:** `/api/v1/planai/projects`

| Method | Path                                                         | Auth | Description                              |
| ------ | ------------------------------------------------------------ | ---- | ---------------------------------------- |
| POST   | `/planai/projects/workspaces`                                | JWT  | Create a workspace                       |
| GET    | `/planai/projects/workspaces`                                | JWT  | List my workspaces                       |
| GET    | `/planai/projects/workspaces/:id`                            | JWT  | Get workspace details                    |
| PATCH  | `/planai/projects/workspaces/:id`                            | JWT  | Update workspace                         |
| DELETE | `/planai/projects/workspaces/:id`                            | JWT  | Delete workspace                         |
| POST   | `/planai/projects/workspaces/:id/members`                    | JWT  | Add member to workspace                  |
| DELETE | `/planai/projects/workspaces/:id/members/:targetUserId`      | JWT  | Remove member from workspace             |
| PATCH  | `/planai/projects/workspaces/:id/members/:targetUserId/role` | JWT  | Change member role                       |
| POST   | `/planai/projects/workspaces/:workspaceId/projects`          | JWT  | Create project inside workspace          |
| GET    | `/planai/projects/workspaces/:workspaceId/projects`          | JWT  | List projects in workspace               |
| POST   | `/planai/projects/tasks`                                     | JWT  | Create a task                            |
| GET    | `/planai/projects/workspaces/:workspaceId/tasks`             | JWT  | List tasks in workspace                  |
| PATCH  | `/planai/projects/tasks/:taskId`                             | JWT  | Update task                              |
| DELETE | `/planai/projects/tasks/:taskId`                             | JWT  | Delete task                              |
| POST   | `/planai/projects/tasks/:taskId/breakdown`                   | JWT  | AI breakdown of task into subtasks       |
| POST   | `/planai/projects/workspaces/:workspaceId/brain-dump`        | JWT  | Convert brain‑dump into structured tasks |
| POST   | `/planai/projects/pomodoro/start`                            | JWT  | Start a Pomodoro session                 |
| POST   | `/planai/projects/pomodoro/:sessionId/complete`              | JWT  | Complete a Pomodoro session              |
| GET    | `/planai/projects/pomodoro/stats`                            | JWT  | Get Pomodoro stats                       |
| POST   | `/planai/projects/knowledge`                                 | JWT  | Add knowledge entry                      |
| GET    | `/planai/projects/knowledge`                                 | JWT  | List knowledge entries                   |
| POST   | `/planai/projects/workspaces/:workspaceId/meeting-notes`     | JWT  | Generate meeting notes from transcript   |

---

## CRM & Client Management

**Controller:** `PlanCRMController`
**Prefix:** `/api/v1/planai/crm`

| Method | Path                                          | Auth | Description                            |
| ------ | --------------------------------------------- | ---- | -------------------------------------- |
| POST   | `/planai/crm/contacts`                        | JWT  | Create a new contact                   |
| GET    | `/planai/crm/contacts`                        | JWT  | List contacts (filterable)             |
| POST   | `/planai/crm/deals`                           | JWT  | Create a new deal                      |
| PATCH  | `/planai/crm/deals/:dealId/stage`             | JWT  | Move deal to a different stage         |
| GET    | `/planai/crm/pipeline`                        | JWT  | View sales pipeline                    |
| GET    | `/planai/crm/contacts/:contactId/next-action` | JWT  | AI‑suggested next action for a contact |
| GET    | `/planai/crm/churn-risk`                      | JWT  | Identify contacts at risk of churning  |

---

## HR & Payroll

**Controller:** `HRPayrollController`
**Prefix:** `/api/v1/planai/hr`

| Method | Path                                        | Auth | Description                          |
| ------ | ------------------------------------------- | ---- | ------------------------------------ |
| POST   | `/planai/hr/employees`                      | JWT  | Add a new employee                   |
| GET    | `/planai/hr/employees`                      | JWT  | List all employees                   |
| PATCH  | `/planai/hr/employees/:empId/terminate`     | JWT  | Terminate an employee                |
| POST   | `/planai/hr/payroll/run`                    | JWT  | Run payroll                          |
| POST   | `/planai/hr/leave`                          | JWT  | Request leave                        |
| GET    | `/planai/hr/employees/:empId/leave-balance` | JWT  | Get leave balance for an employee    |
| POST   | `/planai/hr/tools/job-description`          | JWT  | Generate a job description           |
| POST   | `/planai/hr/tools/query-letter`             | JWT  | Generate a query/disciplinary letter |
| POST   | `/planai/hr/tools/deductions-calc`          | JWT  | Calculate payroll deductions         |

---

## Fitness Center

**Controller:** `FitnessCenterController`
**Prefix:** `/api/v1/planai/fitness`

| Method | Path                                    | Auth | Description                              |
| ------ | --------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/planai/fitness/plan`                  | JWT  | Get my fitness plan                      |
| POST   | `/planai/fitness/workouts/log`          | JWT  | Log a workout session                    |
| POST   | `/planai/fitness/meals/log`             | JWT  | Log a meal                               |
| GET    | `/planai/fitness/meals/nutrition/:dish` | JWT  | Get nutritional info for a Nigerian dish |
| GET    | `/planai/fitness/meals/daily`           | JWT  | Get today’s meal log summary             |
| POST   | `/planai/fitness/coach`                 | JWT  | Ask AI fitness coach for advice          |
| POST   | `/planai/fitness/metrics`               | JWT  | Log body metrics (weight, etc.)          |
| GET    | `/planai/fitness/progress`              | JWT  | View progress charts                     |

---

## Marketplace

**Controller:** `MarketplaceController`
**Prefix:** `/api/v1/planai/marketplace`

| Method | Path                                              | Auth   | Description                         |
| ------ | ------------------------------------------------- | ------ | ----------------------------------- |
| POST   | `/planai/marketplace/services`                    | JWT    | List a service                      |
| GET    | `/planai/marketplace/services`                    | Public | Browse services (filterable)        |
| POST   | `/planai/marketplace/services/:listingId/book`    | JWT    | Book a service                      |
| POST   | `/planai/marketplace/digital`                     | JWT    | List a digital product              |
| POST   | `/planai/marketplace/digital/:productId/purchase` | JWT    | Purchase a digital product          |
| GET    | `/planai/marketplace/shipping/rates`              | JWT    | Get shipping rates                  |
| POST   | `/planai/marketplace/shipping/create`             | JWT    | Create a shipment                   |
| GET    | `/planai/marketplace/shipping/track/:waybill`     | JWT    | Track a shipment                    |
| GET    | `/planai/marketplace/seller/dashboard`            | JWT    | Seller dashboard (earnings, orders) |

---

## AmeboGist (Content)

**Controller:** `ContentController`
**Prefix:** `/api/v1/amebogist`

| Method | Path                                    | Auth          | Description                                   |
| ------ | --------------------------------------- | ------------- | --------------------------------------------- |
| GET    | `/amebogist/articles`                   | Public        | List published articles (paginated, filters)  |
| GET    | `/amebogist/search`                     | Public        | Full‑text search articles                     |
| GET    | `/amebogist/articles/trending`          | Public        | Get trending articles                         |
| GET    | `/amebogist/trending`                   | Public        | Alias for trending                            |
| GET    | `/amebogist/articles/featured`          | Public        | Get editor‑featured articles                  |
| GET    | `/amebogist/categories`                 | Public        | List all categories                           |
| GET    | `/amebogist/articles/categories`        | Public        | Alias for categories                          |
| POST   | `/amebogist/articles/generate-ai`       | JWT           | Generate article draft with AI                |
| GET    | `/amebogist/articles/trends`            | Public        | Get trending topics                           |
| GET    | `/amebogist/articles/:slug`             | Public        | Get single article by slug (increments views) |
| POST   | `/amebogist/articles`                   | Creator/Admin | Create a new article (draft)                  |
| PATCH  | `/amebogist/articles/:id`               | Creator/Admin | Update an article                             |
| DELETE | `/amebogist/articles/:id`               | Creator/Admin | Delete article (soft)                         |
| PATCH  | `/amebogist/articles/:id/publish`       | Creator/Admin | Publish an article                            |
| PATCH  | `/amebogist/articles/:id/archive`       | Creator/Admin | Archive an article                            |
| POST   | `/amebogist/articles/:id/video-factory` | Creator       | Create a video summary of article             |
| POST   | `/amebogist/articles/:id/react`         | JWT           | React to an article (like, love, etc.)        |
| POST   | `/amebogist/articles/:slug/view`        | Public        | Log a view (used for analytics)               |
| GET    | `/amebogist/articles/:id/comments`      | Public        | Get comments for an article                   |
| POST   | `/amebogist/articles/:id/comments`      | JWT           | Post a comment                                |
| DELETE | `/amebogist/comments/:id`               | JWT/Admin     | Delete a comment                              |
| PATCH  | `/amebogist/comments/:id/react`         | JWT           | React to a comment                            |
| GET    | `/amebogist/creator/my-articles`        | Creator       | List my own articles                          |
| GET    | `/amebogist/creator/stats`              | Creator       | Get creator stats                             |
| GET    | `/amebogist/me/stats`                   | JWT           | (Alias) my engagement stats                   |
| PATCH  | `/amebogist/articles/:id/feature`       | Admin         | Toggle featured status                        |
| PATCH  | `/amebogist/comments/:id/flag`          | JWT           | Flag a comment for moderation                 |
| GET    | `/amebogist/rss`                        | Public        | Full site RSS feed                            |
| GET    | `/amebogist/rss/:category`              | Public        | Category‑specific RSS feed                    |

---

## EduCenter

**Controller:** `EduCenterController`
**Prefix:** `/api/v1/educenter`

| Method | Path                                      | Auth    | Description                               |
| ------ | ----------------------------------------- | ------- | ----------------------------------------- |
| GET    | `/educenter/subjects/:examType`           | JWT     | List available subjects for an exam type  |
| GET    | `/educenter/questions/preview`            | JWT     | Preview questions (sampler)               |
| POST   | `/educenter/cbt/start`                    | JWT     | Start a new CBT session                   |
| POST   | `/educenter/cbt/mock`                     | JWT     | Start a mock CBT session                  |
| POST   | `/educenter/cbt/:sessionId/submit`        | JWT     | Submit an answer                          |
| POST   | `/educenter/cbt/:sessionId/abandon`       | JWT     | Abandon a session                         |
| GET    | `/educenter/cbt/:sessionId/review`        | JWT     | Review a completed session                |
| GET    | `/educenter/sessions`                     | JWT     | List my past sessions                     |
| GET    | `/educenter/dashboard`                    | JWT     | EduCenter dashboard with progress summary |
| GET    | `/educenter/analytics/:examType/:subject` | JWT     | Detailed analytics for subject/exam       |
| GET    | `/educenter/streak`                       | JWT     | Current study streak                      |
| PATCH  | `/educenter/streak/goal`                  | JWT     | Set a daily study goal                    |
| GET    | `/educenter/leaderboard`                  | JWT     | Leaderboard                               |
| GET    | `/educenter/leaderboard/my-rank`          | JWT     | My rank on leaderboard                    |
| POST   | `/educenter/ai-tutor`                     | JWT     | Ask AI tutor a question                   |
| POST   | `/educenter/study-plan`                   | JWT     | Generate a study plan                     |
| GET    | `/educenter/courses`                      | JWT     | List all courses (free + premium)         |
| GET    | `/educenter/courses/:slug`                | JWT     | Get course details + lessons              |
| POST   | `/educenter/courses/:courseId/enroll`     | JWT     | Enrol in a course                         |
| PATCH  | `/educenter/courses/:courseId/progress`   | JWT     | Update course progress                    |
| GET    | `/educenter/courses/marketing-playbooks`  | JWT     | Marketing playbook courses                |
| GET    | `/educenter/courses/ai-tools-training`    | JWT     | AI tools training courses                 |
| POST   | `/educenter/courses`                      | Creator | Create a new course (LMS builder)         |
| PATCH  | `/educenter/courses/:courseId/publish`    | Creator | Publish a course                          |

---

## LMS Builder

**Controller:** `LmsController`
**Prefix:** `/api/v1/educenter/lms`

| Method | Path                                  | Auth    | Description                               |
| ------ | ------------------------------------- | ------- | ----------------------------------------- |
| POST   | `/educenter/lms/courses`              | Creator | Create a new course                       |
| GET    | `/educenter/lms/courses`              | Creator | List my courses (creator view)            |
| GET    | `/educenter/lms/courses/:id`          | Creator | Get course details + lessons              |
| PATCH  | `/educenter/lms/courses/:id`          | Creator | Update course                             |
| POST   | `/educenter/lms/courses/:id/publish`  | Creator | Publish course                            |
| POST   | `/educenter/lms/courses/:id/lessons`  | Creator | Add a lesson to course                    |
| PATCH  | `/educenter/lms/lessons/:id`          | Creator | Update a lesson                           |
| DELETE | `/educenter/lms/lessons/:id`          | Creator | Delete a lesson                           |
| GET    | `/educenter/lms/courses/:id/students` | Creator | View enrolled students                    |
| GET    | `/educenter/lms/courses/:id/earnings` | Creator | View course earnings                      |
| POST   | `/educenter/lms/generate`             | Creator | AI‑generate a full course outline/content |

---

## School Portal

**Controller:** `SchoolController`
**Prefix:** `/api/v1/educenter/schools`

| Method | Path                                | Auth        | Description                       |
| ------ | ----------------------------------- | ----------- | --------------------------------- |
| POST   | `/educenter/schools/register`       | JWT         | Register a new school             |
| GET    | `/educenter/schools/me`             | SchoolAdmin | Get my school details + stats     |
| POST   | `/educenter/schools/me/students`    | SchoolAdmin | Enrol students (bulk)             |
| GET    | `/educenter/schools/me/students`    | SchoolAdmin | List enrolled students            |
| GET    | `/educenter/schools/me/performance` | SchoolAdmin | Class‑level performance           |
| POST   | `/educenter/schools/me/assignments` | SchoolAdmin | Create an assignment for students |

---

## Automation

**Controller:** `AutomationController`
**Prefix:** `/api/v1/automation`

| Method | Path                          | Auth     | Description                      |
| ------ | ----------------------------- | -------- | -------------------------------- |
| POST   | `/automation/social/schedule` | JWT      | Schedule a social media post     |
| POST   | `/automation/social/captions` | JWT      | Generate social captions in bulk |
| POST   | `/automation/email/campaign`  | JWT      | Create an email campaign         |
| POST   | `/automation/scraper/run`     | JWT      | Run the email scraper            |
| POST   | `/automation/scraper/verify`  | JWT      | Verify scraped emails            |
| POST   | `/automation/trigger`         | Internal | Trigger an n8n workflow          |
| GET    | `/automation/queues`          | Admin    | View queue statuses              |

---

## Media

**Controller:** `MediaController`
**Prefix:** `/api/v1/media`

| Method | Path                    | Auth  | Description                  |
| ------ | ----------------------- | ----- | ---------------------------- |
| POST   | `/media/upload`         | JWT   | Upload a single file         |
| POST   | `/media/upload/batch`   | JWT   | Upload multiple files        |
| POST   | `/media/presign`        | JWT   | Get a pre‑signed upload URL  |
| GET    | `/media`                | JWT   | List my uploaded files       |
| DELETE | `/media/:id`            | JWT   | Delete a file                |
| GET    | `/media/admin/all`      | Admin | List all files (admin)       |
| GET    | `/media/:id`            | JWT   | Get file metadata            |
| GET    | `/media/:id/signed-url` | JWT   | Get a temporary download URL |

---

## Notifications

**Controller:** `NotificationController`
**Prefix:** `/api/v1/notifications`

| Method | Path                              | Auth           | Description                            |
| ------ | --------------------------------- | -------------- | -------------------------------------- |
| GET    | `/notifications`                  | JWT            | Get my notifications (paginated)       |
| POST   | `/notifications/read`             | JWT            | Mark all as read                       |
| DELETE | `/notifications/:id`              | JWT            | Delete a notification                  |
| POST   | `/notifications/push/subscribe`   | JWT            | Subscribe to push notifications        |
| POST   | `/notifications/push/unsubscribe` | JWT            | Unsubscribe from push                  |
| GET    | `/notifications/push/vapid-key`   | Public         | Get VAPID public key                   |
| POST   | `/notifications/email`            | Admin/Internal | Send a transactional email             |
| POST   | `/notifications/whatsapp`         | Admin/Internal | Send a WhatsApp message                |
| POST   | `/notifications/push/user`        | Admin/Internal | Send a push notification to a user     |
| POST   | `/notifications/otp`              | Internal       | Send OTP (WhatsApp‑first)              |
| POST   | `/notifications/broadcast/push`   | Admin          | Broadcast push to all subscribed users |
| POST   | `/notifications/broadcast/email`  | Admin          | Broadcast email                        |

---

## Admin

**Controller:** `AdminController`
**Prefix:** `/api/v1/admin`

| Method | Path                                  | Auth  | Description                 |
| ------ | ------------------------------------- | ----- | --------------------------- |
| GET    | `/admin/dashboard`                    | Admin | Admin dashboard summary     |
| GET    | `/admin/users`                        | Admin | List all users (filterable) |
| PATCH  | `/admin/users/:id/ban`                | Admin | Ban a user                  |
| PATCH  | `/admin/users/:id/unban`              | Admin | Unban a user                |
| PATCH  | `/admin/users/:id/role`               | Admin | Change user role            |
| POST   | `/admin/wallet/credit`                | Admin | Credit a user’s wallet      |
| POST   | `/admin/wallet/lock`                  | Admin | Lock a user’s wallet        |
| GET    | `/admin/payments`                     | Admin | View all payments           |
| GET    | `/admin/subscriptions`                | Admin | View all subscriptions      |
| GET    | `/admin/analytics/revenue`            | Admin | Revenue analytics           |
| GET    | `/admin/vibecoders/applicants`        | Admin | View VibeCoders applicants  |
| GET    | `/admin/waitlist`                     | Admin | View all waitlist entries   |
| POST   | `/admin/waitlist/:productSlug/invite` | Admin | Invite from waitlist        |
| GET    | `/admin/logs`                         | Admin | View admin action logs      |

---

## Health

**Controller:** `HealthController`
**Prefix:** `/api/v1/health`

| Method | Path           | Auth   | Description        |
| ------ | -------------- | ------ | ------------------ |
| GET    | `/health`      | Public | Basic health check |
| GET    | `/health/ping` | Public | Ping endpoint      |

---

## Wallet

**Controller:** `WalletController`
**Prefix:** `/api/v1/wallet`

| Method | Path                     | Auth | Description                        |
| ------ | ------------------------ | ---- | ---------------------------------- |
| GET    | `/wallet`                | JWT  | Get wallet balance + tier          |
| GET    | `/wallet/ledger`         | JWT  | View transaction ledger            |
| POST   | `/wallet/topup/initiate` | JWT  | Start a wallet top‑up via Paystack |
| POST   | `/wallet/upgrade`        | JWT  | Upgrade wallet tier (BVN required) |

---

## Hub

**Controller:** `HubController`
**Prefix:** `/api/v1/hub`

| Method | Path                         | Auth   | Description                        |
| ------ | ---------------------------- | ------ | ---------------------------------- |
| GET    | `/hub/ecosystem`             | Public | Full ecosystem map                 |
| GET    | `/hub/products`              | JWT    | List products user has access to   |
| GET    | `/hub/pricing`               | Public | Pricing information                |
| GET    | `/hub/dashboard`             | JWT    | User hub dashboard                 |
| POST   | `/hub/referral/generate`     | JWT    | Generate referral link             |
| GET    | `/hub/referral/stats`        | JWT    | Get referral stats                 |
| GET    | `/hub/waitlist/:productSlug` | Public | Check waitlist position            |
| POST   | `/hub/waitlist/:productSlug` | Public | Join waitlist                      |
| GET    | `/hub/changelog`             | Public | Changelog entries                  |
| GET    | `/hub/status`                | Public | System status                      |
| GET    | `/hub/team`                  | JWT    | Get team members (PlanAI projects) |
| POST   | `/hub/team/invite`           | JWT    | Invite a team member               |
| DELETE | `/hub/team/:userId`          | JWT    | Remove a team member               |
| GET    | `/hub/stats`                 | JWT    | Aggregated stats for the user      |

---

## ReceiptGenius

**Controller:** `ReceiptGeniusController`
**Prefix:** `/api/v1/villagecircle/receiptgenius`

| Method | Path                                 | Auth | Description                      |
| ------ | ------------------------------------ | ---- | -------------------------------- |
| POST   | `/villagecircle/receiptgenius`       | JWT  | Generate a VAT‑compliant receipt |
| GET    | `/villagecircle/receiptgenius`       | JWT  | List my receipts                 |
| GET    | `/villagecircle/receiptgenius/stats` | JWT  | Receipt stats                    |
| GET    | `/villagecircle/receiptgenius/:id`   | JWT  | Get receipt details              |
| PUT    | `/villagecircle/receiptgenius/:id`   | JWT  | Update receipt                   |
| DELETE | `/villagecircle/receiptgenius/:id`   | JWT  | Delete receipt                   |

---

## KoloAI

**Controller:** `KoloAiController`
**Prefix:** `/api/v1/villagecircle/kolo-ai`

| Method | Path                                  | Auth | Description                      |
| ------ | ------------------------------------- | ---- | -------------------------------- |
| GET    | `/villagecircle/kolo-ai/languages`    | JWT  | Supported translation languages  |
| POST   | `/villagecircle/kolo-ai/translate`    | JWT  | Translate text                   |
| GET    | `/villagecircle/kolo-ai/history`      | JWT  | Translation history              |
| POST   | `/villagecircle/kolo-ai/feedback/:id` | JWT  | Submit feedback on a translation |

---

## NaijaGig

**Controller:** `NaijaGigController`
**Prefix:** `/api/v1/villagecircle/naijagig`

| Method | Path                                                     | Auth   | Description                               |
| ------ | -------------------------------------------------------- | ------ | ----------------------------------------- |
| GET    | `/villagecircle/naijagig/categories`                     | Public | List gig categories                       |
| POST   | `/villagecircle/naijagig`                                | JWT    | Post a new gig listing                    |
| GET    | `/villagecircle/naijagig`                                | Public | Browse gig listings                       |
| GET    | `/villagecircle/naijagig/mine`                           | JWT    | My own gig listings                       |
| GET    | `/villagecircle/naijagig/:id`                            | Public | Get gig details                           |
| PUT    | `/villagecircle/naijagig/:id`                            | JWT    | Update my gig listing                     |
| DELETE | `/villagecircle/naijagig/:id`                            | JWT    | Delete my gig listing                     |
| POST   | `/villagecircle/naijagig/:id/apply`                      | JWT    | Apply for a gig                           |
| PATCH  | `/villagecircle/naijagig/:gigId/applications/:artisanId` | JWT    | Manage application status (accept/reject) |

---

## Skill2Cash

**Controller:** `Skill2CashController`
**Prefix:** `/api/v1/villagecircle/skill2cash`

| Method | Path                                     | Auth   | Description                 |
| ------ | ---------------------------------------- | ------ | --------------------------- |
| GET    | `/villagecircle/skill2cash/browse`       | Public | Browse skill profiles       |
| GET    | `/villagecircle/skill2cash/profile/:id`  | Public | View a skill profile        |
| POST   | `/villagecircle/skill2cash/anonymous`    | JWT    | Create an anonymous profile |
| POST   | `/villagecircle/skill2cash/profile`      | JWT    | Create/update my profile    |
| GET    | `/villagecircle/skill2cash/me`           | JWT    | Get my profile              |
| PUT    | `/villagecircle/skill2cash/profile/:id`  | JWT    | Update profile (owner)      |
| PATCH  | `/villagecircle/skill2cash/availability` | JWT    | Toggle availability         |

---

## FarmGate

**Controller:** `FarmgateController`
**Prefix:** `/api/v1/villagecircle/farmgate`

| Method | Path                                    | Auth   | Description             |
| ------ | --------------------------------------- | ------ | ----------------------- |
| GET    | `/villagecircle/farmgate/categories`    | Public | Produce categories      |
| GET    | `/villagecircle/farmgate`               | Public | Browse produce listings |
| GET    | `/villagecircle/farmgate/:id`           | Public | View listing details    |
| POST   | `/villagecircle/farmgate`               | JWT    | Create a new listing    |
| GET    | `/villagecircle/farmgate/mine/listings` | JWT    | My listings             |
| PUT    | `/villagecircle/farmgate/:id`           | JWT    | Update my listing       |
| DELETE | `/villagecircle/farmgate/:id`           | JWT    | Delete my listing       |
| POST   | `/villagecircle/farmgate/:id/order`     | JWT    | Place an order          |

---

## AfroHustle

**Controller:** `AfroHustleController`
**Prefix:** `/api/v1/villagecircle/afrohustle`

| Method | Path                                   | Auth   | Description                      |
| ------ | -------------------------------------- | ------ | -------------------------------- |
| GET    | `/villagecircle/afrohustle/categories` | Public | Blueprint categories             |
| GET    | `/villagecircle/afrohustle/featured`   | Public | Featured blueprints              |
| GET    | `/villagecircle/afrohustle`            | Public | Browse blueprints                |
| GET    | `/villagecircle/afrohustle/slug/:slug` | Public | Get blueprint by slug            |
| GET    | `/villagecircle/afrohustle/:id`        | Public | Get blueprint by ID              |
| POST   | `/villagecircle/afrohustle/generate`   | JWT    | AI‑generate a business blueprint |

---

## BorderlessRemit

**Controller:** `BorderlessRemitController`
**Prefix:** `/api/v1/villagecircle/borderless-remit`

| Method | Path                                                           | Auth   | Description                      |
| ------ | -------------------------------------------------------------- | ------ | -------------------------------- |
| GET    | `/villagecircle/borderless-remit/currencies`                   | Public | Supported currencies             |
| GET    | `/villagecircle/borderless-remit/quote`                        | Public | Get a transfer quote             |
| POST   | `/villagecircle/borderless-remit/transfer`                     | JWT    | Initiate a transfer              |
| GET    | `/villagecircle/borderless-remit/transfers`                    | JWT    | List my transfers                |
| GET    | `/villagecircle/borderless-remit/transfers/:trackingId`        | JWT    | Get transfer details             |
| DELETE | `/villagecircle/borderless-remit/transfers/:trackingId`        | JWT    | Cancel a transfer                |
| POST   | `/villagecircle/borderless-remit/transfers/:trackingId/status` | JWT    | Update transfer status (webhook) |

---

## SafeAI

**Controller:** `SafeAiController`
**Prefix:** `/api/v1/villagecircle/safeai`

| Method | Path                                               | Auth   | Description            |
| ------ | -------------------------------------------------- | ------ | ---------------------- |
| POST   | `/villagecircle/safeai/incidents`                  | JWT    | Report an incident     |
| GET    | `/villagecircle/safeai/incidents`                  | Public | Browse incidents       |
| GET    | `/villagecircle/safeai/incidents/:id`              | Public | View incident details  |
| GET    | `/villagecircle/safeai/hotspots`                   | Public | Crime hotspot map      |
| GET    | `/villagecircle/safeai/alerts`                     | Public | Active safety alerts   |
| GET    | `/villagecircle/safeai/wanted`                     | Public | Wanted persons list    |
| GET    | `/villagecircle/safeai/stations`                   | Public | Police station locator |
| POST   | `/villagecircle/safeai/emergency`                  | Public | Send emergency alert   |
| PATCH  | `/villagecircle/safeai/admin/incidents/:id/status` | Admin  | Update incident status |
| POST   | `/villagecircle/safeai/admin/incidents/:id/verify` | Admin  | Verify an incident     |
| POST   | `/villagecircle/safeai/admin/alerts`               | Admin  | Create a safety alert  |
| DELETE | `/villagecircle/safeai/admin/alerts/:id`           | Admin  | Remove an alert        |
| POST   | `/villagecircle/safeai/admin/wanted`               | Admin  | Add a wanted person    |
| PATCH  | `/villagecircle/safeai/admin/wanted/:id/status`    | Admin  | Update wanted status   |
| GET    | `/villagecircle/safeai/admin/stats`                | Admin  | Admin dashboard stats  |

---

## VibeCoders

**Controller:** `VibeCodersController`
**Prefix:** `/api/v1/vibecoders` _(note: without `/villagecircle` prefix)_

| Method | Path                               | Auth   | Description                             |
| ------ | ---------------------------------- | ------ | --------------------------------------- |
| POST   | `/vibecoders/apply`                | Public | Submit application                      |
| GET    | `/vibecoders/assessment`           | Token  | Get assessment questions                |
| POST   | `/vibecoders/assessment`           | Token  | Submit assessment answers               |
| GET    | `/vibecoders/cohort`               | Public | Get active cohort details               |
| POST   | `/vibecoders/payment/initialize`   | JWT    | Initiate payment for accepted applicant |
| POST   | `/vibecoders/payment/webhook`      | Public | Payment webhook                         |
| GET    | `/vibecoders/admin/applicants`     | Admin  | View all applicants                     |
| PATCH  | `/vibecoders/admin/applicants/:id` | Admin  | Update applicant status                 |
| POST   | `/vibecoders/admin/enroll`         | Admin  | Enrol an applicant into cohort          |
| GET    | `/vibecoders/admin/stats`          | Admin  | VibeCoders admin stats                  |

---

## Waitlist (VillageCircle)

**Controller:** `WaitlistController`
**Prefix:** `/api/v1/villagecircle`

The following catch‑all routes handle all methods for specific concept waitlists:

- `/villagecircle/afrocopy-ai/*` (ALL)
- `/villagecircle/anontruth-mic/*` (ALL)
- `/villagecircle/power-alert/*` (ALL)

These likely correspond to dynamic waitlist sign‑up, position checking, etc.

---

## Developer API Keys

**Controller:** `ApiKeyController`
**Prefix:** `/api/v1/developer/keys`

| Method | Path                       | Auth      | Description                          |
| ------ | -------------------------- | --------- | ------------------------------------ |
| POST   | `/developer/keys`          | JWT       | Create a new API key                 |
| GET    | `/developer/keys`          | JWT       | List my API keys (no full key)       |
| DELETE | `/developer/keys/:id`      | JWT       | Revoke an API key                    |
| GET    | `/developer/keys/validate` | X-API-Key | Validate an API key (returns scopes) |

---

## Public Enterprise API

**Controller:** `EnterpriseController`
**Prefix:** `/api/v1/public`
**Auth:** `X-API-Key` header with appropriate scope.

| Method | Path                                   | Scope                    | Description             |
| ------ | -------------------------------------- | ------------------------ | ----------------------- |
| GET    | `/public/amebogist/posts`              | `amebogist:read`         | Get published articles  |
| GET    | `/public/amebogist/posts/:slug`        | `amebogist:read`         | Single article          |
| GET    | `/public/educenter/questions`          | `educenter:questions`    | Get exam questions      |
| POST   | `/public/educenter/submit`             | `educenter:submit`       | Submit answers          |
| POST   | `/public/planai/social/caption`        | `planai:social:generate` | Generate social caption |
| POST   | `/public/planai/branding/logo`         | `planai:branding:logo`   | Generate logo           |
| POST   | `/public/villagecircle/waitlist/:slug` | `villagecircle:waitlist` | Add to waitlist         |
| GET    | `/public/payments/verify/:reference`   | `payments:verify`        | Verify payment status   |

---

## Webhooks

**Controller:** `WebhookController`
**Prefix:** `/api/v1/developer/webhooks`

| Method | Path                      | Auth | Description                   |
| ------ | ------------------------- | ---- | ----------------------------- |
| POST   | `/developer/webhooks`     | JWT  | Subscribe to a webhook event  |
| GET    | `/developer/webhooks`     | JWT  | List my webhook subscriptions |
| DELETE | `/developer/webhooks/:id` | JWT  | Delete a subscription         |

Outgoing events: `payment.success`, `payment.failed`, `subscription.activated`, `subscription.cancelled`, `article.published`, `user.registered`, `vibecoders.applicant.applied`.

---

## PolyMind Proxy

**Controller:** `PolymindController`
**Prefix:** `/api/v1/polymind`
**Auth:** `X-API-Key` with scope `polymind:query`

| Method | Path                  | Auth      | Description                                    |
| ------ | --------------------- | --------- | ---------------------------------------------- |
| POST   | `/polymind/:provider` | X-API-Key | Query an AI provider (`openai`,`claude`, etc.) |
| GET    | `/polymind/history`   | X-API-Key | Get query history                              |

---

## Standard Response Shapes

### Success (single item)

```json
{
  "data": { ... },
  "meta": {}
}
```

### Paginated

```json
{
  "data": [ ... ],
  "total": 120,
  "page": 1,
  "pageSize": 20,
  "totalPages": 6,
  "hasNext": true,
  "hasPrev": false
}
```

### Error

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-07-27T16:36:00.000Z",
  "path": "/api/v1/..."
}
```

---

_This document was generated automatically from the NestJS route mappings on 2026‑07‑27. For full request/response schemas, refer to the `boldmind-service` Swagger UI or the `Master Design v2.2.2`._
