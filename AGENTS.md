# Sporty — Frontend Agent Guide

Read this guide plus `docs/handbook.md` before contributing.

## Mission
- Maintain the Astro-based marketing + intake experience.
- Keep navigation, typography, and spacing consistent via `BaseLayout` and the tokens in `src/styles/tokens.css`.
- Ensure the Cloudflare adapter Worker continues to serve `/config.js`, proxy `/api/recommend-adult-free`, and now `/api/forecast-child` with `X-API-Key` auth.
- Capture and sync logged-in users’ past sports (searchable dropdown, intensity & flair flags) so the backend can incorporate prior experience.
- Prototype and validate the child forecast QA flow (`/child-intake` → `/child-results`) so backend forecasting can ship confidently.
- Respect the one-stored-analysis-per-day cap for free accounts while still collecting anonymous past-sport inputs (without identity) to grow the data moat.
- Build out premium intake/results UI for performance factors and derived indexes (Monkey Index, discipline ratios) as soon as backend contracts land.
- Premium flow: when `usePremium` is toggled we now call `/api/recommend-adult-premium`; keep the intake toggle + premium results (`/results/premium`) aligned with backend payloads (component impacts, alignments, credit summaries).
- Child forecasts also trigger `/v1/recommend-adult-premium` when a guardian applies a child credit; ensure `/child-intake` collects preferences/goals/injuries and `/child-results` renders the returned premium analysis block.
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
- Prefer the CLI’s built-in helpers (search/explore panels, file viewers, etc.) when inspecting the codebase; fall back to raw shell commands only when the helper can’t capture what you need so output stays easy to follow.

## Consent & Visual Asset Guidelines
- Follow the consent flows documented in `docs/JOURNEYS.md`: always offer preview modes, gate storage behind explicit opt-ins (measurements, goals/preferences, injuries, child data), and surface revoke controls. UI copy must explain purpose, retention, and provide links to Privacy/Data Rights pages.
- Distinguish visual asset pipelines: use coded charts/tables for data (fit contributions, growth curves, etc.), and rely on the illustration generator for human/sport scenes or measurement helpers. Maintain the illustration backlog referenced in the journeys file and ensure every chart has an accessible text/table fallback.

If the repo drifts from the handbook, fix the docs first.


## MVP Investment Policy
- Invest effort in polished charts and illustration placeholders—the journeys lean on strong visual storytelling.
- Keep everything else lightweight: reuse existing components, prefer simple CSS/HTML patterns, and defer advanced animations.
- Use Astro islands sparingly (vanilla or Preact) to deliver interactivity without bloating the MVP surface.
- Only add dependencies that directly serve the MVP scope (charts, consent); avoid speculative tooling.
