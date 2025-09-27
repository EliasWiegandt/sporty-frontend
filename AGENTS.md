# Sporty — Backend Agent Guide

Read this file plus `docs/handbook.md` before contributing.

## Mission
- Serve `/recommend-adult-free` behind the Cloudflare Worker (`X-API-Key` auth).
- Use Supabase service-role key for data access (measurements, recommendations, consents).
- Keep schema migrations and seeds (`supabase/migrations/`, `make seed-*`) up to date.
- Coordinate upcoming Stripe + credit work with the frontend team.

## Quick Facts
- Render deployment defined in `render.yaml`; configure `API_KEY`, Supabase secrets, and Stripe keys there.
- Supabase trigger `handle_new_user()` is security-definer to auto-create `profiles` rows.
- Consent-aware UX lives in the frontend; backend must never persist per-user data outside of Supabase.

## Local Dev
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.sample .env   # or create manually
make run-backend
```
- `.env` requires `API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and Stripe test credentials.
- Run alongside `wrangler dev` (frontend) to test end-to-end.

## Collaboration
- Update `docs/handbook.md` with any schema change, new endpoint, or operational note.
- Keep `API_KEY` identical to the Worker’s `RENDER_API_KEY` across all environments.
- Use Supabase admin keys only server-side; never expose them in responses or logs.

If anything in the repo diverges from the handbook, fix the docs first.
