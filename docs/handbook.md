# Sporty Frontend Handbook

_Last updated: 2025-11-19_

This handbook tracks how the Sporty frontend is assembled and deployed. Pair it with the backend handbook (`../sporty-backend/docs/handbook.md`) for API and entitlement details. (`../sporty-backend/docs/handbook.md`) for API details and shared operational notes.

---

## 1. Mission

- Present Sporty’s marketing story and free adult intake experience.
- Maintain the public site at `sporty.plyml.com` (staging: `sporty-test.plyml.com`); references to “sporty” in docs mean that domain unless specified.
- Prototype the child forecast QA flow so backend forecasting can be exercised end-to-end.
- Keep navigation, typography, and layout consistent across all pages. The primary navbar now uses the Sporty wordmark with the Iconify laurel wreath (`<iconify-icon icon="mingcute:laurel-wreath-fill">`)—adjust `BaseLayout` if the brand lockup changes. Brand teal tokens live in the Tailwind theme (`src/styles/tailwind.css`) and feed the shared component layer. The default header CTA copy (“Try free analysis”) comes from `defaultPrimaryAction` in `BaseLayout`.
- Proxy `/api/recommend-adult-free` and `/api/forecast-child` through the Cloudflare runtime so browsers never see backend secrets.
- Free adult match now requires the full measurement set (birthday, sex, height, weight, arm span, leg inseam, shoulder width, pelvic bone width, torso length, hand length, foot length, ankle circumference, wrist circumference) and renders numeric inputs with +/- controls, contextual tooltips, and autosave across steps. Premium-only inputs (preferences, goals, injuries) remain locked behind credits until a paid analysis is available.
- When an authenticated user has credits, the intake toggles “Apply credit” to run `/api/recommend-adult-premium`; the premium journey redirects to `/results/premium` with component breakdowns pulled from the backend.
- Adult intake now exposes two routes (`/intake` and `/intake-premium`) that both hydrate the Preact island at `src/components/intake/IntakeApp.tsx`; the free page keeps traits locked behind the premium controller, while the premium page flips the `mode` prop so the traits/goals/injuries steps appear and the credit-backed submission posts to `/api/recommend-adult-premium`.
- The payload sent to `/api/recommend-adult-premium` now includes the trait answers collected in the Traits step (`muscle_fiber`, `metabolic_tendency`, `joint_laxity`, `foot_arch`, `temperature_tolerance`, `handedness`, `sport_side`) so the matching service can incorporate those signals into premium scoring.
- Child analysis now requires a child credit up front; guardians collect measurements, apply the credit, and receive both the forecast and premium sport matches in the same flow (`/child-intake` → `/child-results/premium`).
- The free results page now mirrors the journey vision with a component impact bar, five match cards, measurement comparison tables (with fit bars), and highlight reasoning drawn from each measurement so the narrative stays grounded in the research. Interactive adjustment controls remain deferred until preview endpoints exist.
- Child intake primes the deterministic test family (prefilled on preview branches) and collects measurements; once a child credit is applied we post to `/api/forecast-child`, capture the forecast, and let `/child-premium` gather premium inputs before `/child-results/premium` renders the paid package.
- Logged-in intakes also capture past sports (searchable `sports_subcategories`, using the long-form subcategory `name` such as "Soccer - Forward - Winger", plus intensity and enjoyment/flair/skill flags) and sync them to Supabase before saving recommendations.
- Logged-in free users can run and store unlimited analyses once they grant consent; anonymous runs still capture past-sport signals anonymously to fuel the data moat.
- The dashboard views stored recommendations (free + premium) alongside updated credit balances so users and guardians can revisit previous analyses.
- Premium flows will add performance factor inputs (muscle gain ease, endurance bias, recovery speed) and surface derived indexes (Monkey Index, discipline ratios) in the results dashboard. The premium results screen reuses the same color palette as the free impact bar and now shows the same component terminology (body alignment, past sports, preferences, goals, injury considerations) alongside the new measurement + factor breakdown cards for each match so the two experiences feel aligned.
- Surface Supabase-powered auth/consent flows without persisting any sensitive keys client-side.
- Honour explicit consent before storing measurements, preferences/goals, injuries, or child data; provide preview mode if consent is declined.
- _Current UX scope: design the MVP as a desktop web-first experience; responsive/mobile treatments will follow in subsequent iterations._

---

## 2. Architecture Overview

| Layer                             | Responsibilities                                                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astro**                         | Pages live in `src/pages`. Shared chrome (nav, footer, fonts, laurel-mark wordmark) lives in `src/layouts/BaseLayout.astro`. `src/styles/tailwind.css` defines Sporty’s Tailwind tokens/components and exports the shared design preset. |
| **Astro API routes**              | `src/pages/config.js.ts` publishes runtime Supabase config; `src/pages/api/recommend-adult-free.ts` proxies the backend `/v1/recommend-adult-free`; `src/pages/api/recommend-adult-premium.ts` proxies `/v1/recommend-adult-premium`; `src/pages/api/forecast-child.ts` proxies `/v1/forecast-child`; `src/pages/api/credits.ts` proxies `/v1/credits`; `src/pages/api/create-checkout-session.ts` starts Stripe Checkout; `src/pages/api/healthz.ts` exposes a health endpoint. |
| **Public assets**                 | Vanilla JS (`public/assets/js/*.js`) handles Supabase auth, child flows, and dashboard updates. The adult intake is now powered by the Preact island `src/components/intake/IntakeApp.tsx` plus its premium and past-sports controller modules; both `/intake` and `/intake-premium` hydrate that island, with the premium route toggling the extra steps and credit logic. `child-intake.js`, `child-premium.js`, `child-results.js`, `child-results-premium.js`, `dashboard.js`, `checkout.js`, and `checkout-success.js` still drive their respective flows. Images and other static assets also live under `public/`. |
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

## Intake Experience

Both `/intake` and `/intake-premium` hydrate the same Preact island (`src/components/intake/IntakeApp.tsx`), so the form logic, validation, and submission helpers live in one place. The island renders the shared stepper, keeps all intake state in React (basics, measurements, past sports, premium selections), and wires the `Continue`/`See my matches` buttons so the UI always scrolls and focuses the field that needs attention before moving forward.

### Stepper layout & measurement fields

- The free flow walks through three steps: **Basics** (birthday and sex), **Measurements** (the twelve body/limb metrics defined in `src/data/measurementFields.ts` and grouped into core, torso, and extremities clusters), and **Past sports** (optional experience history). Each measurement field renders via `MeasurementField`, which uses the shared `NumberStepper` (+/– controls), enforces the documented min/max ranges, shows the helper hints, and keeps values synced with the island state so the stepper can validate before unlocking the next page.
- Validation happens before allowing a step change; missing or out-of-bounds inputs trigger `setStatus` errors, focus the offending field, and prevent navigation until the value meets the requirements.

### Past sports

- Users can capture up to five past sports entries. The Past Sports step asynchronously queries Supabase’s `sports_subcategories` (via `SportyApp.getClient()`) to power the search-as-you-type dropdown, labels each entry with the associated sport, and lets people record intensity (`light`, `moderate`, `intense`, `elite`), years played, starting age, and the yes/no flag trio (enjoyed it, felt natural/flair, achieved skill). NumberStepper controls allow fractional years so the backend keeps the decimals that power matching.
- Entries stay in component state for quick edits and are cleaned (strip out the UI-only `id` and empty fields) before the payload sends them as `past_sports`, matching the shape declared in `src/data/intakeSchema.ts`.

### Premium inputs & gating

- Navigating to `/intake-premium` adds **Traits**, **Preferences**, **Goals**, and **Injuries** steps before the past-sports section, while `/intake` keeps those controls hidden. The Traits step asks the categorical questions (`muscle_fiber`, `metabolic_tendency`, `joint_laxity`, `foot_arch`, `temperature_tolerance`, `handedness`, `sport_side`) that `buildPremiumPayload` maps into the backend’s `traits` object.
- The shared `PremiumBlock` and `premiumController` gate the detailed inputs behind credentials. They fetch `/api/credits` to confirm the user has adult analysis credits, query Supabase catalogs (`preferences_catalog`, `goals_catalog`, `injuries_catalog`, and `injury_subcategories_catalog`), and only show the toggle/fields after the data and a positive credit count are available.
- Preferences/goals entries are capped at 20 each, enforce unique catalog selections, and ask for a priority (`must_have`/`nice_to_have`); injuries also cap at 20 entries, collect severity, subcategory, and notes, and block duplicate injury-or-subcategory combos. The “Apply one adult analysis credit” toggle must be on before a premium submission will run, and the controller resets/locks the block whenever the credit count drops to zero or the user signs out.
- The premium summary copy keeps the user informed (credit totals, consent state, whether a credit will apply) and surfaces controller errors through `setStatus` so the form never posts a partial premium selection.

### Persistence & submission

- `IntakeApp` auto-saves drafts to `localStorage` under `sporty:intake:draft:v1` whenever basics, measurements, or past sports change. On load it rehydrates that data (including the last step index and any legacy trait answers) so returning visitors resume where they left off. In dev mode the island prefills a dummy run if the cache is empty to speed up design reviews.
- Submission combines the validated basics, cleaned measurements, past sports, trait answers (collected directly from the DOM), and premium selections into payloads built by `buildFreePayload` or `buildPremiumPayload`. Free runs post to `/api/recommend-adult-free`, premium runs to `/api/recommend-adult-premium`, and the buttons switch to “Generating…” while the request is in flight.
- Before sending premium data the island asks `window.SportyApp.ensureConsent()` to confirm the user has granted storage consent; the result is cached on the premium controller so the summary copy knows whether detailed inputs are allowed. Success responses are cached in `sessionStorage` (`sporty:lastResult`, `sporty:lastPremiumResult`, and `sporty:lastCreditSnapshot`) so the results screens can show previews while the backend work is finishing.

---

## 3. Design System & Tokens

- Typography: use the shared `type-*` utilities in `src/styles/tailwind.css` (display, title, lead, body, small). Buttons, nav, badges, and hero copy all rely on them—don’t hardcode font sizes in components.
- Layout shells: `section-shell`, `card-shell`, and `btn-pill` are the canonical wrappers for section padding, cards, and CTAs. Reuse/extend them instead of adding page-specific styling.
- Landing page sections (hero, pillars, how it works) now compose shared utilities only. Keep future sections consistent with that approach.
- Tailwind’s design tokens and component layer live in `src/styles/tailwind.css`. This file defines palette variables, spacing, shadows, typography tokens (`type-display`, `type-title`, `type-lead`, `type-body`, `type-small`, `type-nav-brand`, `type-nav`), and reusable shells (`btn-pill`, `section-shell`, `card-shell`, etc.). Extend it when you need new primitives so downstream presets stay in sync.
- Avoid reintroducing standalone CSS files; when page-specific tweaks are required, scope them in-place or add a dedicated Tailwind component entry.
- Built-in keyframes and easing live alongside the component layer—reuse those tokens before adding new animation libraries.
- Preline provides optional interactive primitives (modals, accordions). `BaseLayout` ships an inline module that imports Preline once and runs `window.HSStaticMethods.autoInit()` after every load (`DOMContentLoaded`, `astro:page-load`, `astro:after-swap`). Drop the documented `data-hs-*` attributes into markup—no per-page bootstrapping required.
- `BaseLayout` ensures shared fonts, nav layout, and auth controls render identically on every page. Only pass page-specific variations (e.g., nav links, primary CTA) via props.
- **Avoid `<style>` blocks**: Do not use inline `<style>` blocks in `.astro` files for component styling. They increase specificity unpredictably and can override Tailwind classes. Centralize all component styles (like `.match-card`) in `src/styles/tailwind.css`.
- Reuse utility classes (`.section`, `.grid-cards`, `.card`, `.button`) whenever possible to avoid divergence.
- **Images & Aspect Ratios**: To force a fixed aspect ratio (e.g., 1:1) that resists global resets:
  1. Wrapper: `width: 100%; aspect-ratio: 1/1; overflow: hidden;`
  2. Image: `display: block; width: 100%; height: 100% !important; object-fit: cover;`
- **Tailwind component policy**: Treat the layout helpers in `src/styles/tailwind.css` as constraints, not conveniences. Before reusing one, inspect the underlying grid and max-width settings. When a section needs bespoke sizing (e.g., the landing hero), add a purpose-built component entry in `tailwind.css` so we can reason about width/height limits in one place.
- **Tailwind preset**: `tailwind.sporty-preset.mjs` mirrors the design tokens exported from `src/styles/tailwind.css`. Import it in other projects via Tailwind’s `presets` array to stay aligned with Sporty spacing, colors, and shadows.
- **Landing hero pattern**
  - Layout: use `section-shell` plus responsive Tailwind utilities (grid/flex) for the hero; there’s no bespoke CSS layer anymore, so adjust layout via utilities only.
  - Badge: use the `hero-badge` shortcut (white background, teal border/text) to surface the primary product promise above the headline.
  - Copy: two paragraphs max—first sentence states the biomechanics promise, second can bridge to guardian use cases. Headline always uses the shared `hero-headline` shortcut.
  - CTA: render a single primary action with the `btn-pill btn-pill-primary` shortcut set and anchor it with the `hero-cta` helper so it aligns with the text column. Avoid multiple hero CTAs unless marketing requests otherwise.
  - Visual: hero art must preserve the 16:9 aspect ratio (`hero-visual img`), rely on Supabase-hosted assets keyed via `data-image-key`, and stay within the clamped min/max widths.
- **Process steps module**
  - Use simple grid/flex utilities for process/how-it-works lists; the old `.process__*` helpers were removed.
  - Keep the section left-aligned via `.process-section`; the container width (≈540px) leaves room for complementary content on wider screens.
  - Pair each step with optional 1:1 Supabase imagery by setting `imageKey`/`imageAlt` in the `howSteps` array; assets live under `frontend_images/landing/`.
- **Science content**
  - The landing science block reads from `scienceSection` and `scienceHighlights` in `src/data/landingContent.ts`. Each highlight icon/CTA must stay in sync with the headings on `/science`.
  - The `/science` page is authored directly in `src/pages/science.astro` (no Markdown import). Keep copy updates there and structure citations with the `.science-item-refs` helper so each source renders on its own line.
  - Do not reintroduce the retired `#why` landing section; the science block now carries that narrative.

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

## Results Storage Note (Session Storage)

- `/results` reads the most recent free analysis from `sessionStorage["sporty:lastResult"]`.
- `/results/premium` reads the most recent premium analysis from `sessionStorage["sporty:lastPremiumResult"]`.
- `sessionStorage` is scoped to the page origin (scheme + host + port). If you submit intake on one origin (e.g. `http://localhost:4321`) but view results on another (e.g. `http://127.0.0.1:8787`), the results pages will appear empty because the stored payload is not shared across origins.

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

  - The `/intake` page mounts `IntakeApp`, a three-step Preact island that collects Basics, Measurements (the twelve metrics defined in `src/data/measurementFields.ts`), and Past Sports, validates each input, and auto-saves drafts to `localStorage` so visitors can pick up where they left off.
  - Past sports entries are optional (up to five) and source their labels from Supabase’s `sports_subcategories`; they capture years played, starting age, intensity, and the liked/flair/skill flags that feed the matching backend even for anonymous runs.
  - Logged-in users keep their drafts in sync with session storage so saved runs appear automatically when they revisit.

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

  - The premium intake reuses `IntakeApp`, adds the Traits step plus the Preference/Goal/Injury sections, and keeps the credit-aware `PremiumBlock` visible only when the user has adult credits and consents to storing detailed inputs.
  - Premium lists cap at 20 selections, forbid duplicate catalog IDs, collect priority/severity/notes, and require the “Apply one adult analysis credit” toggle before `/api/recommend-adult-premium` is allowed to post.
  - The premium block summary echoes the current credit total and consent state while the sidebar/top banner still surfaces the same totals for launch day marketing; failing to apply a credit shows an inline error and keeps the premium submission locked.

2. **Submit ➝ Results (Premium Analysis)**

   - Results page includes charts, breakdowns, and insights (body, goals, preferences, injuries).
   - User can compare with previous runs via History.

3. **Optional Next Steps**
   - “Start another analysis”
   - “View history”
   - “Share insights” (lightweight link copy only)

### Key Pages Involved

- `/dashboard`
- `/intake-premium`
- `/results/premium`
- `/pricing`

### Consent

- Triggered once at first paid analysis, covering future detailed runs.

---

## 3. Guardian Journey (Child Analysis Package)

### Goal

Purchase a $1 child credit to forecast a child’s body trajectory and unlock sport matches with guardian consent.

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
   - The backend now routes these premium child inputs through the shared `app/matching.match_child_premium` helper so the component impact cards, match narratives, and alignment panels match the adult premium experience.

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
| `/pricing`         | Explains tiers & $5 credits          | All                     |
| `/science`         | Research summary & references        | All                     |
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
- Design system baseline: Tailwind component layer (`src/styles/tailwind.css`)
- Supabase auth helpers: `public/assets/js/app.js`

Update this handbook whenever we change page structure, deployment steps, or environment expectations.
