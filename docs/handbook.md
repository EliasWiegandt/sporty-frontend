# Sporty Frontend Handbook

_Last updated: 2025-10-25_

This handbook tracks how the Sporty frontend is assembled and deployed. Pair it with the backend handbook (`../sporty-backend/docs/handbook.md`) for API and entitlement details. (`../sporty-backend/docs/handbook.md`) for API details and shared operational notes.

---

## 1. Mission

- Present Sporty’s marketing story and free adult intake experience.
- Maintain the public site at `sporty.plyml.com` (staging: `sporty-test.plyml.com`); references to “sporty” in docs mean that domain unless specified.
- Prototype the child forecast QA flow so backend forecasting can be exercised end-to-end.
- Keep navigation, typography, and layout consistent across all pages. The primary navbar now uses the Sporty wordmark with the Iconify laurel wreath (`i-mingcute-laurel-wreath-fill`)—adjust `BaseLayout` if the brand lockup changes. Brand teal tokens live in `src/styles/brand.css` as `--brand-*` and feed UnoCSS shortcuts. The default header CTA copy (“Try free analysis”) comes from `defaultPrimaryAction` in `BaseLayout`.
- Proxy `/api/recommend-adult-free` and `/api/forecast-child` through the Cloudflare runtime so browsers never see backend secrets.
- Free adult match now requires the full measurement set (birthday, sex, height, weight, arm span, leg inseam, shoulder width, hip width, hand length, foot length) and renders slider + number pairs for each. Premium-only inputs (preferences, goals, injuries) remain locked behind credits until a paid analysis is available.
- When an authenticated user has credits, the intake toggles “Apply credit” to run `/api/recommend-adult-premium`; the premium journey redirects to `/results/premium` with component breakdowns pulled from the backend.
- Child analysis now requires a child credit up front; guardians collect measurements, apply the credit, and receive both the forecast and premium sport matches in the same flow (`/child-intake` → `/child-results/premium`).
- The free results page now mirrors the journey vision with a component impact bar, three-up match grid, and highlight strip; interactive adjustment controls are deferred until preview endpoints exist.
- Child intake primes the deterministic test family (prefilled on preview branches) and collects measurements; once a child credit is applied we post to `/api/forecast-child`, capture the forecast, and let `/child-premium` gather premium inputs before `/child-results/premium` renders the paid package.
- Logged-in intakes also capture past sports (searchable `sports_subcategories`, intensity, enjoyment/flair/skill flags) and sync them to Supabase before saving recommendations.
- Logged-in free users can run and store unlimited analyses once they grant consent; anonymous runs still capture past-sport signals anonymously to fuel the data moat.
- The dashboard views stored recommendations (free + premium) alongside updated credit balances so users and guardians can revisit previous analyses.
- Premium flows will add performance factor inputs (muscle gain ease, endurance bias, recovery speed) and surface derived indexes (Monkey Index, discipline ratios) in the results dashboard.
- Surface Supabase-powered auth/consent flows without persisting any sensitive keys client-side.
- Honour explicit consent before storing measurements, preferences/goals, injuries, or child data; provide preview mode if consent is declined.
- _Current UX scope: design the MVP as a desktop web-first experience; responsive/mobile treatments will follow in subsequent iterations._

---

## 2. Architecture Overview

| Layer                             | Responsibilities                                                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astro**                         | Pages live in `src/pages`. Shared chrome (nav, footer, fonts, laurel-mark wordmark) lives in `src/layouts/BaseLayout.astro`. `src/styles/global.css` imports Open Props, `uno.config.ts` wires UnoCSS utilities + Iconify presets, and `src/styles/brand.css` / `webcore.scss` handle optional overrides + Webcore setup. |
| **Astro API routes**              | `src/pages/config.js.ts` publishes runtime Supabase config; `src/pages/api/recommend-adult-free.ts` proxies the backend `/v1/recommend-adult-free`; `src/pages/api/recommend-adult-premium.ts` proxies `/v1/recommend-adult-premium`; `src/pages/api/forecast-child.ts` proxies `/v1/forecast-child`; `src/pages/api/credits.ts` proxies `/v1/credits`; `src/pages/api/create-checkout-session.ts` starts Stripe Checkout; `src/pages/api/healthz.ts` exposes a health endpoint. |
| **Public assets**                 | Vanilla JS (`public/assets/js/*.js`) handles Supabase auth, form submission, and DOM updates. `intake.js` manages the adult free + premium forms and the past-sport repeater, `child-intake.js` collects measurements and shepherds guardians into the credit flow, `child-premium.js` finalizes the paid submission after the credit is applied, `child-results.js` renders stored runs, `child-results-premium.js` renders the paid matches, `dashboard.js` hydrates credit balances + saved runs, `checkout.js` triggers Stripe Checkout with child-profile selection, and `checkout-success.js` refreshes balances after payment. Images and other static assets also live under `public/`. |
| **Cloudflare Worker (generated)** | `astro build` (Cloudflare adapter) emits `dist/_worker.js/index.js`, wiring runtime env, asset serving, and the proxy routes above.                                                                                                          |
| **Backend**                       | FastAPI service (`/v1/recommend-adult-free`) behind the Worker; see backend repo for implementation details.                                                                                                                                    |

`npm run build` produces a server bundle (`dist/_worker.js/**`) plus static assets (`dist/`), ready for `wrangler dev`/`wrangler deploy`.

Primary desktop MVP routes (marketing + app shell):

- `/` — marketing home
- `/about`, `/pricing`, `/terms` — supporting marketing content
- `/intake`, `/results`, `/results/premium` — adult quick match and premium placeholders
- `/dashboard` — logged-in history/credits shell
- `/account` — consent and data privacy controls
- `/child-intake`, `/child-results` — guardian flow
- `/checkout/success`, `/checkout/cancel` — Stripe return pages (credit refresh + cancel fallback)

---

## 3. Design System & Tokens

- [Open Props](https://open-props.style/) is the canonical design system. `src/styles/global.css` imports the core, normalize, buttons, forms, and animations bundles so colors, spacing, shadows, easing, and keyframes are available via variables like `--gray-7`, `--size-4`, `--shadow-4`, `--ease-2`, and `--animation-fade-in`. Use these props directly; `src/styles/brand.css` remains a placeholder for future overrides if we need bespoke branding.
- UnoCSS lives in `uno.config.ts`. Lean on its presets (`preset-wind`, typography, `preset-icons`) and shortcuts (`btn-primary`, `btn-ghost`, `container-page`, `i-<icon>`) instead of adding new global utility classes.
- Use Open Props animation keyframes/easing (e.g., `--animation-fade-in`, `--ease-2`) via Uno shortcuts or inline styles; avoid pulling in extra animation libraries unless we outgrow these primitives.
- Webcore UI (`webcoreui` + `src/styles/webcore.scss`) provides accessible component primitives. Override its CSS variables in `brand.css` when aligning to Sporty’s palette.
- `BaseLayout` ensures shared fonts, nav layout, and auth controls render identically on every page. Only pass page-specific variations (e.g., nav links, primary CTA) via props.
- For page-specific tweaks, scope styles via inline `<style>` blocks in the `.astro` file so global CSS stays lean.
- Reuse utility classes (`.section`, `.grid-cards`, `.card`, `.button`) whenever possible to avoid divergence.
- Global CSS sets all `<img>` elements to span the full width of their container. When you need tighter art (e.g., match-card thumbnails), override width/height with explicit values and `!important` or inline styles; otherwise the default rule will stretch the asset.
- **Uno shortcuts policy**: Treat layout-focused shortcuts in `uno.config.ts` as constraints, not conveniences. Before reusing them, inspect the underlying grid and max-width settings; avoid combining them with Webcore `Flex`/`Grid` components unless you have verified the generated class list. When a section needs bespoke sizing (e.g., the landing hero), prefer a dedicated stylesheet (see `src/styles/hero.css`) so we can reason about width/height limits in one place.
- **Landing hero pattern**:
  - Layout: `hero-shell` combines `section-shell` with a desktop split of roughly 40% copy / 60% visual (see `src/styles/global.css` media queries). Keep the flex breakpoints intact so mobile stacks vertically and large screens maintain the wider illustration.
  - Badge: use the `hero-badge` shortcut (white background, teal border/text) to surface the primary product promise above the headline; never use Webcore badge themes here.
  - Copy: two paragraphs max—first sentence states the biomechanics promise, second can bridge to guardian use cases. Headline always uses the shared `hero-headline` shortcut.
  - CTA: render a single primary action with the `cta-primary` shortcut (alias for `btn-primary nav-button`) and anchor it with the `hero-cta` helper so it aligns with the text column. Avoid multiple hero CTAs unless marketing requests otherwise.
  - Visual: hero art must preserve the 16:9 aspect ratio (`hero-visual img`), rely on Supabase-hosted assets keyed via `data-image-key`, and stay within the clamped min/max widths.

### Visual Asset Policy
- **Illustrations (generative)**: Use the Sporty illustration pipeline for all human/sport scenes (landing hero, measurement helpers, sport spotlight art, guardian imagery). Maintain the shared backlog outlined in this handbook’s Visitor Journeys section and store assets in Supabase Storage with descriptive alt text.
- **Data visualizations (engineered)**: Implement charts/tables with code so they stay dynamic, accessible, and themable (component impact bars, radar charts, growth curves, etc.). Provide textual summaries or data tables alongside each visualization.
- **Separation**: never embed analytic data in static images; reserve illustrations for brand storytelling and instructional content.

### Consent UX Policy
- Every intake page must state whether data will be stored; anonymous runs default to “preview only”.
- When a user attempts to save data without existing consent, trigger a modal listing each data class (measurements, preferences/goals, injuries, child data) with purpose explanations and opt-in toggles.
- Provide a “Preview without saving” option so users can decline while still seeing results.
- Surface a persistent consent status indicator (e.g., banner or profile badge) linking to the consent management view where users can revoke or amend choices.
- Log consent actions via the Supabase backend; frontend should include policy version in payloads to support GDPR/CCPA compliance.

---

## 4. Data Visualization & Islands

- Use two libraries for charts:
  - **Observable Plot** (ESM) for comparative SVG visuals (stacked/impact bars, radar charts, contribution matrices, growth curves). Pair each chart with a `<table>` fallback for accessibility.
  - **Chart.js** for gauges, donuts, and other canvas-based widgets that benefit from gradients or animation-ready defaults.
- Mount chart components with Astro’s `client:only` hydration. Reach for the `@astrojs/preact` adapter when stateful interactivity is required; otherwise keep islands vanilla.
- Keep chart utilities under `src/components/charts/` for reuse across adult and child journeys.
- Default to existing CSS transitions; defer dedicated animation libraries until post-MVP.

---

## 5. Local Development Workflow

1. `npm install`
2. `npm run dev` to work in Astro’s dev server (`http://localhost:4321`). Fastest loop for layout/content.
3. To test end-to-end with the generated Worker proxy:
  ```bash
  npm run build           # emit dist/_worker.js and assets (or run `make run-frontend`)
  wrangler dev            # `make run-frontend` first wipes dist/, rebuilds, then runs wrangler dev
  ```
   Provide the same env vars as production (API key, Supabase URLs, Stripe publishable key) via `.dev.vars` or Wrangler CLI flags.
4. QA the child flow by visiting `/child-intake` after seeding the test family (`make seed-test-family` in the backend repo). Preview/test branches auto-prefill the form for faster checks.
5. Screenshot helper: `make snap` still hits `http://127.0.0.1:8787` expecting `wrangler dev` to be running.

---

## 6. Environment & Secrets

- **GitHub environments (test / production)**  
  - _Secrets_: `RENDER_API_KEY` (attached by the Worker when proxying to the backend).  
  - _Variables_: `RENDER_URL`, `SUPABASE_URL`, `SUPABASE_STORAGE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `STRIPE_PUBLIC_KEY`. GitHub Actions inject these into the Cloudflare Worker build via `wrangler-action`, letting runtime code reach Render, Supabase, and Stripe Checkout (publishable key only: `pk_test…` in the current environment).
- **Local development**  
  - Mirror these values in `.dev.vars` (consumed by `wrangler dev`) or set them with `wrangler secret put`. Never commit local env files.
- Keep Supabase service-role keys and Stripe secret keys out of this repo. Only publishable keys live in GitHub; private credentials remain in the backend `.env` files or the Render environment.

`/config.js` is generated on each request and exposes the publishable Supabase configuration, storage bucket, and Stripe public key to browser scripts. Always read the values from `window.SPORTY_CONFIG` rather than hard-coding them.

---

## 7. Deployment & Operations

- Workflow: `.github/workflows/deploy.yml` runs `npm ci` → `npm run build` → `wrangler deploy` for `test` and `main` branches.
- `wrangler.toml` points `main` to `dist/_worker.js/index.js` and serves static assets from `dist/` via the `ASSETS` binding.
- Keep `package-lock.json` committed so CI builds remain reproducible.
- Before merging UI changes, run `npm run build` to catch compile issues and confirm the generated Worker succeeds.

---

## 8. Backlog (Frontend Focus)

1. Add automated visual regression checks to catch layout drift when design tokens change.
2. Split Supabase auth/UI helpers into ES modules for easier test coverage.
3. Introduce content collections for FAQs and policy pages so marketing edits require less HTML wrangling.
4. Evaluate adding `astro:transitions` or partial hydration for future interactive dashboards once paid flows ship.
5. Integrate authenticated storage of child forecasts once backend exposes guardian-scoped history APIs (replace sessionStorage stopgap).
6. Coordinate with backend when Stripe + credits launch to surface purchase states in the UI.


## Visitor Journeys (Desktop MVP)

This document defines the **high-level navigation and user flows** for the Sporty MVP (desktop-only).  
It focuses on how users move through the website to complete their core use cases — not on individual component design.

> **Environment**: Production lives on `sporty.plyml.com` and staging on `sporty-test.plyml.com`. References to “the site” below point to those domains.

---

## Consent Strategy (Unified Across Journeys)

To minimize friction, Sporty collects consent only at **two key moments**:

1. **Account Creation / Sign-Up**

   - Users grant general consent for measurement storage, analytics, and improvement.
   - Includes acknowledgment of data policy and rights.
   - Covers all standard body measurements and past sport history.

2. **First Paid Analysis (Adult or Child)**
   - Users grant explicit consent for storing and processing _sensitive data_ (injuries, health-related info, child data).
   - This single consent applies to all subsequent paid analyses unless revoked in the profile.

All other interactions — such as free, anonymous analyses — are purely transient (data processed but not stored).

Users can manage or revoke consent anytime in **Account → Data & Privacy**.

---

## Top-Level Site Structure

| Section            | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| **Home**           | Marketing overview, free entry point to analysis.                |
| **About**          | Explains Sporty’s AI approach and data ethics.                   |
| **Pricing**        | Explains free vs paid analyses and credit system.                |
| **Dashboard**      | Logged-in home for saved results, credits, and analysis history. |
| **Intake**         | Form flow for measurements, past sports, and premium inputs.     |
| **Results**        | Displays analysis outcomes, fit scores, and explanations.        |
| **Child Forecast** | Guardian-only flow for forecasting child sports suitability.     |
| **Account**        | Profile management, consent settings, and credit history.        |

Top navigation (desktop):

```

Sporty    |    About    |    Pricing    |    Dashboard/Login

```

Contextual CTAs may lead directly into `/intake` or `/child`.

---

## 1. Free Adult Journey (Anonymous or Logged-In)

### Goal

Discover which sports match your body without paying or storing data.

### Entry Points

- “See my match” CTA on Home.
- Marketing CTA banners or footer prompts.

### Flow

1. **Home ➝ Intake (Free Mode)**

   - User enters body measurements.
   - Optionally adds past sports (anonymous if not logged in).
   - If logged in, results can be saved automatically.

2. **Submit ➝ Results Page (Quick Match)**

   - Displays top 3 sport matches with visual fit indicators and summaries.
   - “Save this run” prompts login if anonymous.

3. **Optional Next Steps**
   - “Upgrade for detailed analysis” leads to Pricing.
   - Logged-in users can revisit results from Dashboard.

### Key Pages Involved

- `/` (Home)
- `/intake`
- `/results`
- `/login` (if saving)

### Consent

- No consent needed for anonymous use.
- Logged-in users are already covered by sign-up consent.

---

## 2. Paid Adult Journey (Detailed Analysis)

### Goal

Get a deeper, personalized analysis including goals, preferences, injuries, and performance factors.

### Entry Points

- “Upgrade for detailed analysis” button on Results page.
- “Start new analysis” from Dashboard (requires credits).
- Direct purchase or Pricing page.

### Flow

1. **Dashboard ➝ Start New Analysis ➝ Intake (Premium)**

   - Prefilled measurements from last run.
   - User adds preferences, goals, injuries, and performance factors.
   - Sidebar or top banner shows available credits.

2. **Submit ➝ Results (Premium Analysis)**

   - Results page includes charts, breakdowns, and insights (body, goals, preferences, injuries).
   - User can compare with previous runs via History.

3. **Optional Next Steps**
   - “Start another analysis”
   - “View history”
   - “Share insights” (lightweight link copy only)

### Key Pages Involved

- `/dashboard`
- `/intake?premium=true`
- `/results/premium`
- `/pricing`

### Consent

- Triggered once at first paid analysis, covering future detailed runs.

---

## 3. Guardian Journey (Child Analysis Package)

### Goal

Purchase a $5 child credit to forecast a child’s body trajectory and unlock sport matches with guardian consent.

### Entry Points

- “Start child analysis” CTA on Home.
- “Forecast new child” from Guardian Dashboard.

### Flow

1. **Guardian Dashboard ➝ Start Child Analysis**

   - Choose or create a child profile.
   - Confirm guardian consent and apply a child credit (required before continuing).
   - Input child measurements and, optionally, parent measurements in the same flow.

2. **Submit ➝ Results (Child Analysis)**

   - The paid run returns the forecasted adult body profile, percentile context, and contribution breakdowns.
   - The same response includes premium sport matches blending preferences, goals, injuries, and past sports captured during intake.

3. **Follow-Up**
   - Dashboard updated with the next recommended re-measure date and recent child analyses.
   - Notification prompt for future forecast windows.

### Key Pages Involved

- `/guardian` (dashboard)
- `/child-intake`
- `/child-results`
- `/child-premium`

### Consent

- Collected once at the first child analysis purchase, tied to guardian account.
- Co-guardians can later approve or revoke jointly in Account settings.

---

## Shared Navigation Principles

- **Desktop-first**: fixed top navigation bar, secondary side navigation in Dashboard and Intake flows.
- **Persistent CTAs**:
  - “See my match” (free flow)
  - “Start new analysis” (premium)
  - “Start child analysis” (guardian)
- **History access**: via Dashboard with sortable cards.
- **Measurement Locker**: available in Dashboard sidebar for quick reuse of past data.
- **Privacy & Consent Management**: under Account → Data & Privacy.

---

## Page Map (Summary)

| Page               | Purpose                              | Accessible To           |
| ------------------ | ------------------------------------ | ----------------------- |
| `/`                | Marketing homepage, free entry point | All                     |
| `/about`           | Mission & AI explanation             | All                     |
| `/pricing`         | Explains tiers & credits             | All                     |
| `/intake`          | Free or premium data input           | Logged-out or logged-in |
| `/results`         | Free results                         | All                     |
| `/results/premium` | Paid detailed analysis               | Logged-in               |
| `/dashboard`       | Saved runs, credits, history         | Logged-in               |
| `/child-intake`    | Child analysis intake + credit gate  | Guardians               |
| `/child-results/premium` | Paid child analysis results     | Guardians (with credit) |
| `/account`         | Profile, consent, data rights        | Logged-in               |

---

## Summary

This document defines how users navigate through Sporty’s desktop MVP:

- **Free adults** can quickly discover suitable sports.
- **Paying adults** gain detailed, data-rich insights.
- **Guardians** purchase a child credit to forecast body trajectories and receive premium sport matches in one paid package.
- **Consent** is streamlined: once at signup, and once at the first paid adult or child analysis.

This hierarchy provides a clear framework for the frontend scaffold, ensuring all key routes, flows, and CTAs are aligned with Sporty’s product vision.


---

## 9. References

- Backend repo: `../sporty-backend`
- Worker deploy workflow: `.github/workflows/deploy.yml`
- Shared image catalog: `docs/images/catalog.yaml`
- Design system baseline: Open Props via `src/styles/global.css`
- Optional brand overrides: `src/styles/brand.css`
- Supabase auth helpers: `public/assets/js/app.js`

Update this handbook whenever we change page structure, deployment steps, or environment expectations.
