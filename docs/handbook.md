# Sporty Backend Handbook

_Last updated: 2025-09-27_

This handbook captures how the FastAPI service supports the Sporty MVP. Pair it with the frontend handbook (`../sporty-frontend/docs/handbook.md`) for the full story.

---

## 1. Role of the Backend
- Serve `/recommend-adult-free` behind the Cloudflare Worker (`X-API-Key` auth).
- Operate with Supabase service-role credentials to read/write recommendation data.
- Seed and maintain sport metadata (`optimal_bodies`, taxonomies).
- Prepare for Stripe checkout and credit consumption.

---

## 2. Architecture Summary

| Component | Description |
|-----------|-------------|
| `app/main.py` | FastAPI app exposing `/recommend-adult-free` and (soon) Stripe endpoints. |
| Supabase client | `create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)` for admin-level access with RLS bypass. |
| Stripe SDK | Configured but idle until checkout endpoints land. |
| Deployment | Render (`render.yaml`) builds with `pip install -r requirements.txt`, starts via Uvicorn. |

Request flow: Worker → backend with `X-API-Key` → Supabase `optimal_bodies` lookup → scored matches returned to browser. Consent logic lives in the frontend; backend never persists per-user data directly.

---

## 3. Environment & Secrets

Set these in `.env` locally and in Render for each environment:

| Variable | Purpose |
|----------|---------|
| `API_KEY` | Shared secret expected from the Worker. |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Supabase PostgREST URL + service-role key. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe credentials for future checkout flows. |
| `STRIPE_MODE` | `test` or `live`; optional (inferred from secret key). |

Optional for scripts: `SUPABASE_URL_TEST`, `SUPABASE_SECRET_KEY_TEST`.

**Never** log or expose the Supabase secret key.

---

## 4. Local Development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.sample .env   # or create manually
make run-backend      # uvicorn app.main:app --reload
```

Verify:
```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"birthday":"1990-01-01","sex":"female","height_cm":175,"weight_kg":68}' \
  http://127.0.0.1:8000/recommend-adult-free | jq
```

Run alongside `wrangler dev` in `../sporty-frontend` to test the full flow.

---

## 5. Supabase Notes

- Migrations live in `supabase/migrations/`. Apply in order (00001 schemas/policies, 00002 payments).
- `handle_new_user()` trigger is `SECURITY DEFINER` so profiles are created safely when new auth users register.
- Key tables touched by the backend: `optimal_bodies`, `sports`, `roles`, `consents`, `measurements`, `submissions`, `recommendations`, `billing_products`, `purchases`, `analysis_credits`.
- Image metadata (`spec.media.card`) must align with Supabase Storage paths defined in `../sporty-frontend/docs/images/catalog.yaml`.

---

## 6. Deployment & Operations

- Render uses `render.yaml` (build = `pip install -r requirements.txt`, start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
- Expose the public Render URL to the Worker via GitHub Environment variable `RENDER_URL`.
- Keep `API_KEY`/`RENDER_API_KEY` synchronized per environment.
- Add a lightweight `/healthz` endpoint before production launch (placeholder in backlog).

Seeding helpers:
```bash
make seed-test-taxonomies
make seed-test-optimal-bodies
```
Requires Supabase credentials in `.env` or `.env.prod`.

---

## 7. Backlog (Backend Focus)

1. Implement Stripe checkout endpoints (`/create-checkout-session`, `/stripe-webhook`) and credit issuance.
2. Provide APIs/views for fetching consented recommendation history (currently queried client-side via Supabase).
3. Extend recommendation engine for detailed adult inputs once forms ship.
4. Build guardian + child endpoints (create child, invite/approve guardians, forecast analysis).
5. Instrument logging/metrics (latency, error rates) prior to GA.

Keep this list aligned with the frontend handbook backlog.

---

## 8. References
- Frontend repo: `../sporty-frontend`
- Frontend handbook: `../sporty-frontend/docs/handbook.md`
- Deploy workflow: `.github/workflows/deploy.yml`
- Image prompts: `../sporty-frontend/docs/images/catalog.yaml`
- Render config: `render.yaml`

Update the handbook whenever backend behavior or operations change.
