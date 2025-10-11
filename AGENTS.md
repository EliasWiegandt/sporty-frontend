# Sporty — Frontend Agent Guide

Read this guide plus `docs/handbook.md` before contributing.

## Mission
- Maintain the Astro-based marketing + intake experience.
- Keep navigation, typography, and spacing consistent via `BaseLayout` and the tokens in `src/styles/tokens.css`.
- Ensure the Cloudflare adapter Worker continues to serve `/config.js`, proxy `/api/recommend-adult-free`, and now `/api/forecast-child` with `X-API-Key` auth.
- Prototype and validate the child forecast QA flow (`/child-intake` → `/child-results`) so backend forecasting can ship confidently.
- Coordinate any API or schema expectations with the backend team before shipping changes.

## Quick Facts
- Build pipeline: `npm run build` emits `dist/_worker.js/index.js` + assets; `wrangler deploy` publishes the generated Worker (see `wrangler.toml`).
- Node 20 is required in CI; commit `package-lock.json` with dependency changes.
- Browser JS lives under `public/assets/js/` (no bundler—keep scripts compatible with plain browsers).
- Design tokens → `src/styles/tokens.css`; base styles → `src/styles/global.css`.

## Local Dev
```bash
npm install
npm run dev          # Astro dev server
# or, to exercise the Worker:
npm run build
wrangler dev
```
- `.dev.vars` should provide the same vars as production (API key, Supabase URLs, Stripe publishable key).
- `make run-frontend` runs `npm run build` + `wrangler dev` in sequence.

## Collaboration
- Update `README.md` + `docs/handbook.md` whenever you add a page, tweak design tokens, or change build/deploy steps.
- Keep `BaseLayout` as the single source of truth for the top nav and auth controls; add props instead of duplicating markup in pages.
- Never expose Supabase service-role or Stripe secret keys in the frontend; only the Worker/backend should handle them.

If the repo drifts from the handbook, fix the docs first.
