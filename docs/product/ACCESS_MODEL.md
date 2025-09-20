# Sporty — Access Model (Frontend)

## Summary

Three engagement tiers align with the backend credit system:

1. **Free (anonymous)** — Body-only recommendation for adults. No login, no storage.
2. **Free (logged-in)** — Adults sign in with Supabase, save multiple measurement sets, and re-run the body-only recommendation.
3. **Paid (one-time credits)** — Purchase $5 packages through Stripe Checkout.
   - **Adult Package** → 1 adult credit → detailed analysis (preferences, injuries, goals).
   - **Child Package** → 1 child credit tied to a specific child → growth forecast + recommendations. Requires guardian consent.

Credits are consumed once per analysis. Adults linked to a child are not automatically analyzed—they must buy an adult package separately.

## Flow Highlights

### Anonymous Free Flow
- Landing/free pages gather body measurements.
- Worker proxies request to `/recommend-adult-free` and displays the response.
- No Supabase calls or storage.
- Results show the sport name, role hierarchy (e.g., freestyle → sprint), AI rationale, example athletes, and the measurement breakdown for the top three matches.

### Logged-In Free Flow
- User logs in via Supabase Auth (email/OAuth).
- UI allows saving measurement sets and running the body-only recommendation.
- Data persisted in Supabase after explicit consent.

### Paid Flow
- Purchase page calls backend `/create-checkout-session` with `product_id` (`single_adult_analysis` or `single_child_analysis`) and, for child credits, a `subject_child_id`.
- Redirect to Stripe Checkout.
- On success, Stripe returns to `/purchase/success`; frontend polls Supabase or backend to confirm new credit.
- Adult credits unlock detailed intake/results; child credits unlock child forecast flow once guardianship checks succeed.
- Product listing comes from Supabase `billing_products` (public SELECT) so the UI can display available packages and descriptions without hardcoding Stripe IDs.

## Gating Rules (Frontend)
- Fetch user credits (via Supabase view or backend endpoint) after login.
- Enable adult detailed analysis components when `adult_credits > 0`.
- Enable child flows when `child_credits` exist and guardianships are active.
- Hide or read-only gating for users without credits.

## Stripe UX
- Buttons: “Buy Adult Analysis ($5)” and “Buy Child Analysis ($5)”.
- Success screen explains how many credits remain and links to the relevant flow.
- Optional receipt email handled by Stripe.

## Consent & Privacy
- Prompt first-time logged-in users for consent before storing measurements or results.
- For child flows, require guardian invitations/approvals before allowing data entry or analysis.
- Never expose the Supabase secret key; the browser only uses the publishable key.

Keep this document synchronized with backend `docs/billing.md` and the Supabase schema.
