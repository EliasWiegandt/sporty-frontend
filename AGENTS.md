# Sporty — Collaboration Guide for AI Agents

Purpose: help agents collaborate across `sporty-frontend` (Cloudflare Worker + static site) and `sporty-backend` (FastAPI) within a single VS Code workspace.

## Goals
- Serve the static UI via a Cloudflare Worker.
- Proxy `POST /api/recommend-adult-free` from the Worker to the backend `POST /recommend-adult-free`.
- Keep secrets out of the browser: Worker injects `X-API-Key` and exposes only public config via `/config.js`.

## Status (2025-09-24)
- Adult-only MVP in scope; child/guardian flows deferred.
- Results page now renders Supabase-hosted sport illustrations using `spec.media.card.path` + Worker-provided `SUPABASE_STORAGE_URL`.
- Intake form trimmed to core measurements + consent; optional notes/tags removed.
- Consent block styled as bordered callout.
- No persistence yet; Supabase auth/storage is still the next milestone.

## Supabase Plan (Next)
- Frontend will use `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` when auth/storage launches.
- Backend keeps `SUPABASE_SECRET_KEY` private.
- Worker now also needs `SUPABASE_STORAGE_URL` (public bucket base) to emit via `/config.js`.
- Import `optimal_bodies` dataset (already includes media metadata) to support scoring + illustrations.
- Schema/RLS reference: `docs/supabase/SCHEMA.md`.

## Guiding Principles
- User-first: simple flows, fast feedback, clear errors.
- Privacy-by-default: secrets live in platform env, never in code.
- Thin client: Worker proxies and injects auth; backend owns logic.
- Iterative delivery: small, testable steps with visible progress.
- Document decisions: prefer ADR entries to implicit choices.

## Product Vision (summary)
- Suggest sports that fit a person’s body and personality.
- Fun, educational tool; not medical advice.
- Killer feature (later): child + parents inputs → projected body model → early sport suggestions.
- Future: auth (Supabase), payments (Stripe), datasets of sports/body comps, research references.

Full vision: `docs/product/VISION.md`.

## Non-Goals
- Exposing backend directly to the browser.
- Storing secrets in the repo.

## Repos
- Frontend: `sporty-frontend` (this repo)
- Backend: `sporty-backend` (sibling folder: `../sporty-backend`)

## Important Files
- Frontend:
  - `site/index.html`: Form posting to `/api/submit`.
  - `src/worker.js`: Worker entry; should proxy to backend.
  - `wrangler.toml`: Worker config and routes.
- Backend:
  - `app/main.py`: FastAPI app with `/recommend-adult-free` endpoint.

## Env Vars / Secrets
- Worker (per environment via GitHub Actions + Wrangler):
  - `RENDER_URL` (var)
  - `STRIPE_PUBLIC_KEY` (var)
  - `SUPABASE_STORAGE_URL` (var; `https://<project>.supabase.co/storage/v1/object/public/sporty-media`)
  - `RENDER_API_KEY` (secret; injected as `X-API-Key`)
- Local dev: mirror these in `.dev.vars`.
- Backend: `API_KEY` must match `RENDER_API_KEY`.
- Supabase auth/storage credentials will be introduced when persistence launches.

## Local Dev Commands
- Start backend:
  - `cd ../sporty-backend`
  - `export API_KEY=dev-key-123 && uvicorn app.main:app --reload`
- Start worker:
  - `cd ../sporty-frontend`
  - `wrangler dev`

Use VS Code task "Dev: Both (Worker + Backend)" to run both.

## Health Checks
- Worker: `GET /api/healthz` returns `{ "ok": true }` quickly and does not touch the backend.
- Backend: avoid periodic pings on Render free tier (it sleeps by design). Use on-demand checks only when needed.

## Next Steps
- Add Supabase auth (email/OAuth) and Postgres for storing user-submitted intake and generated results.
- Add explicit consent UI for data retention; later add parent/guardian consent for children when enabling the child feature.
- Define initial schemas for adult-only profiles and results; keep child-specific fields out until that phase.

## Deploy
- Backend: Render.com (see `../sporty-backend/render.yaml`). Configure `API_KEY`, Supabase, and Stripe secrets.
- Frontend: Cloudflare Worker deployed via `.github/workflows/deploy.yml`. Action injects `RENDER_API_KEY` and passes vars `RENDER_URL`, `STRIPE_PUBLIC_KEY`, `SUPABASE_STORAGE_URL` to Wrangler before `deploy`.

## Style & Conventions
- Keep docs concise and colocated (`docs/` per repo).
- Prefer simple, static HTML/JS in frontend for now.
- Validate request/response contract before changing fields.

## Memory Index (What to Read First)
- Vision: `docs/product/VISION.md`
- Architecture: `docs/architecture.md`
- Current state: `docs/state.yml`
- Roadmap: `docs/ROADMAP.md`
- Backlog: `docs/BACKLOG.md`
- Decisions (ADR): `docs/DECISIONS.md`
