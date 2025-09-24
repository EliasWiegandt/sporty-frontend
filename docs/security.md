# Security

- RLS: enforce owner-only access and active-guardian checks for child data. Clients never bypass RLS; all child-creation/guardian operations go through security-definer RPCs.
- Keys: browser uses `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` only; backend/server tasks use `SUPABASE_SECRET_KEY`. Never expose the secret key to clients.
- Worker proxy: browser never calls the FastAPI backend directly. The Cloudflare Worker injects `X-API-Key: ${BACKEND_API_KEY}` and forwards to `${BACKEND_URL}`.
- Worker config endpoint (`/config.js`) only publishes non-sensitive values (e.g., `SUPABASE_STORAGE_URL`) needed by static pages; no secret keys are exposed.
- Token handling: guardian invites store only `sha256(token)` (`token_hash`) at rest. RPC returns plaintext token once; FE builds `/accept-guardian?token=...` URLs. Expiry is enforced by `expires_at`.
- GDPR notes: parents-only accounts for child data; minimal data collection; no biometric identifiers; explicit consent before retention; support revocation and deletion flows.
- CORS/allowlist: add development and production app origins to Supabase Auth redirect allowlist. The backend `/recommend-adult-free` is not exposed to browsers; only the Worker calls it.
