# Decisions (ADR-style)

## ADR-001 — Frontend on Cloudflare Worker
- **Status:** Accepted
- **Why:** Serves static site, handles routing, and injects backend API key at the edge.

## ADR-002 — Backend on Render (FastAPI)
- **Status:** Accepted
- **Why:** Simple Python hosting with environment management; aligns with current stack.

## ADR-003 — Auth & Storage via Supabase
- **Status:** Accepted (in progress)
- **Why:** Managed Postgres plus authentication; tight integration with JS SDK; supports guardianship relations and RLS.

## ADR-004 — Payments via Stripe Checkout
- **Status:** Accepted
- **Why:** One-time $5 purchases (adult/child packages) are easy to model with Checkout + webhooks; avoids subscription complexity for MVP.

## ADR-005 — Worker ↔ Backend Auth with `X-API-Key`
- **Status:** Accepted
- **Why:** Keeps API key out of the browser; Worker adds the header on every proxied request.

## ADR-006 — Rename Supabase “service role” → Secret Key
- **Status:** Accepted
- **Why:** Align with Supabase terminology change; environment variables use `SUPABASE_SECRET_KEY{_TEST}` everywhere.

## ADR-007 — Product Scope Includes Adults & Children from Day One Credits
- **Status:** Accepted
- **Why:** Front page stays adult-only and free, but paid flows must already accommodate child forecasts. Documentation and UI reflect both tracks even if some screens ship later.

## ADR-008 — Credits Instead of Subscriptions
- **Status:** Accepted
- **Why:** One credit per analysis keeps pricing transparent, enables gifting later, and simplifies compliance. Stripe Checkout metadata tracks adult vs child credits.

## ADR-009 — Guardian Linking Required for Child Data
- **Status:** Accepted
- **Why:** Both parents/guardians must consent before their data is used for child forecasts. Implement invitations/approvals through Supabase RPCs and enforce via RLS.

## ADR-010 — Product Catalog Stored in Supabase (`billing_products`)
- **Status:** Accepted
- **Why:** Keep the purchasable offerings in Supabase so frontend/worker code can read descriptions and availability without redeploying. Stripe price IDs stay in one place and are seeded from `taxonomies/products.yaml`.

Future decisions should follow this format and stay consistent across repos.
