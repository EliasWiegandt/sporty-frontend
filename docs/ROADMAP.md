# Roadmap

## Phase 1 — Free Experience (now)
- Ship front page + free suggestion flow using body-only `/recommend-adult-free`.
- Polish measurement form, validation, and result display.
- Ensure Worker proxy + health check paths are stable.

## Phase 2 — Accounts & Saved Measurements
- Integrate Supabase Auth (email + OAuth providers).
- Add consent UX before persisting any data.
- Build “Saved measurements” dashboard for logged-in adults.
- Coordinate with backend on Supabase schema for measurements and basic results.

## Phase 3 — Payments & Credits
- Implement purchase page with Stripe Checkout (adult / child options).
- Handle success/cancel return routes and update UI with available credits.
- Surface credit counts and recent analyses in the account area.

## Phase 4 — Detailed Adult Analysis
- Extend intake to capture preferences, injuries, goals when an adult credit exists.
- Display richer analysis results (factors, suggested sports, next steps).

## Phase 5 — Child Forecast Flow
- Add child management UI (create child, invite/link second parent, approve requests).
- Collect child measurements and optional parent data (with consent).
- Display forecasted adult metrics and child-specific recommendations when a child credit is redeemed.

## Phase 6 — Hardening & Growth
- Instrument analytics (event tracking) with privacy in mind.
- Add loading/error states for payment flows.
- Align marketing copy with paid tiers and child capabilities.
- Enhance accessibility and internationalization where needed.

Keep roadmap synchronized with backend `docs/ROADMAP.md` and adjust phases as discovery continues.
