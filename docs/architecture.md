# Architecture

Flow: **Browser → Cloudflare Worker → FastAPI backend → Supabase / Stripe**.

1. Worker serves static assets (`site/`) and exposes `/config.js` so the browser can read environment-backed settings (e.g., Supabase Storage base URL).
2. Browser posts to Worker endpoints (`/api/recommend-adult-free`, `/api/checkout`, etc.).
3. Worker proxies to backend (Render) injecting `X-API-Key: ${BACKEND_API_KEY}`.
4. Backend talks to Supabase (persist data, read credits) and Stripe (Checkout + webhooks).
5. Worker exposes `GET /api/healthz` returning `{ ok: true }` without touching the backend.

## Key Entities

- Worker secrets: `BACKEND_URL`, `BACKEND_API_KEY`, `STRIPE_PUBLIC_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_STORAGE_URL`.
- Backend secrets: `API_KEY`, `SUPABASE_SECRET_KEY{_TEST}`, `STRIPE_SECRET_KEY_{MODE}`, `STRIPE_WEBHOOK_SECRET_{MODE}`.
- Supabase schemas/tables: `profiles`, `children`, `guardianships`, `measurements`, `preferences`, `injuries`, `goals`, `past_sports`, `recommendation_results`, `purchases`, `analysis_credits`.

## Contracts (initial)

- `POST /api/recommend-adult-free` (Worker) → `/recommend-adult-free` (Backend)
  - Request: adult body measurements (height, weight, optional limbs, `sex` with "prefer_not_to_say").
  - Response: top three matches including sport metadata from Supabase, role hierarchy descriptions, AI rationale, example athletes, per-metric scores, and—when available—`media.card` metadata that points at the Supabase Storage illustration for the sport/cohort. Only `optimal_bodies.is_current = true` rows are returned.

Future additions:
- `POST /api/create-checkout-session` → `/create-checkout-session`
- `POST /api/stripe-webhook` (backend only; Worker unused)
- `GET /api/credits` → returns available adult/child credits
- `POST /api/analyses` → trigger detailed/child analysis when credit exists

## Persistence & Consent

- Free anonymous flow: no writes.
- Logged-in free flow: measurements stored after explicit consent.
- Paid flows: store purchases, analyses, and audit metadata.
- Supabase RLS ensures users can only access their data; guardianships gate child content.

## Guardianship Sequence

1. Parent A logs in, consents, and creates a child profile (`api.create_child`).
2. Parent A invites Parent B (`api.invite_guardian`) → receives token.
3. Parent B accepts via link (`api.accept_guardian_invite`).
4. Parent A approves (`api.approve_guardian_invite`).
5. Both guardians now have `active` access. Child credits require an active guardian relationship.

## Notes

- Worker never stores Supabase secret keys; browser uses only publishable key with RLS-protected APIs.
- Sport illustrations live in Supabase Storage (`sporty-media/sport_subcategory_images`). Worker-provided `/config.js` exposes the public base URL so static pages can compose the full asset URLs without embedding secrets.
- Stripe Checkout handles PCI; backend stores minimal Stripe metadata for reconciliation.
- Add telemetry for request timing and error tracking before GA.
