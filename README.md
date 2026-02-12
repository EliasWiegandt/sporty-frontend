# Sporty Frontend (Astro + Cloudflare)

Frontend site + intake flows for Sporty, deployed as a Cloudflare Worker bundle.

## Local Dev
```bash
npm install
npm run dev
```

Worker/proxy mode:
```bash
npm run build
wrangler dev
```

## Deploy
- Workflow: `.github/workflows/deploy.yml`
- Wrangler config: `wrangler.toml`
- Build output: `dist/_worker.js/index.js` + `dist/` assets

## Runtime API Proxy Map
- `POST /api/recommend-adult-free` -> backend `/v1/recommend-adult-free`
- `POST /api/recommend-adult-premium` -> backend `/v1/recommend-adult-premium`
- `POST /api/forecast-child` -> backend `/v1/forecast-child`
- `GET /api/credits` -> backend `/v1/credits`
- `POST /api/create-checkout-session` -> backend checkout endpoint
- `GET /config.js` runtime public config

## Design-System Guardrails (Short)
- Keep shared tokens/components in `src/styles/tailwind.css` authoritative.
- Reuse `type-*`, `btn-pill`, `section-shell`, `card-shell` primitives.
- Avoid ad-hoc standalone CSS when a shared token/component fits.

## Canonical Docs
- Engineering reference: [docs/handbook.md#2-architecture-overview](docs/handbook.md#2-architecture-overview)
- Product journeys + consent UX: `docs/journeys.md`
- Backend contracts/ops: [../sporty-backend/docs/handbook.md#8-operational-playbooks](../sporty-backend/docs/handbook.md#8-operational-playbooks)
