# Sporty — Frontend

Cloudflare Worker + static site powering Sporty’s user experience. The Worker serves pages, manages routing, and proxies API calls to the FastAPI backend so secrets stay server-side.

## Product Snapshot

Sporty suggests sports using body data today and richer signals for paid flows. The experience spans three tiers:

- **Free (anonymous)** — Adults enter measurements on the front page and receive top-three body-only matches with sport/role context. Nothing is stored.
- **Free (logged-in)** — Adults sign in with Supabase, save multiple measurement sets, and rerun the body-only suggestion without retyping.
- **Paid credits ($5)**
  - **Adult Package** → detailed recommendation using preferences, injuries, goals.
  - **Child Package** → child measurements, optional parent linking, growth forecast, and child-focused recommendations.
  - Credits are one-time; adults linked to a child still buy their own adult analysis if desired.

## Repo Layout

- `site/` — Static pages (landing, free intake, results) plus shared assets.
- `src/worker.js` — Cloudflare Worker entry; handles routing and API proxy.
- `docs/` — Product, architecture, roadmap, and security references (shared direction with backend repo).
- `Makefile` — Utility targets (e.g., snapshots).

## Getting Started

Prereqs: Node.js 18+, `wrangler` CLI, access to backend URL and API key.

```bash
npm install
wrangler login
wrangler dev
```

Populate `.dev.vars` (git-ignored) with:

```
BACKEND_URL=http://127.0.0.1:8000
BACKEND_API_KEY=dev-key-123
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-public-key
STRIPE_PUBLIC_KEY=pk_test_...
```

Ensure the backend is running locally (`make run-backend` in `../sporty-backend`). Submit the free form to confirm proxying works.

## Environment & Secrets

- Configure GitHub environment variables for test/prod deploys: `RENDER_URL`, `RENDER_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `STRIPE_PUBLIC_KEY`.
- Use `wrangler secret put` for per-environment secrets (staging/production).
- See `docs/secrets.md` for the complete matrix across repos.

## Upcoming Development

1. **Saved measurements** — Authenticated adults can persist measurement sets via Supabase.
2. **Stripe Checkout** — Purchase page launches Checkout for adult/child packages; success page surfaces available credits.
   - Read product metadata from Supabase `billing_products` to render offerings and copy dynamically.
3. **Detailed analysis UI** — Guided intake for adult credits (preferences, injuries, goals) and results page with explanations.
4. **Child forecast UI** — Guardian linking, child intake, forecast visualizations.

Refer to `docs/ROADMAP.md` and `docs/product/VISION.md` for deeper context.

## Worker Proxy Behavior

- Routes `/api/recommend-adult-free` → `${BACKEND_URL}/recommend-adult-free` with `X-API-Key` header.
- (Planned) Routes `/api/create-checkout-session` → backend checkout endpoint.
- Exposes `/api/healthz` returning `{ ok: true }` for uptime checks.

## Conventions

- Keep frontend/backend documentation in sync (vision, access model, billing).
- Use Supabase publishable key only in the browser; do not leak secret keys.
- When adding pages, update `docs/product/ACCESS_MODEL.md` and `docs/architecture.md` accordingly.

## Deployment

- Staging: `wrangler deploy --env staging`
- Production: `wrangler deploy --env production`

Before deploying, ensure the backend URL and API key secrets are set for the target environment.
