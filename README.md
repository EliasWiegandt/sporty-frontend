# Sporty Frontend (Astro + Cloudflare Adapter)

Marketing + intake experience for Sporty. Built with Astro + the Cloudflare adapter so the Worker bundle and static assets are generated together. The UI is built with [Astro](https://astro.build/) and the Cloudflare adapter generates the Worker that serves the pages, exposes runtime config at `/config.js`, and proxies API calls to the FastAPI backend.

## Project Structure

```
├── astro.config.mjs        # Astro config (Cloudflare adapter, SSR output)
├── src/
│   ├── layouts/            # Shared page shells (nav, fonts, auth controls)
│   ├── pages/              # `.astro` pages + API routes under `pages/api`
│   ├── styles/             # `tokens.css` (design tokens) + `global.css`
│   └── env.d.ts            # Cloudflare runtime typings (env + locals)
├── public/
│   └── assets/js/          # Vanilla browser scripts (Supabase auth, forms)
├── dist/                   # Build output (`_worker.js/**`, assets)
└── .github/workflows/      # deploy.yml runs build + wrangler deploy
```

Design tokens live in `src/styles/tokens.css`. Update tokens first before making ad-hoc style tweaks so every component stays in sync.

- **Free adult match** collects birthdate, sex, height, weight, and optional body measurements (arm span, etc.). Premium adult analysis (credit required) lets signed-in users capture up to 20 goals, preferences, and injuries alongside those measurements.
- **Child forecast QA flow** lives at `/child-intake` and `/child-results`. It posts to `/api/forecast-child` using the deterministic family seeded in the backend so we can validate the forecasting pipeline end-to-end.

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
   npm run build          # emit dist/_worker.js and static assets
   wrangler dev           # or `make run-frontend`
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
- `api/forecast-child.ts` → `POST /api/forecast-child` proxy with `X-API-Key` to backend `/v1/forecast-child`
- `api/healthz.ts` → `GET /api/healthz`

All endpoints reuse the same request-id logic as the legacy Worker. Static assets are served from `public/` and baked into the build output.

## Keeping Things Consistent

- Always wrap pages in `BaseLayout` so nav/auth controls stay identical.
- Pull colors, spacings, and typography from `src/styles/tokens.css`.
- Scope page-specific styling with inline `<style>` blocks or dedicated components—edit `global.css` only for site-wide changes.
- Update this README, `docs/handbook.md`, and `AGENTS.md` when introducing new pages, design tokens, or deployment steps.
- When adding API calls, surface them through `src/pages/api/*` so the Worker injects the secret headers (see `api/forecast-child.ts` for the latest example).

Questions? Coordinate with the backend team before changing proxy behavior or API assumptions.
