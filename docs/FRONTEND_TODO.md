# FRONTEND TODO (Desktop MVP Alignment)

Last updated: 2025-10-14

This checklist tracks the work needed to align the Astro frontend with the navigation and flows defined in `docs/JOURNEYS.md`.

## Navigation & Layout

- [x] Update `src/layouts/BaseLayout.astro` default links to: `/about`, `/pricing`, `/dashboard` (or `/login` when signed out), plus a prominent `/intake` CTA.
- [ ] Ensure auth controls expose “Log in”/“Create account” consistently across pages and hide redundant CTAs when already authenticated.
- [x] Add footer links for Privacy/Data Rights that map to existing or planned pages.

## Top-Level Pages

- [x] Create `src/pages/about.astro` summarizing mission, AI philosophy, and consent highlights.
- [x] Create `src/pages/pricing.astro` describing free vs paid tiers and credit structure.
- [x] Create a logged-in dashboard shell at `src/pages/dashboard.astro` with placeholders for history, credits, and measurement locker.
- [x] Rename or redirect `src/pages/profile.astro` to `/account` to match the journeys wording; include consent management and data privacy controls.
- [ ] Audit `src/pages/privacy.astro` and expand into full data rights copy (or stub the legal draft and note follow-ups).

## Intake & Results Flows

- [x] Consolidate duplicate result pages (`results.astro` vs `result.astro`) into a single `/results` route that matches the desktop MVP layout.
- [x] Update `/intake` CTA routing to link to `/pricing` for upgrades and to `/dashboard` for history.
- [x] Review `/child-intake`, `/child-results`, and new `/child-premium` to ensure the guardian journey clearly separates forecasting from the premium sport-match step.
- [x] Remove or replace legacy redirect page `start.astro` if no longer needed.
- [x] Verify `public/assets/js/*` handles new routes (history links, navigation updates) without dead references.

## Linking & CTA Updates

- [x] Update homepage hero and feature sections with CTAs that point to the new pages (Pricing, About, Dashboard).
- [ ] Ensure all “Save this run” or “View history” links route to `/dashboard`.
- [x] Add “Account → Data & Privacy” link targets once the account page is renamed.
- [ ] Render premium analysis history (stored recommendation rows) inside `/dashboard` once backend exposes the necessary fields.

## Cleanup & Consistency

- [x] Remove redundant or deprecated CSS/JS tied to the old `result.astro` or `start.astro` flows.
- [ ] Confirm design tokens (`src/styles/tokens.css`) cover any new components used in About/Pricing pages before adding custom styles.
- [ ] Document any new components or layout changes in `docs/handbook.md`.
- [ ] Consolidate shared script injection (Supabase + `app.js`) so marketing pages don’t each need a bespoke `<Fragment slot="scripts">`.

Update this checklist as tasks are completed to keep the frontend aligned with the product journeys.
