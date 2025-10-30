# Sporty Frontend (Astro + Cloudflare Adapter)

Marketing + intake experience for Sporty (live at `sporty.plyml.com`, with the staging site on `sporty-test.plyml.com`). Built with Astro + the Cloudflare adapter so the Worker bundle and static assets are generated together. The UI is built with [Astro](https://astro.build/) and the Cloudflare adapter generates the Worker that serves the pages, exposes runtime config at `/config.js`, and proxies API calls to the FastAPI backend.

## Overview

Sporty’s Astro frontend delivers the marketing experience and browser intake surfaces for adult and child analyses. For the complete product and architectural context, read `docs/handbook.md` (this repo) and `../sporty-backend/docs/handbook.md`.

For automation or AI contributions, make sure to read `AGENTS.md` after the handbook.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Fast iteration on markup/styles (no Worker):
   ```bash
   npm run dev
   ```
   Served at `http://localhost:4321`.
3. Exercise the generated Worker + backend proxy:
   ```bash
   npm run build          # emit dist/_worker.js and static assets (or just run `make run-frontend`)
   wrangler dev           # `make run-frontend` cleans dist/, rebuilds, and runs this command for you
   ```
   Provide `RENDER_URL`, `RENDER_API_KEY`, Supabase, and Stripe publishable vars via `.dev.vars` or CLI flags (same as production).

Useful npm scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Astro dev server |
| `npm run build` | Build Worker bundle + assets into `dist/` |
| `npm run preview` | Preview the built worker locally |
| `npm run check` | Type + Astro diagnostics |

## Deployment

GitHub Actions workflow `.github/workflows/deploy.yml` installs deps, runs `npm run build`, then calls `wrangler deploy`. `wrangler.toml` points `main` at `dist/_worker.js/index.js` and serves static assets from `dist/` via the `ASSETS` binding, so the generated Worker and pages ship together.

Environment values are unchanged:
- `RENDER_API_KEY` (secret) — injected for API proxy auth
- `RENDER_URL`, `SUPABASE_URL`, `SUPABASE_STORAGE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `STRIPE_PUBLIC_KEY` (environment variables per target)

## Runtime & API Routes

Cloudflare adapter outputs the Worker; no hand-written `src/worker.js` remains. Dynamic routes now live in `src/pages/api/`:
- `config.js.ts` → `GET /config.js` (publishes Supabase URLs/key for browser code)
- `api/recommend-adult-free.ts` → `POST /api/recommend-adult-free` proxy with `X-API-Key` to backend `/v1/recommend-adult-free`
- `api/recommend-adult-premium.ts` → `POST /api/recommend-adult-premium` for credit-backed analyses
- `api/forecast-child.ts` → `POST /api/forecast-child` (credit-gated child analysis returning forecast + premium matches)
- `api/credits.ts` → `GET /api/credits` (dashboard credit balances)
- `api/create-checkout-session.ts` → `POST /api/create-checkout-session` to start Stripe Checkout for credit purchases
- `api/healthz.ts` → `GET /api/healthz`

All endpoints reuse the same request-id logic as the legacy Worker. Static assets are served from `public/` and baked into the build output.

## Keeping Things Consistent

- Always wrap pages in `BaseLayout` so nav/auth controls stay identical.
- Pull colors, spacing, and typography from the Open Props variables surfaced through `src/styles/global.css`. Drop overrides in `src/styles/brand.css` only when brand-specific values are required. The Sporty brand palette is defined there (`--brand-*` teals) and feeds the Tailwind component layer in `src/styles/tailwind.css`.
- Reach for the shared Tailwind utilities/components defined in `src/styles/tailwind.css` (buttons, cards, layout shells, etc.) instead of adding ad-hoc CSS.
- The primary wordmark lives in `BaseLayout` and combines the Sporty logotype with an Iconify laurel (`i-mingcute-laurel-wreath-fill`). If you update the brand treatment, adjust it in one place and ensure the icon palette remains accessible on light backgrounds. The navbar CTA defaults to “Try free analysis”; change `defaultPrimaryAction` in `BaseLayout` if product copy shifts.
- Scope page-specific styling with inline `<style>` blocks or dedicated components—edit `global.css` only for site-wide changes.
- Update this README, `docs/handbook.md`, and `AGENTS.md` when introducing new pages, design tokens, or deployment steps.
- When adding API calls, surface them through `src/pages/api/*` so the Worker injects the secret headers (see `api/forecast-child.ts` for the latest example).
- Past sport search pulls directly from `sports_subcategories`; keep that taxonomy seeded so the dropdown stays accurate.

### Shared Tailwind preset

- Sporty’s theme tokens are centralised in `src/styles/tailwind.css`. For other apps/islands, reuse the preset exported from `tailwind.sporty-preset.mjs`:

  ```js
  // tailwind.config.mjs
  import sportyPreset from './tailwind.sporty-preset.mjs';

  export default {
    presets: [sportyPreset],
    content: ['src/**/*.{astro,tsx,jsx,ts,js}'],
  };
  ```

- The preset mirrors the CSS variables, so updating the design tokens in `tailwind.css` keeps the preset in sync.

### Preline interactivity

- `BaseLayout` includes an inline module that imports Preline and runs `window.HSStaticMethods.autoInit()` after each page load (including `astro:page-load` swaps), so components only need the documented `data-hs-*` attributes.
- When you add a Preline component, drop the documented `data-hs-*` attributes into the template—there’s no need for per-page bootstrapping.
- If a component is rendered dynamically (e.g., after fetching data with vanilla JS), call `window.HSStaticMethods?.autoInit()` once the markup lands so Preline wires the behavior.

Questions? Coordinate with the backend team before changing proxy behavior or API assumptions.
