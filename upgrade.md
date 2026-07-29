# Prompt: Individual App Design Document

**Purpose:** Generate a comprehensive design document for each BoldmindNG frontend app (boldmind-web, planai-suite, amebogist-web, educenter-web, villagecircle-web). This document will serve as the canonical reference for that app’s architecture, data flow, component hierarchy, and integration points.

---

## Instructions for the AI

1. **For each app**, produce a markdown document with the following sections:
   - **Overview** – Purpose, core user personas, primary user goals.
   - **Page/Routing Map** – List all routes (from `app/` directory), grouped by public, authenticated, admin sections. Include route parameters, query strings, and layout wrappers.
   - **Layout Architecture** – Describe the layout hierarchy (`layout.tsx`, `[subdomain]Layout.tsx`, etc.). How does SSO integration work? (middleware, `app/sso/route.ts`, or `app/api/auth/...`).
   - **State Management** – What client state is used? (Zustand stores, React Context, URL state). What server state is fetched via `@boldmindng/api-client`? Which hooks are used (`useUser`, `usePermissions`, `useWallet`, etc.)?
   - **Data Flow** – Trace a typical user action (e.g., login, view dashboard, make payment, schedule a post) from UI to API call to backend response and UI update.
   - **Key Components** – List and describe major reusable components (e.g., `SuperNavbar`, `PricingContent`, `AdBanner`, `InstallPromptBanner`) and where they are used. Include component props and responsibilities.
   - **Dependencies** – Which shared packages from `boldmind-shared` does this app import? Which are used only on the client vs. server?
   - **Environment Variables** – List all `NEXT_PUBLIC_*` and server-only vars required, referencing `@boldmindng/deploy-config` schema.
   - **Testing Strategy** – What tests exist? (unit, integration, E2E). Which tools? (Jest, Playwright). What are the critical paths to test?
   - **Performance Considerations** – How is performance optimized? (ISR, caching, CDN, image optimization, code splitting). Lighthouse targets.
   - **Deployment** – Vercel project settings, build command (`turbo build` or `next build`), environment groups.

2. **Use the following source material**:
   - The repo project tree (provided in the user’s request).
   - The master system design doc (`boldmind-system-design-v2.md` / this comprehensive doc).
   - The `boldmind-service-canonical.md` for API endpoints used by this app.
   - The `boldmind-shared-monorepo.md` for package descriptions.

3. **Output** one document per app. Each document should be at least 3–5 pages (in markdown length) with clear section headings.

---

## Example Outline for `boldmind-web`

```markdown
# boldmind-web – Design Document

## 1. Overview

- Purpose: Main hub for BoldmindNG ecosystem
- User personas: Founders, business owners, students, ecosystem partners
- Primary goals: SSO login, dashboard overview, wallet management, developer portal, changelog

## 2. Routing Map

- Public: `/`, `/about`, `/pricing`, `/ecosystem`, `/changelog`, `/developers/*`, `/status`, etc.
- Auth: `/login`, `/register`, `/forgot-password`, `/verify-email`, `/onboarding`
- Dashboard: `/dashboard`, `/dashboard/analytics`, `/dashboard/wallet`, `/dashboard/settings`, etc.
- Admin: `/admin/*` (restricted to `role: admin`)

## 3. Layout Architecture

- Root layout (`app/layout.tsx`) – global providers (Theme, Auth, PostHog, ErrorBoundary)
- `boldmindLayout.tsx` – main layout with `SuperNavbar`, `SuperFooter`, `ClientAuthProvider`
- `app/(dashboard)/layout.tsx` – protected wrapper with sidebar
- SSO: `app/sso/route.ts` handles relay token exchange; middleware protects routes

## 4. State Management

- Client: Zustand store for auth (`@boldmindng/auth/store`), React Query for server state (via `api-client`)
- Hooks used: `useUser`, `usePermissions`, `useWallet`, `useLocalStorage`
- Server: React Server Components fetch data directly; client components use `useQuery` from TanStack Query

## 5. Data Flow

- Login: `POST /auth/login` → receives JWT → stored in memory (Zustand) + refresh cookie
- Dashboard: `GET /hub/dashboard` → displays widgets, product access, wallet balance
- Wallet: `GET /wallet` → balance; `GET /wallet/ledger` → transactions
- Developer: `POST /developer/keys` → creates API key, displayed once

## 6. Key Components

- `SuperNavbar` – dynamic navigation based on user role, product pills from `BOLDMIND_PRODUCTS`
- `SuperFooter` – links to all ecosystem products
- `PricingContent` – reads from `BOLDMIND_PRICING`
- `WalletBalanceCard`, `TransactionLedger`, `TopUpForm`
- `InstallPromptBanner` – uses `@boldmindng/pwa` to detect PWA installability

## 7. Dependencies

- `@boldmindng/ui` – all UI components
- `@boldmindng/auth` – middleware, SSO helpers
- `@boldmindng/api-client` – API calls (auth, hub, wallet, developer, etc.)
- `@boldmindng/utils` – formatters, constants
- `@boldmindng/wallet` – useWallet hook
- `@boldmindng/pwa` – manifest, service worker registration
- `@boldmindng/deploy-config` – env validation, security headers

## 8. Environment Variables

- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_HUB_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, etc.
- Server-only: `SSO_EXCHANGE_URL` (for backend calls)

## 9. Testing Strategy

- Unit tests for utility functions and components (Jest + React Testing Library)
- Integration tests for API client mocking
- E2E with Playwright covering sign-up, dashboard access, wallet top‑up

## 10. Performance

- Use of `next/image` for optimized images
- ISR for `/changelog` and `/developers/docs` (revalidate 3600s)
- Code splitting via dynamic imports for heavy components

## 11. Deployment

- Vercel project: `boldmind-web`
- Build command: `pnpm turbo build --filter=@boldmindng/web...` (or specific)
- Environment groups: `production`, `preview`
```

---

## Prompt: Detailed UX Upgrade Plan for Each App

**Purpose:** Generate a detailed UX upgrade plan for each BoldmindNG frontend app, addressing specific user experience issues, with actionable improvements, wireframe suggestions, and implementation steps.

---

## Instructions for the AI (UX Upgrade Plan)

1. **For each app**, produce a UX upgrade document with the following sections:
   - **UX Audit** – List 5–10 specific user experience problems observed (from user feedback, analytics, or heuristic evaluation). Include the page/component where each occurs.
   - **User Journey Map** – Trace the typical user journey for the app’s primary persona (e.g., a founder using boldmind-web to manage subscriptions and wallet). Highlight friction points.
   - **Page-by-Page Recommendations** – For each key page (login, dashboard, wallet, settings, etc.), describe:
     - Current issues (visual, interaction, performance).
     - Proposed redesign with visual mockup descriptions (or wireframe sketches).
     - New components or interactions (e.g., sticky CTA, wizard, widget).
     - How the change addresses the friction point.
   - **Accessibility Improvements** – Check contrast ratios, keyboard navigation, screen reader support, dyslexia-friendly fonts (OpenDyslexic), Pidgin mode integration.
   - **Performance UX** – Recommendations to improve perceived performance (skeleton screens, optimistic UI, lazy loading).
   - **Mobile Experience** – Specific mobile-first improvements (touch targets, responsive layouts, bottom navigation).
   - **Implementation Plan** – Break down the upgrades into sprints/priorities (P0, P1, P2) with estimated effort and owner.

2. **Use the following source material**:
   - The app’s project tree to understand existing pages and components.
   - The master system design for business goals.
   - The UX prompts from the comprehensive document (Section 9) can be used as starting points but expand each into detailed designs.

3. **Output** one plan per app. Include visual descriptions so a designer can create mockups, and technical notes so a developer can implement.

---

## Example Outline for `boldmind-web` UX Upgrade

```markdown
# boldmind-web – Detailed UX Upgrade Plan

## 1. UX Audit

| Issue                                                     | Page                       | Impact                             |
| --------------------------------------------------------- | -------------------------- | ---------------------------------- |
| Onboarding is a single long form                          | `/onboarding`              | High drop-off, users abandon       |
| Dashboard shows raw metrics instead of actionable widgets | `/dashboard`               | Users don't know what to do next   |
| Wallet page lacks quick top‑up                            | `/dashboard/wallet`        | Users take extra steps to fund     |
| No Pidgin toggle persistence                              | Entire app                 | Users re‑set language each session |
| Notifications are a plain list, no actions                | `/dashboard/notifications` | Users ignore notifications         |
| No install prompt for PWA                                 | All pages                  | Missed opportunity for engagement  |

## 2. User Journey Map (Founder)

1. Arrives on `/` → sees ecosystem value.
2. Clicks "Get Started" → `/register` (should be wizard, not one page).
3. Completes registration → redirected to `/onboarding` (wizard).
4. Lands on `/dashboard` → wants to see active products and wallet.
5. Clicks "Wallet" → wants to top up quickly.
6. Sees notification about upcoming subscription renewal → wants to manage it inline.

**Friction points:** Registration long, onboarding tedious, wallet not easy, notifications ignored.

## 3. Page-by-Page Recommendations

### 3.1 Onboarding (`/onboarding`)

- **Current:** Single long form with 15+ fields.
- **Proposed:** Step‑by‑step wizard (3 steps):
  1. Profile (name, phone, role)
  2. Product interests (select from `BOLDMIND_PRODUCTS` grid)
  3. Preferences (Pidgin, dyslexia, exam target)
- **Mockup:** Step indicator at top, progress bar, "Next" / "Back" buttons, each step has 3–5 fields.
- **Technical:** Use `useRouter` with query params to maintain step state; save partial data to backend or localStorage.

### 3.2 Dashboard (`/dashboard`)

- **Current:** 6 metric cards (total revenue, users, etc.) with no context.
- **Proposed:** Modular widget grid:
  - "Your Top 3 Products" (from subscriptions) with quick links to each product.
  - "Wallet Balance" card with ₦ amount and "Top Up" button.
  - "Next Payment Due" (from subscription service) with pay now button.
  - "Recent Activity" feed (last 5 actions from `/hub/dashboard`).
  - "Unread Notifications" count with link to notifications page.
- **Mockup:** Grid of cards, each with a header, value, and CTA. Use `@boldmindng/ui` cards.
- **Technical:** Fetch `/hub/dashboard` and break into components; use React Query for caching.

### 3.3 Wallet (`/dashboard/wallet`)

- **Current:** Shows balance and full ledger table.
- **Proposed:**
  - Top section: Balance with tier badge, "Top Up" button with quick amounts (₦1k, ₦5k, ₦10k, custom) in a modal.
  - Middle: Mini‑ledger (last 5 transactions) with "View all" link.
  - Bottom: Full ledger paginated.
- **Mockup:** Balance card with large ₦ number, tier badge. Quick top‑up modal with amount presets and Paystack integration.
- **Technical:** Use `useWallet` hook; top‑up triggers Paystack initialize and poll for success.

### 3.4 Pidgin Toggle Persistence

- **Current:** No visible toggle in UI (only in settings?).
- **Proposed:** Add a "Pidgin" toggle in the `SuperNavbar` user dropdown (or as a standalone switch). On change, call `PATCH /users/me/profile` and update local store.
- **Mockup:** Simple switch with 🇳🇬 flag and "Pidgin" label.
- **Technical:** Sync with `UserProfile.prefersPidgin`; all content components (from AmeboGist, EduCenter, etc.) should read this flag.

### 3.5 Notifications (`/dashboard/notifications`)

- **Current:** Plain list of notifications with read/unread status.
- **Proposed:** Each notification is a card with:
  - Icon (type), title, body, timestamp.
  - Action button (e.g., "Verify Email", "Pay Invoice", "Join Session") that triggers the relevant flow.
  - "Mark as read" toggle, and "Clear all" button.
- **Mockup:** Notification cards with subtle border-left color depending on type. Action buttons are primary color.
- **Technical:** Use `/notifications` endpoint; actions are contextual (e.g., redirect to payment, open email verification).

### 3.6 PWA Install Prompt

- **Current:** No prompt; users must discover the install banner via browser.
- **Proposed:** Add `InstallPromptBanner` component (from `@boldmindng/pwa`) on key pages (home, dashboard). Use a subtle bottom banner.
- **Mockup:** Banner at bottom with "Install BoldmindNG for faster access" and "Install" / "Dismiss" buttons.
- **Technical:** Use `useInstallPrompt` hook; check if already installed.

## 4. Accessibility Improvements

- Ensure all text meets WCAG AA contrast (use tools like contrast checker).
- All interactive elements have `aria-label` where needed.
- Use OpenDyslexic font option (already in `FontProvider`).
- Keyboard navigation: tab order is logical; focus indicators visible.

## 5. Performance UX

- Use skeleton screens while fetching dashboard data (reduce perceived loading).
- Optimistic UI for toggles (Pidgin, notifications read/unread) – update UI immediately, sync in background.
- Lazy load heavy components (e.g., the full wallet ledger below the fold).

## 6. Mobile Experience

- Touch targets: all buttons ≥ 44px.
- Wallet top‑up modal uses a bottom sheet on mobile (better reach).
- Dashboard widgets stack vertically; use 2‑column grid on tablet, 1 column on mobile.
- `SuperNavbar` collapses to hamburger on mobile; menu items grouped by pillar.

## 7. Implementation Plan

| Priority | Task                         | Page(s)          | Estimated Effort | Owner                                  |
| -------- | ---------------------------- | ---------------- | ---------------- | -------------------------------------- |
| P0       | Onboarding wizard            | `/onboarding`    | 3 days           | Frontend + Backend (save progress)     |
| P0       | Wallet quick top‑up          | `/wallet`        | 2 days           | Frontend (modal, Paystack integration) |
| P0       | Pidgin toggle persistence    | All              | 1 day            | Frontend + Backend                     |
| P1       | Dashboard widgets            | `/dashboard`     | 3 days           | Frontend                               |
| P1       | Notifications with actions   | `/notifications` | 2 days           | Frontend                               |
| P2       | PWA Install banner           | Home, Dashboard  | 1 day            | Frontend                               |
| P2       | Accessibility fixes          | All              | 1 day            | Frontend                               |
| P2       | Performance skeleton screens | Dashboard        | 1 day            | Frontend                               |
```

---

## Final Output Format

- For each app, produce:
  - One **Design Document** (markdown).
  - One **UX Upgrade Plan** (markdown).
- Place them in a folder named `individual-app-docs/` with subfolders per app.
- Reference the master system design and service canonical docs where relevant.

These prompts will generate actionable, detailed documents to guide development and UX improvements across the ecosystem.
