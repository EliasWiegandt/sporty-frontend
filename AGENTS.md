# Sporty — Collaboration Guide for AI Agents

Purpose: help agents collaborate across `sporty-frontend` (Cloudflare Worker + static site) and `sporty-backend` (FastAPI) within a single VS Code workspace.

## Goals
- Serve the static UI via a Cloudflare Worker.
- Proxy `POST /api/recommend-adult-free` from the Worker to the backend `POST /recommend-adult-free`.
- Keep the API key secret by injecting `X-API-Key` in the Worker.

## Status (Now)
- Adult-only MVP: only adult intake and suggestions are in scope. Child + parents growth projection is deferred.
- Backend is experimenting with synthetic/test data for optimal body profiles per sport to seed examples and shape scoring.
- No persistence yet; next step is adding Supabase for auth + data storage.

## Supabase Plan (Next)
- Frontend uses `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (public) for auth.
- Backend uses `SUPABASE_SECRET_KEY` (server-only) for DB writes; never expose to clients.
- Implement RLS with owner-only access and guardian-based access for child data.
- Import `optimal_bodies` dataset to support scoring and examples.
- Schema and RLS details: `docs/supabase/SCHEMA.md`.

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

## Env Vars
- Worker secrets:
  - `BACKEND_URL`: Base URL for backend (e.g., `http://127.0.0.1:8000` or Render URL).
  - `BACKEND_API_KEY`: API key to send as `X-API-Key`.
  - Local dev: put these in `.dev.vars` (ignored by git). Example in `.dev.vars.example`.
- Backend env:
  - `API_KEY`: Must match `BACKEND_API_KEY`.

Upcoming (not yet used): Supabase Project credentials for auth + Postgres. Add only when integrating auth/storage.

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
- Backend: Render.com (see `../sporty-backend/render.yaml`). Set `API_KEY`.
- Frontend: Cloudflare Worker. Set secrets `BACKEND_URL`, `BACKEND_API_KEY` per environment.

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
