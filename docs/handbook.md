# Sporty Frontend Handbook

_Last updated: 2025-10-24_

This handbook tracks how the Sporty frontend is assembled and deployed. Pair it with the backend handbook (`../sporty-backend/docs/handbook.md`) for API details and shared operational notes.

---

## 1. Mission

- Present Sporty’s marketing story and free adult intake experience.
- Maintain the public site at `sporty.plyml.com` (staging: `sporty-test.plyml.com`); references to “sporty” in docs mean that domain unless specified.
- Prototype the child forecast QA flow so backend forecasting can be exercised end-to-end.
- Keep navigation, typography, and layout consistent across all pages. The primary navbar now uses the Sporty wordmark with the Iconify laurel wreath (`i-mingcute-laurel-wreath-fill`)—adjust `BaseLayout` if the brand lockup changes. Brand teal tokens live in `src/styles/brand.css` as `--brand-*` and feed UnoCSS shortcuts. The default header CTA copy (“Try free analysis”) comes from `defaultPrimaryAction` in `BaseLayout`.
- Proxy `/api/recommend-adult-free` and `/api/forecast-child` through the Cloudflare runtime so browsers never see backend secrets.
- Free adult match now requires the full measurement set (birthday, sex, height, weight, arm span, leg inseam, shoulder width, hip width, hand length, foot length) and renders slider + number pairs for each. Premium-only inputs (preferences, goals, injuries) remain locked behind credits until a paid analysis is available.
- When an authenticated user has credits, the intake toggles “Apply credit” to run `/api/recommend-adult-premium`; the premium journey redirects to `/results/premium` with component breakdowns pulled from the backend.
- Child forecasts now focus on measurements only; guardians who want sport matches click through to `/child-premium`, apply a child credit, and add preferences/goals/injuries/past sports before reviewing matches in `/child-results/premium`.
- The free results page now mirrors the journey vision with a component impact bar, three-up match grid, and highlight strip; interactive adjustment controls are deferred until preview endpoints exist.
- Child forecast intake pulls in the deterministic test family (prefilled on preview branches) and posts to `/api/forecast-child`; `/child-premium` replays the forecast payload with premium inputs so `/child-results` can render both measurement projections and premium matches.
- Logged-in intakes also capture past sports (searchable `sports_subcategories`, intensity, enjoyment/flair/skill flags) and sync them to Supabase before saving recommendations.
- Logged-in free users can view history but are limited to one new stored analysis per day; anonymous runs still capture past-sport signals anonymously to fuel the data moat.
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
| **Public assets**                 | Vanilla JS (`public/assets/js/*.js`) handles Supabase auth, form submission, and DOM updates. `intake.js` manages the adult free + premium forms and the past-sport repeater, `child-intake.js` handles the measurement-only forecast, `child-premium.js` powers the credit-backed refinement, `child-results.js` renders stored runs, `child-results-premium.js` renders the premium matches, `dashboard.js` hydrates credit balances + saved runs, `checkout.js` triggers Stripe Checkout with child-profile selection, and `checkout-success.js` refreshes balances after payment. Images and other static assets also live under `public/`. |
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

### Visual Asset Policy
- **Illustrations (generative)**: Use the Sporty illustration pipeline for all human/sport scenes (landing hero, measurement helpers, sport spotlight art, guardian imagery). Maintain a shared backlog derived from `docs/JOURNEYS.md` and store assets in Supabase Storage with descriptive alt text.
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

---

## 9. References

- Backend repo: `../sporty-backend`
- Worker deploy workflow: `.github/workflows/deploy.yml`
- Shared image catalog: `docs/images/catalog.yaml`
- Design system baseline: Open Props via `src/styles/global.css`
- Optional brand overrides: `src/styles/brand.css`
- Supabase auth helpers: `public/assets/js/app.js`

Update this handbook whenever we change page structure, deployment steps, or environment expectations.
