# Sporty Backend (FastAPI)

This service powers Sporty’s recommendation flows. It sits behind the Cloudflare Worker so every public call is proxied with `X-API-Key` authentication.

- Current responsibility: `/recommend-adult-free` (body-only scoring) for both anonymous and signed-in flows.
- Near-term roadmap: Stripe checkout + credits, richer stored recommendations, child/guardian endpoints.

For the full product and architectural context, read [`docs/handbook.md`](docs/handbook.md) and the frontend handbook (`../sporty-frontend/docs/handbook.md`).

---

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.sample .env  # or create manually
make run-backend     # uvicorn app.main:app --reload
```

Example `.env`:
```ini
API_KEY=dev-key-123
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=test
```

Smoke test:
```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"birthday":"1990-01-01","sex":"female","height_cm":175,"weight_kg":68}' \
  http://127.0.0.1:8000/recommend-adult-free | jq
```

Run concurrently with the frontend Worker (`wrangler dev`) to exercise the full flow.

---

## Deployment

Render handles hosting via `render.yaml`:
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Required environment variables:
| Name | Purpose |
|------|---------|
| `API_KEY` | Shared secret from the Worker |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Supabase PostgREST + service-role key |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe credentials (test/live) |

Expose the Render URL (e.g., `https://sporty-test.onrender.com`) to the Worker via GitHub Environment variable `RENDER_URL`.

---

## Helpful Commands

```
make run-backend             # start uvicorn with reload
make seed-test-taxonomies    # seed sports/roles/tags (requires Supabase creds)
make seed-test-optimal-bodies
```

Keep `supabase/migrations/` in sync with schema changes and run them after adjustments (trigger `handle_new_user` is security-definer to auto-create profiles).

---

Questions? Update the handbook when you learn something new.
