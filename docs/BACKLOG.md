# Backlog (short-horizon)

## Now
- Confirm Worker proxy for `/api/recommend-adult-free` and `/api/healthz`.
- Update landing + free flow UI with new copy (adult + child positioning, but free flow stays adult-focused).
- Improve measurement form validation and loading states.
- Refresh docs (vision, roadmap, access model, secrets) to reflect adult/child credit model.
- Keep Privacy + Terms drafts current with paid offerings.

## Next
- Integrate Supabase Auth and consent modal before storing measurements.
- Build “Saved measurements” dashboard for logged-in adults.
- Implement credit surface: fetch credits after login, show counts in header/account.
- Stripe Checkout flow: `/purchase` page → backend `/create-checkout-session` → success screen.

## Later
- Detailed adult intake (preferences, injuries, goals) gated by adult credits.
- Child onboarding wizard, including guardian invitation UI.
- Result pages for detailed adult and child forecast analyses.
- Analytics (submission counts, credit usage) with privacy safeguards.

## Guardianship UI (planned milestones)
- **Invite Modal** — capture optional email, copy link, show expiry.
- **Accept Invite Page** — handle token, prompt login, surface pending status.
- **Guardians Tab** — list active/pending guardians, approve/revoke actions.
- **Child Overview** — show child measurements, forecast summary once credit consumed.

Revisit this backlog after each roadmap phase to reprioritize.
