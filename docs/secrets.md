# Secrets & Environment Variables — Sporty

Shared reference for where secrets and environment variables live across **frontend (Cloudflare)**, **backend (Render)**, and **Supabase**.

---

## Cloudflare (Frontend)

Configured as GitHub environment variables/secrets (`sporty` repo → Settings → Environments). GitHub Actions inject them during deploy.

- `RENDER_URL` — Backend base URL per environment (test vs prod).
- `RENDER_API_KEY` — Secret added to proxied requests as `X-API-Key`.
- `STRIPE_PUBLIC_KEY` — Publishable Stripe key (test vs live) used by browser checkout helpers (if needed).
- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` — Browser-safe Supabase key.
- `SUPABASE_STORAGE_URL` — Public base URL for Supabase Storage assets (e.g., `https://<project>.supabase.co/storage/v1/object/public/sporty-media`). Served to the browser via `/config.js` so results pages can fetch sport illustrations.

Local dev: mirror these in `.dev.vars` for `wrangler dev`.

---

## Render (Backend)

Use Render Secret Manager per service/environment.

- `API_KEY`
- `STRIPE_SECRET_KEY_{TEST|LIVE}`
- `STRIPE_WEBHOOK_SECRET_{TEST|LIVE}`
- `STRIPE_PUBLISHABLE_KEY_{TEST|LIVE}` (optional convenience)
- `SUPABASE_URL` / `SUPABASE_URL_TEST`
- `SUPABASE_SECRET_KEY` / `SUPABASE_SECRET_KEY_TEST` (Supabase secret keys — replaces “service role” naming)

---

## Supabase

Secrets applied during deploy (CLI or SQL migrations). Copy the same keys to GitHub/Render where needed. Never expose the secret key to the browser or Worker logs.

---

## Stripe

Two modes: **test** and **live**. Keep the following in sync across environments:
- `STRIPE_PUBLIC_KEY_{MODE}`
- `STRIPE_SECRET_KEY_{MODE}`
- `STRIPE_WEBHOOK_SECRET_{MODE}`

Worker references only the publishable key; backend uses the secret + webhook secret.

---

## Usage Matrix

| Component | Keys |
|-----------|------|
| Worker | `RENDER_URL`, `RENDER_API_KEY`, `STRIPE_PUBLIC_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_STORAGE_URL` |
| Backend | `API_KEY`, `SUPABASE_URL{_TEST}`, `SUPABASE_SECRET_KEY{_TEST}`, Stripe keys |
| Local seeding scripts | `.env` entries for `SUPABASE_URL{_TEST}` + `SUPABASE_SECRET_KEY{_TEST}` |

Rotate secrets when environments change and keep `.env` / `.dev.vars` out of version control.
