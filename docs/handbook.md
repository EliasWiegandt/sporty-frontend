# Sporty Frontend Handbook

_Last updated: 2025-09-27_

This handbook tracks how the Sporty frontend is assembled and deployed. Pair it with the backend handbook (`../sporty-backend/docs/handbook.md`) for API details and shared operational notes.

---

## 1. Mission
- Present Sporty’s marketing story and free adult intake experience.
- Keep navigation, typography, and layout consistent across all pages.
- Proxy `/api/recommend-adult-free` through the Cloudflare runtime so browsers never see backend secrets.
- Free adult match collects only birthdate, sex, height, weight, and optional body measurements (arm span, leg inseam, etc.); paid flows will add preferences and injuries later.
- Surface Supabase-powered auth/consent flows without persisting any sensitive keys client-side.

---

## 2. Architecture Overview

| Layer | Responsibilities |
|-------|------------------|
| **Astro** | Pages live in `src/pages`. Shared chrome (nav, footer, fonts) lives in `src/layouts/BaseLayout.astro`. Global design tokens are declared in `src/styles/tokens.css`, while `src/styles/global.css` provides base resets and utility classes. |
| **Astro API routes** | `src/pages/config.js.ts` publishes runtime Supabase config; `src/pages/api/recommend-adult-free.ts` proxies the backend; `src/pages/api/healthz.ts` exposes a health endpoint. |
| **Public assets** | Vanilla JS (`public/assets/js/*.js`) handles Supabase auth, form submission, and DOM updates. Images and other static assets also live under `public/`. |
| **Cloudflare Worker (generated)** | `astro build` (Cloudflare adapter) emits `dist/_worker.js/index.js`, wiring runtime env, asset serving, and the proxy routes above. |
| **Backend** | FastAPI service (`/recommend-adult-free`) behind the Worker; see backend repo for implementation details. |

`npm run build` produces a server bundle (`dist/_worker.js/**`) plus static assets (`dist/`), ready for `wrangler dev`/`wrangler deploy`.

---

## 3. Design System & Tokens
- Global tokens (`src/styles/tokens.css`) define typography stacks, spacing scale, radii, shadows, and brand colors. Reference those variables rather than hard-coding values.
- `BaseLayout` ensures shared fonts, nav layout, and auth controls render identically on every page. Only pass page-specific variations (e.g., nav links, primary CTA) via props.
- For page-specific tweaks, scope styles via inline `<style>` blocks in the `.astro` file so global CSS stays lean.
- Reuse utility classes (`.section`, `.grid-cards`, `.card`, `.button`) whenever possible to avoid divergence.

---

## 4. Local Development Workflow

1. `npm install`
2. `npm run dev` to work in Astro’s dev server (`http://localhost:4321`). Fastest loop for layout/content.
3. To test end-to-end with the generated Worker proxy:
   ```bash
   npm run build           # emit dist/_worker.js and assets
   wrangler dev            # or `make run-frontend`
   ```
   Provide the same env vars as production (API key, Supabase URLs, Stripe publishable key) via `.dev.vars` or Wrangler CLI flags.
4. Screenshot helper: `make snap` still hits `http://127.0.0.1:8787` expecting `wrangler dev` to be running.

---

## 5. Environment & Secrets
- Worker vars injected by GitHub Actions: `RENDER_URL`, `SUPABASE_URL`, `SUPABASE_STORAGE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `STRIPE_PUBLIC_KEY`.
- Secret deployed via `wrangler-action`: `RENDER_API_KEY` (also surfaced locally as `RENDER_API_KEY` when needed).
- Do **not** expose Supabase service-role keys or Stripe secret keys in the frontend. Only the Worker/backend should see those values.

`/config.js` is generated at request time by the Worker and makes only the publishable Supabase + storage details available to browser JS.

---

## 6. Deployment & Operations
- Workflow: `.github/workflows/deploy.yml` runs `npm ci` → `npm run build` → `wrangler deploy` for `test` and `main` branches.
- `wrangler.toml` points `main` to `dist/_worker.js/index.js` and serves static assets from `dist/` via the `ASSETS` binding.
- Keep `package-lock.json` committed so CI builds remain reproducible.
- Before merging UI changes, run `npm run build` to catch compile issues and confirm the generated Worker succeeds.

---

## 7. Backlog (Frontend Focus)
1. Add automated visual regression checks to catch layout drift when design tokens change.
2. Split Supabase auth/UI helpers into ES modules for easier test coverage.
3. Introduce content collections for FAQs and policy pages so marketing edits require less HTML wrangling.
4. Evaluate adding `astro:transitions` or partial hydration for future interactive dashboards once paid flows ship.
5. Coordinate with backend when Stripe + credits launch to surface purchase states in the UI.

---

## 8. References
- Backend repo: `../sporty-backend`
- Worker deploy workflow: `.github/workflows/deploy.yml`
- Shared image catalog: `docs/images/catalog.yaml`
- Design tokens: `src/styles/tokens.css`
- Supabase auth helpers: `public/assets/js/app.js`

Update this handbook whenever we change page structure, deployment steps, or environment expectations.
