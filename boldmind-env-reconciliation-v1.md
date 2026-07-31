# BoldmindNG — Environment Variable Reconciliation v1

Reconciling your pasted flat list (67 vars, presumably pulled from Railway/Vercel or a live `.env`) against every documented env checklist (`boldmind-system-design-v2.1.md` §21, `boldmind-service-canonical.md` §5, Master Design v2.2.2 §9). Goal: one canonical name per concern, no duplicates, nothing silently missing.

**Before deleting anything below:** grep `boldmind-service/src` and `boldmind-shared/packages/deploy-config/src/env-schema.ts` for each losing name in a pair before removing it from Railway — I'm reconciling against documentation, not against the actual `validate-env.ts` source, which I haven't seen. Treat the "keep" column as a strong recommendation, not a guarantee nothing reads the other name today.

---

## 1. Duplicate/alias groups — pick one canonical name

Your pasted list has accumulated multiple names for the same concern, almost certainly from different features being built at different times without checking the existing var first. This is the actual highest-value fix here.

| Concern                                      | Names found in your list                                                                             | Keep                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                        | Action                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp phone number ID                     | `META_WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_PHONE_NUMBER_ID`                                          | `META_WHATSAPP_PHONE_NUMBER_ID`                                                                                                                                            | Same reason — matches `WhatsAppProvider` constructor param comment                                                                                                                                                                                                                                                                                                         | Same grep-and-consolidate                                                                                                                                                                                                                                                                            |
| Webhook verify token                         | `META_VERIFY_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`                    | `META_VERIFY_TOKEN`                                                                                                                                                        | Matches docs; used by `GET /planai/social/webhook` verification handshake (confirmed live in doc 27)                                                                                                                                                                                                                                                                       | Same                                                                                                                                                                                                                                                                                                 |
| Webhook payload signature secret             | `META_APP_SECRET`                                                                                    | — (new, keep as-is)                                                                                                                                                        | **Not a duplicate — genuinely missing from every prior doc.** This is the App Secret Meta uses to HMAC-sign incoming webhook payloads, distinct from the verify token used only at subscription time. If `notification.service.ts` or `social-media.controller.ts` isn't validating this signature on every inbound webhook POST, that's a real gap, not just a docs gap   | Add to canonical env list permanently; confirm signature validation exists in the webhook handler                                                                                                                                                                                                    |
| Gemini key                                   | `GEMINI_API_KEY`, `GOOGLE_GEMINI_API_KEY`                                                            | `GOOGLE_GEMINI_API_KEY`                                                                                                                                                    | Matches docs and the `ai/providers/gemini.provider.ts` naming convention (all other AI keys are bare except this one, which docs deliberately prefixed to disambiguate from other Google products)                                                                                                                                                                         | Grep both, consolidate                                                                                                                                                                                                                                                                               |
| ALOC exam-question API key                   | `ALOC_API_TOKEN` (yours) vs `ALOC_API_KEY` (docs)                                                    | `ALOC_API_TOKEN`                                                                                                                                                           | Pure naming drift, no functional duplicate — but every doc says `_KEY` and your live env says `_TOKEN`. Since your live env is what's actually deployed, **update the docs to match reality**, not the other way around                                                                                                                                                    | Fix `boldmind-system-design-v2.1.md` §21 and `boldmind-service-canonical.md` §5 to say `ALOC_API_TOKEN`                                                                                                                                                                                              |
| Hunter.io key (Business Discovery Directory) | `HUNTER_API_KEY`, `HUNTER_IO_API_KEY`                                                                | `HUNTER_IO_API_KEY`                                                                                                                                                        | Never appeared in any prior doc at all — this integration (`Hunter.io` per `products.ts` `business-discovery` techStack) was previously undocumented. Prefer the fuller name since "Hunter" alone is ambiguous                                                                                                                                                             | Grep `biz-directory.service.ts`, consolidate, then add to canonical env list                                                                                                                                                                                                                         |
| Cloudflare R2 bucket name                    | `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_BUCKET_NAME`                                                  | `CLOUDFLARE_R2_BUCKET_NAME`                                                                                                                                                | Matches docs                                                                                                                                                                                                                                                                                                                                                               | Consolidate                                                                                                                                                                                                                                                                                          |
| MongoDB connection                           | `MONGODB_URL` (yours) vs `MONGODB_URI` (docs)                                                        | `MONGODB_URL`                                                                                                                                                              | Same pattern as ALOC — your live env has the real name, update docs                                                                                                                                                                                                                                                                                                        | Fix docs                                                                                                                                                                                                                                                                                             |
| Redis (legacy single instance)               | `REDIS_URL` alongside the 3-instance split (`REDIS_SESSION_URL`/`REDIS_QUEUE_URL`/`REDIS_CACHE_URL`) | Drop `REDIS_URL`                                                                                                                                                           | This is very likely a **leftover from before the Wave-0 Redis split** documented everywhere else. If anything in the codebase still reads bare `REDIS_URL`, it's bypassing the session/queue/cache separation the whole architecture depends on — that's a real bug, not just clutter                                                                                      | Grep `REDIS_URL` across `boldmind-service/src`. If any hit exists outside a migration script, that's a Wave-0 regression to fix immediately, higher priority than this cleanup                                                                                                                       |
| JWT signing secret                           | `JWT_SECRET` (docs) vs `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` (yours)                            | `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET`                                                                                                                                 | Your live setup is **better practice** than what the docs specified — separate secrets per token type means a leaked refresh secret doesn't compromise access tokens and vice versa. Docs should adopt your pattern, not the reverse                                                                                                                                       | Update every doc's env checklist to show the split; confirm `auth.service.ts`/`jwt.strategy.ts` actually use two distinct secrets (not one secret read twice under two names)                                                                                                                        |
| Frontend URL(s) / CORS                       | `FRONTEND_URL`, `FRONTEND_URLS`, `ALLOWED_ORIGINS`, `CORS_ORIGINS`                                   | `FRONTEND_URLS` (comma list) for the canonical list; `CORS_ORIGINS` **removed**, `getCorsOrigins()` should derive from `FRONTEND_URLS` at runtime per `deploy-config` spec | Four names for what's really two concerns (a canonical list of ecosystem frontend domains, and what `main.ts` passes to `app.enableCors()`) — docs already said "CORS_ORIGINS = same as FRONTEND_URLS," meaning it was never meant to be its own var                                                                                                                       | Grep `ALLOWED_ORIGINS` and `FRONTEND_URL` (singular) — likely both are a single app's local var (e.g. one Next.js app reading its own origin) rather than the ecosystem-wide list; if so, rename to something scoped like `NEXT_PUBLIC_APP_URL` per-app, don't conflate with the service's CORS list |
| Service/app base URL                         | `APP_URL` (yours) vs `HUB_URL` (docs)                                                                | Both, but scoped differently                                                                                                                                               | `HUB_URL` is documented as specifically "used in `auth.controller.ts` post-login redirect" — i.e. always `https://boldmind.ng`. `APP_URL` isn't in any doc; if it's `boldmind-service`'s own self-referencing base URL (for constructing absolute links in emails/webhooks), keep both and document `APP_URL` as new. If it's actually a duplicate of `HUB_URL`, delete it | **Needs a decision from you** — check what `APP_URL` is actually read for before deciding                                                                                                                                                                                                            |

---

## 2. Genuinely new, correctly-scoped additions (not duplicates — add to canonical docs)

These exist in your live env but never appeared in any system-design doc. They're not drift, they're gaps in the documentation:

| Var                                       | Purpose (inferred)                                                                                                                                                                | Where it belongs                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GAS_WEBHOOK_URL`, `GAS_WEBHOOK_SECRET`   | The Google Apps Script `doPost` Web App bridge connecting Vercel-hosted apps to Drive-side automation (client project auto-setup, weekly digest, etc.)                            | New env group: **Drive Automation Bridge** — add to `boldmind-service` checklist, since this is presumably how the service triggers Drive-side workflows, not a frontend concern                                                                                                                                         |
| `EMAIL_FROM`                              | Resend "from" address — every doc mentions `RESEND_API_KEY` but never the sender identity                                                                                         | **Communications** group, alongside `RESEND_API_KEY`                                                                                                                                                                                                                                                                     |
| `SSO_COOKIE_DOMAIN`                       | Operationalizes the `.boldmind.ng` cookie-domain rule stated in prose everywhere but never as a configurable var                                                                  | **Auth** group — this is actually an important addition; hardcoding `.boldmind.ng` in code instead of reading this var would make staging/preview environments unable to test SSO at all                                                                                                                                 |
| `MONGODB_DB_MAIN`, `MONGODB_DB_AMEBOGIST` | Named-database selection within one Atlas cluster — more precise than a single connection string with an implicit db name                                                         | **Database** group, alongside `MONGODB_URL`                                                                                                                                                                                                                                                                              |
| `CLOUDFLARE_CDN_URL`                      | Public URL prefix for constructing media links from R2 keys (separate from the R2 API endpoint used for uploads)                                                                  | **Storage** group, alongside the R2 vars                                                                                                                                                                                                                                                                                 |
| `GITHUB_TOKEN`, `NODE_AUTH_TOKEN`         | GitHub Packages auth for `@boldmindng/*` scoped installs — `NODE_AUTH_TOKEN` is the standard var `.npmrc`'s `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` pattern expects | **Not a `boldmind-service` runtime var at all** — this belongs to CI/build-time env for every repo that installs `@boldmindng/*` packages, and to your local dev shell. Don't put it in Railway's service env; it doesn't need to be there and shouldn't have prod-time access to a token that can push to your packages |

---

## 3. Full reconciled group-by-group list

Everything from your paste, organized, with the fixes above applied. Use this as the new canonical checklist to replace the env sections in all three docs.

```env
# ─── DATABASE ─────────────────────────────────────────────────────────────────
DATABASE_URL=
MONGODB_URL=
MONGODB_DB_MAIN=
MONGODB_DB_AMEBOGIST=

# ─── REDIS (3 instances — REDIS_URL retired, see §1) ──────────────────────────
REDIS_SESSION_URL=
REDIS_QUEUE_URL=
REDIS_CACHE_URL=

# ─── AUTH ─────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=
SSO_COOKIE_DOMAIN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
API_KEY_ENCRYPTION_SECRET=

# ─── PAYMENTS ─────────────────────────────────────────────────────────────────
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=

# ─── AI PROVIDERS ─────────────────────────────────────────────────────────────
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GEMINI_API_KEY=
GROQ_API_KEY=
CLOUDFLARE_AI_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
FAL_API_KEY=
OLLAMA_BASE_URL=

# ─── COMMUNICATIONS ───────────────────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=
TERMII_API_KEY=
TERMII_SENDER_ID=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_APP_SECRET=
META_VERIFY_TOKEN=

# ─── STORAGE ──────────────────────────────────────────────────────────────────
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_CDN_URL=
CLOUDFLARE_STREAM_TOKEN=

# ─── INTEGRATIONS ─────────────────────────────────────────────────────────────
ALOC_API_TOKEN=
ALOC_BASE_URL=
HUNTER_IO_API_KEY=

# ─── DRIVE AUTOMATION BRIDGE (new — undocumented until now) ──────────────────
GAS_WEBHOOK_URL=
GAS_WEBHOOK_SECRET=

# ─── WEB PUSH / PWA ───────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=

# ─── ENTERPRISE API ───────────────────────────────────────────────────────────
WEBHOOK_DELIVERY_TIMEOUT_MS=

# ─── APP ──────────────────────────────────────────────────────────────────────
PORT=
NODE_ENV=
API_VERSION=
APP_URL=                # pending decision — see §1
HUB_URL=
FRONTEND_URLS=          # canonical comma-list; ALLOWED_ORIGINS/FRONTEND_URL/CORS_ORIGINS retire into this
```

**Not included above — CI/local-dev only, do not put in Railway service env:**

```text
GITHUB_TOKEN
NODE_AUTH_TOKEN
```

---

## 4. Action checklist

```text
[ ] Grep the 6 WhatsApp/Meta var names across notification/ and packages/sms/ —
    confirm which name is actually read, consolidate to the "Keep" column in §1
[ ] Grep REDIS_URL specifically — any hit outside a one-time migration script
    is a Wave-0 regression, fix before doing anything else in this list
[ ] Confirm JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are genuinely two different
    values, not the same secret read under two names
[ ] Decide what APP_URL is actually for — keep separate from HUB_URL or delete
[ ] Update ALOC_API_KEY → ALOC_API_TOKEN and MONGODB_URI → MONGODB_URL in
    boldmind-system-design-v2.1.md §21 and boldmind-service-canonical.md §5
    (docs were wrong, not the live env)
[ ] Add GAS_WEBHOOK_URL/SECRET, EMAIL_FROM, SSO_COOKIE_DOMAIN, MONGODB_DB_MAIN/
    MONGODB_DB_AMEBOGIST, CLOUDFLARE_CDN_URL, META_APP_SECRET, HUNTER_IO_API_KEY
    to the canonical env checklist in all three docs — these are real and
    were simply never written down
[ ] Move GITHUB_TOKEN/NODE_AUTH_TOKEN out of the service's Railway env if
    they're currently there — CI/local-dev scope only
[ ] Once consolidated, update APP_ENV_SCHEMAS in @boldmindng/deploy-config
    to match this list exactly, so validateEnv('boldmind-service', env)
    actually enforces it going forward instead of drifting again
```
