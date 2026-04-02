# Sporty Frontend Handbook

_Last updated: 2026-03-01_

This handbook tracks how the Sporty frontend is assembled and deployed. Pair it with the backend handbook (`../sporty-backend/docs/handbook.md`) for API and entitlement details. (`../sporty-backend/docs/handbook.md`) for API details and shared operational notes.

Compliance posture: strict no-claim mode. Treat frontend/legal copy as operational statements, not legal certification language, unless legal review explicitly approves stronger claims.
Legal-basis posture: mixed model. Strictly necessary service operations may rely on contract/legal-obligation basis, while explicit consent categories remain required for high-risk/optional processing classes (`sensitive_health_processing`, `child_data_processing`) and user-facing identifiable persistence control (`basic_processing`).
Minor launch posture: Day-1 guardian-mediated flow for users under 18 is in scope; no direct child self-service onboarding.
Child hardening posture: child analyses require paid guardian card-backed child credits, child anonymized-event collection is disabled, child-derived data is not monetized (including aggregates), and child identifiable analysis data is retained 7 days before deletion.
Child forecast adult-target contract: child forecast always targets the fixed mature-adult reference cohort `25-35 years`. Do not expose adult-cohort choice in the intake UI, and do not surface `Adult cohort` as a summary field in child results.
Child results persistence strategy: no retention-extension option at launch; guardians should export PDF from `/child-results` to retain records beyond 7 days.
Child forecast chart color contract: use one tight teal family for the three markers (`Adult population average`, `Child currently`, `Child forecasted`), with each marker label matching its marker color. Use a separate two-shade teal family for delta/contribution bars (stronger teal for positive, muted teal for negative). Do not reintroduce unrelated blue/orange/purple/red hues into the same chart.
Child forecast measurement-card disclosure contract: use the same chevron affordance language as the premium results accordions rather than `Hide details` text buttons. On mobile, the `Child currently` label should sit just above the chart bar so it cannot collide with measurement titles.
Child forecast marker-label overflow contract: marker labels stay centered in normal cases, but when a marker sits near the left/right edge on mobile, the label should dock inward (`edge-left` / `edge-right`) instead of spilling outside the chart bounds.
Signup legal gate posture: sign-up now requires Terms acceptance, Privacy acknowledgment, and 18+/guardian attestation plus country-of-residence; launch scope is EU+US only.

---

## 1. Mission

- Present Sporty’s marketing story and free adult intake experience.
- Maintain the public site at `sporty.plyml.com` (staging: `sporty-test.plyml.com`); references to “sporty” in docs mean that domain unless specified.
- Prototype the child forecast QA flow so backend forecasting can be exercised end-to-end.
- Keep navigation, typography, and layout consistent across all pages. The primary navbar now uses the Sporty wordmark with the Iconify laurel wreath (`<iconify-icon icon="mingcute:laurel-wreath-fill">`)—adjust `BaseLayout` if the brand lockup changes. Brand teal tokens live in the Tailwind theme (`src/styles/tailwind.css`) and feed the shared component layer. The shared header auth CTA lives in `BaseLayout`; do not reintroduce page-local header CTAs or duplicate auth controls.
- Proxy `/api/recommend-adult-free` and `/api/forecast-child` through the Cloudflare runtime so browsers never see backend secrets.
- Proxy `/api/legal/accept` through the Cloudflare runtime to persist versioned legal-acceptance evidence after signup.
- Proxy `/api/legal/status` and enforce a hard checkout legal gate: purchases require current terms/privacy acceptance versions before Stripe redirect.
- Proxy `/api/intake/prefill` to the backend canonical intake-prefill family (`/v1/intake-prefill`) so both adult and child intake use one backend-owned prefill source.
- Free adult match now requires the full measurement set (birthday, sex, height, weight, arm span, leg inseam, shoulder width, pelvic bone width, torso length, hand length, foot length, ankle circumference, wrist circumference) and renders numeric inputs with +/- controls, contextual tooltips, and autosave across steps. Premium-only inputs (preferences, goals, injuries) remain locked behind credits until a paid analysis is available.
- When an authenticated user has credits, the intake toggles “Apply credit” to run `/api/recommend-adult-premium`; the premium journey redirects to `/results/premium?id=<recommendation_id>` and the page loads the stored premium ranking through `/api/premium-results`.
- Adult intake now exposes two routes (`/intake` and `/intake-premium`) that both hydrate the Preact island at `src/components/intake/IntakeApp.tsx`; the free page keeps traits locked behind the premium controller, while the premium page flips the `mode` prop so the traits/goals/injuries steps appear and the credit-backed submission posts to `/api/recommend-adult-premium`.
- The payload sent to `/api/recommend-adult-premium` now includes the trait answers collected in the Traits step (`muscle_fiber`, `metabolic_tendency`, `joint_laxity`, `foot_arch`, `temperature_tolerance`, `handedness`, `footedness`) so the matching service can incorporate those signals into premium scoring.
- Trait/measurement language is now backend-canonical: intake traits + measurement config load from `/api/intake-catalog`, and result/drill-down trait displays consume backend `trait_label` + `*_value_label` fields (no frontend underscore-humanize fallback for trait ids/values). Trait-step heading/subheading copy is frontend-owned, not catalog-driven.
- Injury severity language is now backend-canonical too: premium adult + child injury severity options/defaults come from `/api/intake-catalog`, and premium result surfaces should prefer backend `severity_label` + `guidance` fields over raw severity ids.
- Child race language is backend-canonical too: `/api/intake-catalog` now supplies `child_forecast.race_options`, child intake submits canonical `race` ids, and result pages should render the catalog label rather than a hard-coded ethnicity string.
- Child analysis now requires a child credit up front; guardians collect measurements, apply the credit, and receive both the forecast and premium sport matches in the same flow (`/child-intake` → `/child-results?id=<run_id>&tab=matches`, with a Forecast tab alongside it).
- `/child-results` now includes a guardian `Export this view as PDF` path designed for post-7-day record keeping. The export is a print-to-PDF projection of the currently visible 1–3 filtered child premium matches, not a separate top-10 ranking. It should remain text-first, but include the match image for each exported sport body and inline factor explanations that are hover-only in the interactive UI.
- In the child PDF export, `Match summary` is intentionally lean: keep `Match score`, drop low-signal metadata like sport slug, category slug, and cohort. Also keep body reporting as one canonical `Body measurements` table with forecasted value, optimal body, contribution, and explanation, rather than splitting the same measurement story across separate body-measurement and body-factor sections.
- Keep the child PDF export match-only. Do not prepend report-level chrome like generated timestamps, report titles, or retention boilerplate above the exported matches. If page numbers are desired, that is the browser print layer, not app-rendered PDF content.
- In filtered premium results views, rank badges and PDF section numbers should reflect the current visible filtered order, not the original canonical run rank. Otherwise users see confusing gaps like `1` then `3` when rank `2` was filtered out upstream.
- Premium results are now browsable ranked datasets, not fixed top-3 blobs. Adult premium and child premium share the same endpoint-driven browser: first view shows top 3, users can move one card at a time, use `First`/`Previous`/`Next`/`Last`, toggle unique-sport projection, and filter by sport. `unique_sports` is a view toggle only, not a scoring rule.
- Premium browser controls contract: `One best subcategory per sport` should use the shared toggle-switch pattern, not a pill masquerading as a toggle. The sport filter menu should expose both `Include all` and `Remove all`, and on phone widths the dropdown must size to the toolbar width instead of floating at desktop width off-screen.
- Premium browser filter-menu contract: the summary label stays plain `Filter sports` (no live count suffix), and when the menu is open, an outside click or `Escape` should close it before any underlying page action fires.
- Premium browser pager contract: the results browser should use a compact single-row chevron pager (`« ‹ 1–3 of 8 › »`) across all screen sizes, with icon buttons sized as equal tap targets and the position label carrying the orientation context. Do not revert this to stacked full-width text buttons.
- Proxy timeout contract: analysis-generation routes are not “fast metadata” endpoints. `/api/forecast-child` must use a materially larger upstream timeout budget than 10-second catalog/status proxies, otherwise real forecasts get turned into fake 502s by the frontend worker.
- Child forecast chart spacing contract: on phone widths, the inline forecast bar needs extra bottom padding so the lowest annotation label clears the next subsection heading. Fix overlap by expanding the chart’s own mobile box, not by nudging later content upward.
- The free results page now mirrors the journey vision with a component impact bar, five match cards, measurement comparison tables (with fit bars), and highlight reasoning drawn from each measurement so the narrative stays grounded in the research. Interactive adjustment controls remain deferred until preview endpoints exist.
- Premium/child premium component-impact lists now read raw backend scoring semantics: `raw_weight`, `raw_contribution`, and `score` are authored by the backend scoring policy, while the UI displays those as weight/contribution/score percentages without assuming component weights sum to 1.
- Free, premium, and child-premium result cards render sport detail rows from `optimal_body.subcategory.hierarchy` (ordered array from backend taxonomy seed), not from object-key order. This guarantees YAML-defined order such as `sport -> position`, `sport -> event_family`, and `sport -> discipline -> distance`.
- Result-card `<img>` alt text now uses backend-provided `spec.media.card.alt` (fallback: card title). Canonical source is the selected image `scene_prompt` from the backend publish pipeline (`F_02`/`F_03` -> `published_body_images.alt_text` -> API payload).
- Public drill-down evidence pages now live under `/sport-bodies` and `/sport-bodies/{slug}-{id}`. Result cards include `Read about this sport body` links that route to these pages.
- Drill-down pages render the same top image + sport hierarchy ordering used in results (`sport -> position`, `sport -> discipline -> specialty`, etc.), then expose canonical model evidence sections (measurements, traits, goals, preferences, injuries, past-sport transfer) with reasoning + sources.
- Drill-down `Measurements` tables now include researched ratio factors (`ape_index`, `shoulder_hip_ratio`, `leg_torso_ratio`) with the same reasoning/source contract as other measurements.
- Drill-down `Injuries` now renders three tables (`Risk`, `Prevention`, `Heal`) with taxonomy `Definition` (from `injury_subcategories_catalog`), full reasoning, and clickable source refs that deep-link into the shared `Sources` accordion.
- Drill-down past-sport transfer table reads backend correlation research fields (`correlation_average`, `correlation_std_dev`, `correlation_reasoning`, `correlation_sources`) and shows clickable source refs.
- Drill-down source numbering is global across sections (Measurements -> Traits -> Goals -> Preferences -> Injuries -> Past-sport transfer) so refs never reset per subsection.
- Drill-down `Sources` table now renders canonical citation columns (`Title`, `Authors`, `Year`, `Publisher`, `Use`, `URL`); `short_name` is intentionally not rendered.
- Drill-down disclaimer policy: strong safety/liability notice at top and repeated in footer; pages are indexable and intended for public transparency.
- Child intake primes the deterministic test family (prefilled on preview branches) and collects child + parent measurements plus premium inputs; once a child credit is applied we post to `/api/forecast-child`, read back `run_id`, and render both premium matches and forecast details from the persisted `child_forecast_runs` row in `/child-results` (tabs).
- Child measurement prefill must run against the live `measurementFields` catalog. If the apply helper closes over an empty initial field list, child basics will prefill but child/parent measurement values will silently stay blank.
- Child saved-run re-entry now has one canonical backend read path too: `ChildForecastApp` must request `/api/intake/prefill?subject=child&child_id=...`, and the backend reads the latest `child_forecast_runs.metadata.prefill` bundle. Do not rebuild child prefill from direct Supabase reads, `child_premium_analysis`, or piecemeal metadata keys.
- Logged-in intakes also capture past sports (searchable `sports_subcategories`, using the long-form subcategory `name` such as "Cycling - Road - Climber", plus intensity and enjoyment/flair/skill flags) and sync them to Supabase before saving recommendations.
- Logged-in free users can run and store analyses once `basic_processing` consent is granted; anonymous free runs are preview-only and not persisted as identifiable history.
- The dashboard views stored recommendations (free + premium) alongside updated credit balances so users and guardians can revisit previous analyses.
- The dashboard exposes consent-category controls (`basic_processing`, `sensitive_health_processing`, `child_data_processing`) plus account deletion (permanent account closure with immediate sign-out).
- Dashboard consent revoke behavior now waits for backend purge completion and then refreshes history so visible cards match the final deletion outcome.
- Child forecast history on `/dashboard` is child-linked, not creator-owned: any active guardian linked to the same child sees the same shared child run card.
- Consent revoke deletion mapping (UI contract):
  - `basic_processing`: removes saved adult measurements plus quick/premium adult history.
  - `sensitive_health_processing`: removes saved adult premium analyses and premium input memory.
  - `child_data_processing`: removes stored child forecast/match results immediately, including runs still inside the 7-day window.
- Dashboard privacy now includes a third control for signed-in users: delete all saved measurements/results while keeping account access and consent.
- History cards use a neutral `...` overflow menu for per-run deletion actions; keep destructive emphasis in confirmations/modals rather than always-on red card buttons.
- Dashboard history menus intentionally use visible card overflow plus elevated menu z-layer so the `Delete run` dropdown is never clipped by the card boundary.
- Backend anonymization/deletion hardening now canonicalizes legacy payload variants server-side; frontend endpoint contracts remain unchanged (`/api/consent/revoke`, `/api/account/delete`, `/api/account/delete-status`), but deletion jobs are resilient to malformed historical rows.
- Consent state now comes only from backend status endpoints; the old browser `pending consent` localStorage cache was removed.
- Intake prefill now expects canonical `sports_subcategories.name`; missing names are logged as data issues instead of falling back to nested legacy labels/slugs.
- Ratio scoring contract: adult quick matching is ratio-free; adult premium and child premium include derived ratios (`ape_index`, `shoulder_hip_ratio`, `leg_torso_ratio`) in premium body-fit scoring and premium factor breakdowns.
- Premium results presentation contract: `Body Proportion Factors` renders measurement/ratio metrics only; trait items render only in `Trait Factors` (no duplication across sections).
- Premium ratio display contract: ratio values (`ape_index`, `shoulder_hip_ratio`, `leg_torso_ratio`) are rounded to 2 decimals in premium results UI cards/tables; backend payload precision remains unchanged.
- Result-card CTA alignment contract: free, premium, and child-premium result grids now equalize an unboxed CTA spacer per visual row (helper: `public/assets/js/results-card-alignment.js`) so the `Read more about this body` CTA and the separator line below it align horizontally without stretching the boxed `Sport`/`Athletes' bodies` panels.
- Premium drill-down controls contract: per-card `Collapse all` control is removed; factor accordions now sit under a static section header titled `Match factors`.
- Premium drill-down default-open contract: `Body Proportion Factors` starts expanded by default on initial render for both adult premium and child premium results; other factor sections remain collapsed until opened.
- Premium drill-down heading contract: `Match factors` is styled as a prominent section title with compact spacing to the first accordion panel (no oversized whitespace gap).
- Premium drill-down animation contract: factor accordion bodies use `match-card__accordion-content` with a subtle 180ms `max-height + opacity` transition; users with `prefers-reduced-motion: reduce` get instant open/close (no motion).
- Family dashboard grouping contract: each child now renders as a distinct `family-child-card` (medium-contrast border, subtle tint, and compact child-name header row) with light per-section separators so multi-child lists have clear start/end boundaries.
- Surface Supabase-powered auth/consent flows without persisting any sensitive keys client-side.
- Honour explicit consent before storing measurements, preferences/goals, injuries, or child data; provide preview mode if consent is declined.
- _Current UX scope: full frontend mobile-friendliness is now in scope. Treat desktop and mobile as first-class surfaces, with modern phone widths as the primary responsive anchor for current work._

---

## 2. Architecture Overview

| Layer                             | Responsibilities                                                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astro**                         | Pages live in `src/pages`. Shared chrome (nav, footer, fonts, laurel-mark wordmark) lives in `src/layouts/BaseLayout.astro`. `src/styles/tailwind.css` defines Sporty’s Tailwind tokens/components and exports the shared design preset. |
| **Astro API routes**              | `src/pages/config.js.ts` publishes runtime Supabase config; `src/pages/api/recommend-adult-free.ts` proxies the backend `/v1/recommend-adult-free`; `src/pages/api/recommend-adult-premium.ts` proxies `/v1/recommend-adult-premium`; `src/pages/api/forecast-child.ts` proxies `/v1/forecast-child`; `src/pages/api/credits.ts` proxies `/v1/credits`; `src/pages/api/intake-catalog.ts` proxies `/v1/intake-catalog`; `src/pages/api/sport-bodies.ts` proxies `/v1/sport-bodies`; `src/pages/api/sport-bodies/[targetId].ts` proxies `/v1/sport-bodies/{target_id}`; `src/pages/api/create-checkout-session.ts` starts Stripe Checkout; `src/pages/api/legal/accept.ts` proxies `/v1/legal/accept`; `src/pages/api/legal/status.ts` proxies `/v1/legal/status`; `src/pages/api/account/delete.ts` proxies `/v1/account/delete`; `src/pages/api/account/delete-status.ts` proxies `/v1/account/delete-status`; `src/pages/api/data/delete-all.ts` proxies `/v1/data/delete-all`; `src/pages/api/data/delete-item.ts` proxies `/v1/data/delete-item`; `src/pages/api/healthz.ts` exposes a health endpoint. |
| **Public assets**                 | Vanilla JS (`public/assets/js/*.js`) handles Supabase auth, child flows, and dashboard updates. The adult intake is now powered by the Preact island `src/components/intake/IntakeApp.tsx` plus its premium and past-sports controller modules; both `/intake` and `/intake-premium` hydrate that island, with the premium route toggling the extra steps and credit logic. Child intake itself is now Preact-driven (`src/components/child/ChildForecastApp.tsx`); `child-premium.js`, `child-results.js`, `child-results-premium.js`, `dashboard.js`, `checkout.js`, and `checkout-success.js` still drive their respective flows. `public/assets/js/app.js` is the single shared auth/account-state runtime: hydrate consent + account-delete state once per signed-in user, dedupe in-flight fetches, and notify listeners with coherent snapshots instead of per-request churn. Images and other static assets also live under `public/`. |
| **Cloudflare Worker (generated)** | `astro build` (Cloudflare adapter) emits `dist/_worker.js/index.js`, wiring runtime env, asset serving, and the proxy routes above.                                                                                                          |
| **Backend**                       | FastAPI service (`/v1/recommend-adult-free`) behind the Worker; see backend repo for implementation details.                                                                                                                                    |

`npm run build` produces a server bundle (`dist/_worker.js/**`) plus static assets (`dist/`), ready for `wrangler dev`/`wrangler deploy`.

Primary desktop MVP routes (marketing + app shell):

- `/` — marketing home
- `/about`, `/pricing`, `/terms` — supporting marketing content
- `/intake`, `/results`, `/results/premium` — adult quick match and premium placeholders
- `/dashboard` — logged-in history/credits shell
- `/account` — consent and data privacy controls
- `/sport-bodies`, `/sport-bodies/{target_id}` — public sport-body evidence directory + detail pages; one page per target body/cohort with visible cohort labels.
- `/child-intake`, `/child-results` — guardian flow
- `/checkout/success`, `/checkout/cancel` — Stripe return pages (credit refresh + cancel fallback)

---

## Intake Experience

Both `/intake` and `/intake-premium` hydrate the same Preact island (`src/components/intake/IntakeApp.tsx`), so the form logic, validation, and submission helpers live in one place. The island renders the shared stepper, keeps all intake state in React (basics, measurements, past sports, premium selections), and wires the `Continue`/`See my matches` buttons so the UI always scrolls and focuses the field that needs attention before moving forward.

### Stepper layout & measurement fields

- The free flow walks through three steps: **Basics** (birthday and sex), **Measurements** (catalog-driven body/limb metrics grouped into core, torso, and extremities clusters), and **Past sports** (optional experience history). Each measurement field renders via `MeasurementField`, which uses the shared `NumberStepper` (+/– controls), enforces catalog min/max ranges, shows catalog helper hints, and keeps values synced with the island state so the stepper can validate before unlocking the next page.
- Validation happens before allowing a step change; missing or out-of-bounds inputs trigger `setStatus` errors, focus the offending field, and prevent navigation until the value meets the requirements.

### Past sports

- Users can capture up to five past sports entries. The Past Sports step asynchronously queries Supabase’s `sports_subcategories` (via `SportyApp.getClient()`) to power the search-as-you-type dropdown, while `/api/intake-catalog` now supplies the canonical intensity options plus the boolean field labels/options for `liked`, `had_flair`, and `achieved_skill`. NumberStepper controls allow fractional years so the backend keeps the decimals that power matching.
- Entries stay in component state for quick edits and are cleaned (strip out the UI-only `id` and empty fields) before the payload sends them as `past_sports`, matching the shape declared in `src/data/intakeSchema.ts`.

### Premium inputs & gating

- Navigating to `/intake-premium` adds **Traits**, **Preferences**, **Goals**, and **Injuries** steps before the past-sports section, while `/intake` keeps those controls hidden. Trait question copy/options and measurement field config now load from `/api/intake-catalog` (backend taxonomy source), and selected trait ids (`muscle_fiber`, `metabolic_tendency`, `joint_laxity`, `foot_arch`, `temperature_tolerance`, `handedness`, `footedness`) map into the backend’s `traits` object unchanged.
- The shared `PremiumBlock` and `premiumController` gate the detailed inputs behind credentials. They fetch `/api/credits` to confirm the user has adult analysis credits, query Supabase catalogs for preferences/goals, and load preference, goal, and injury policy blocks from `/api/intake-catalog`; the block only unlocks after data and a positive credit count are available.
- Preferences/goals entries are capped at 20 each and enforce unique catalog selections. Preference priorities and goal priorities are both now backend-canonical from `/api/intake-catalog` (`must_have`, `important`, `nice_to_have` today). Injuries also cap at 20 entries, collect severity, subcategory, and notes, and block duplicate injury-or-subcategory combos; severity options/default now come from the backend injury catalog instead of hard-coded select options. The “Apply one adult analysis credit” toggle must be on before a premium submission will run, and the controller resets/locks the block whenever the credit count drops to zero or the user signs out.
- Injury inputs are not a generic priority-list variant. The adult premium UI must use the dedicated injury controller path so the `severity` select hydrates from `injuries.severity_options`; reusing the generic priority-list wiring will leave the UI stuck on “Loading severities…”.
- The premium summary copy keeps the user informed (credit totals, consent state, whether a credit will apply) and surfaces controller errors through `setStatus` so the form never posts a partial premium selection.
- Premium selections no longer prefill from frontend direct `analysis_inputs` queries; `premiumController` receives canonical prefill only from `IntakeApp`.

### Persistence & submission

- Adult intake prefill is backend-canonical and saved-analysis-only: `IntakeApp` fetches `/api/intake/prefill?subject=adult` and applies partial prefill by field/group (latest qualifying scalar value per field; latest qualifying full list per list-group). Child intake uses the same endpoint family with `subject=child&child_id=...`. Local browser draft auto-restore and profile-based intake prefill were removed to eliminate conflicting sources.
- Intake prefill fetch/apply lifecycle is intentionally split: start the backend prefill request as soon as signed-in identity (and `childId` for child flow) is known, keep the payload in memory, and apply it only after the intake catalog is ready and the request key still matches. Do not re-serialize this back into `catalog fetch -> prefill fetch -> apply`.
- Intake prefill UX rule: lock only the first step while the initial saved-answer check is unresolved, using an in-step loading overlay (`Loading saved answers…`). If prefill fails or times out, unlock the form and show a small inline note; do not allow late-arriving prefill to overwrite user edits after unlock.
- Intake prefill timeout is runtime-owned, not caller-owned. Keep one shared timeout budget in `public/assets/js/app.js`, and size it above the real backend p95 latency; do not hardcode separate `timeoutMs` literals in intake callers.
- Intake prefill must apply only after `/api/intake-catalog` has hydrated the active measurement/trait fields. Basics can arrive earlier, but applying prefill before the catalog exists will silently drop measurement values; do not reintroduce that race.
- Submission combines the validated basics, cleaned measurements, past sports, trait answers (collected directly from the DOM), and premium selections into payloads built by `buildFreePayload` or `buildPremiumPayload`. Free runs post to `/api/recommend-adult-free`, premium runs to `/api/recommend-adult-premium`, and the buttons switch to “Generating…” while the request is in flight.
- Before persisting account history, free and premium intake require `basic_processing`. Premium final step now also renders an inline `sensitive_health_processing` toggle (intent at UI, grant at submit) and blocks submit until that intent is enabled; child flow hard-blocks without `child_data_processing`. Consent grant/revoke uses one backend contract with explicit `consent_type` and no compatibility layer.
- Cutover note: consent state is read strictly from `consents.<type>.granted`; legacy `hasConsent` alias/fallback is removed from the frontend runtime contract.
- Free-flow client persistence writes full adult-required measurement fields (`torso_length_cm`, `wrist_circumference_cm`, plus `ankle_circumference_cm`) so inserts satisfy `measurements_adult_required_extremity_fields_check` and history appears in dashboard.
- Free-flow persistence now validates required adult measurement fields before insert and returns an explicit client-side save failure (`invalid-measurements`) when any required value is missing.

---

## 3. Design System & Tokens

- Typography: use the shared `type-*` utilities in `src/styles/tailwind.css` (display, title, lead, body, small). Buttons, nav, badges, and hero copy all rely on them—don’t hardcode font sizes in components.
- Layout shells: `section-shell`, `card-shell`, and `btn-pill` are the canonical wrappers for section padding, cards, and CTAs. Reuse/extend them instead of adding page-specific styling.
- Landing page sections (hero, pillars, how it works) now compose shared utilities only. Keep future sections consistent with that approach.
- Tailwind’s design tokens and component layer live in `src/styles/tailwind.css`. This file defines palette variables, spacing, shadows, typography tokens (`type-display`, `type-title`, `type-lead`, `type-body`, `type-small`, `type-nav-brand`, `type-nav`), and reusable shells (`btn-pill`, `section-shell`, `card-shell`, etc.). Extend it when you need new primitives so downstream presets stay in sync.
- Avoid reintroducing standalone CSS files; when page-specific tweaks are required, scope them in-place or add a dedicated Tailwind component entry.
- Built-in keyframes and easing live alongside the component layer—reuse those tokens before adding new animation libraries.
- Preline provides optional interactive primitives (modals, accordions). `BaseLayout` ships an inline module that imports Preline once and runs `window.HSStaticMethods.autoInit()` after every load (`DOMContentLoaded`, `astro:page-load`, `astro:after-swap`). Drop the documented `data-hs-*` attributes into markup—no per-page bootstrapping required.
- `BaseLayout` ensures shared fonts, nav layout, and auth controls render identically on every page. Only pass page-specific variations (e.g., nav links, body class, auth visibility) via props.
- `BaseLayout` is also the only approved loader for the shared browser runtime (`@supabase/supabase-js`, `/config.js`, `/assets/js/app.js`). Layout-backed pages may add page-specific scripts, but must not inject the shared runtime again.
- **Avoid `<style>` blocks**: Do not use inline `<style>` blocks in `.astro` files for component styling. They increase specificity unpredictably and can override Tailwind classes. Centralize all component styles (like `.match-card`) in `src/styles/tailwind.css`.
- Reuse utility classes (`.section`, `.grid-cards`, `.card`, `.button`) whenever possible to avoid divergence.
- **Images & Aspect Ratios**: To force a fixed aspect ratio (e.g., 1:1) that resists global resets:
  1. Wrapper: `width: 100%; aspect-ratio: 1/1; overflow: hidden;`
  2. Image: `display: block; width: 100%; height: 100% !important; object-fit: cover;`
- **Tailwind component policy**: Treat the layout helpers in `src/styles/tailwind.css` as constraints, not conveniences. Before reusing one, inspect the underlying grid and max-width settings. When a section needs bespoke sizing (e.g., the landing hero), add a purpose-built component entry in `tailwind.css` so we can reason about width/height limits in one place.
- **Tailwind preset**: `tailwind.sporty-preset.mjs` mirrors the design tokens exported from `src/styles/tailwind.css`. Import it in other projects via Tailwind’s `presets` array to stay aligned with Sporty spacing, colors, and shadows.
- **Landing hero pattern**
  - Layout: use `section-shell` plus responsive Tailwind utilities (grid/flex) for the hero; there’s no bespoke CSS layer anymore, so adjust layout via utilities only.
  - Badge: use the `hero-badge` shortcut (white background, teal border/text) to surface the primary product promise above the headline.
  - Copy: two paragraphs max—first sentence states the biomechanics promise, second can bridge to guardian use cases. Headline always uses the shared `hero-headline` shortcut.
  - CTA: render a single primary action with the `btn-pill btn-pill-primary` shortcut set and anchor it with the `hero-cta` helper so it aligns with the text column. Avoid multiple hero CTAs unless marketing requests otherwise.
  - Visual: hero art must preserve the 16:9 aspect ratio (`hero-visual img`), rely on Supabase-hosted assets keyed via `data-image-key`, and stay within the clamped min/max widths.
- **Process steps module**
  - Use simple grid/flex utilities for process/how-it-works lists; the old `.process__*` helpers were removed.
  - Keep the section left-aligned via `.process-section`; the container width (≈540px) leaves room for complementary content on wider screens.
  - Pair each step with optional 1:1 Supabase imagery by setting `imageKey`/`imageAlt` in the `howSteps` array; assets live under `frontend_images/landing/`.
- **Science content**
  - The landing science block reads from `scienceSection` and `scienceHighlights` in `src/data/landingContent.ts`. Each highlight icon/CTA must stay in sync with the headings on `/science`.
  - The `/science` page is authored directly in `src/pages/science.astro` (no Markdown import). Keep copy updates there and structure citations with the `.science-item-refs` helper so each source renders on its own line.
  - Do not reintroduce the retired `#why` landing section; the science block now carries that narrative.

### Visual Asset Policy
- **Illustrations (generative)**: Use the Sporty illustration pipeline for all human/sport scenes (landing hero, measurement helpers, sport spotlight art, guardian imagery). Maintain the shared backlog outlined in `docs/journeys.md` and store assets in Supabase Storage with descriptive alt text.
- **Data visualizations (engineered)**: Implement charts/tables with code so they stay dynamic, accessible, and themable (component impact bars, radar charts, growth curves, etc.). Provide textual summaries or data tables alongside each visualization.
- **Separation**: never embed analytic data in static images; reserve illustrations for brand storytelling and instructional content.

### Consent UX Policy
- Every intake page must state whether data will be stored; anonymous runs default to “preview only”.
- When a user attempts to save data without existing consent, trigger a modal listing each data class (measurements, preferences/goals, injuries, child data) with purpose explanations and opt-in toggles.
- Provide a “Preview without saving” option so users can decline while still seeing results.
- Surface a persistent consent status indicator (e.g., banner or profile badge) linking to the consent management view where users can revoke or amend choices.
- Log consent actions via the backend with explicit `consent_type`, `policy_version`, and jurisdiction.
- Account deletion requires a destructive confirmation modal (`DELETE` text input), then polls deletion status and signs the user out once complete.
- Data-only deletion requires `DELETE DATA` confirmation and keeps the account signed in.

---

## 4. Data Visualization & Islands

- Use two libraries for charts:
  - **Observable Plot** (ESM) for comparative SVG visuals (stacked/impact bars, radar charts, contribution matrices, growth curves). Pair each chart with a `<table>` fallback for accessibility.
  - **Chart.js** for gauges, donuts, and other canvas-based widgets that benefit from gradients or animation-ready defaults.
- Mount chart components with Astro’s `client:only` hydration. Reach for the `@astrojs/preact` adapter when stateful interactivity is required; otherwise keep islands vanilla.
- Keep chart utilities under `src/components/charts/` for reuse across adult and child journeys.
- Default to existing CSS transitions; defer dedicated animation libraries until post-MVP.

---

## 5. Local Development Workflow

1. `npm install`
2. `npm run dev` to work in Astro’s dev server (`http://localhost:4321`). Fastest loop for layout/content.
3. To test end-to-end with the generated Worker proxy:
  ```bash
  make run-frontend       # builds the Worker bundle and runs local Wrangler at http://127.0.0.1:8787
  ```
   Provide the same env vars as production (API key, Supabase URLs, Stripe publishable key) via `.dev.vars` or Wrangler CLI flags.
4. Run the backend locally with `make run-backend` in `../sporty-backend` so Worker proxy routes resolve against the FastAPI service.
5. Canonical UI verification path: use Playwright-driven browser checks against `http://127.0.0.1:8787`, including mobile-style verification with phone-width viewports and touch-style interaction.
6. QA the child flow by visiting `/child-intake` after seeding the test family (`make seed-test-family` in the backend repo). Preview/test branches auto-prefill the form for faster checks.
7. Legacy `make snap` / Puppeteer scripts are no longer the canonical verification loop; keep docs and future workflow updates Playwright-first.

---

## 6. Environment & Secrets

- **GitHub environments (test / production)**  
  - _Secrets_: `RENDER_API_KEY` (attached by the Worker when proxying to the backend).  
  - _Variables_: `RENDER_URL`, `SUPABASE_URL`, `SUPABASE_STORAGE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `STRIPE_PUBLIC_KEY`. GitHub Actions inject these into the Cloudflare Worker build via `wrangler-action`, letting runtime code reach Render, Supabase, and Stripe Checkout (publishable key only: `pk_test…` in the current environment).
- **Local development**  
  - Mirror these values in `.dev.vars` (consumed by `wrangler dev`) or set them with `wrangler secret put`. Never commit local env files.
- Keep Supabase service-role keys and Stripe secret keys out of this repo. Only publishable keys live in GitHub; private credentials remain in the backend `.env` files or the Render environment.

`/config.js` is generated on each request and exposes the publishable Supabase configuration, storage bucket, and Stripe public key to browser scripts. Always read the values from `window.SPORTY_CONFIG` rather than hard-coding them.

**Data residency note:** current Supabase project region is Sweden (Stockholm, EU). Frontend privacy copy and consent UX should continue assuming EU-resident personal-data storage.

---

## Results Storage Note

- `/results` reads the most recent free analysis from `sessionStorage["sporty:lastResult"]`.
- `/results/premium?id=<recommendation_id>` is run-id driven and fetches the stored premium ranking from `/api/premium-results`; do not reintroduce sessionStorage as the canonical premium-results source.
- `sessionStorage` is still origin-scoped, so free-result previews can appear empty if submit and results load on different origins (e.g. `http://localhost:4321` vs `http://127.0.0.1:8787`).

---

## 7. Deployment & Operations

- Workflow: `.github/workflows/deploy.yml` runs `npm ci` → `npm run build` → `wrangler deploy` for `test` and `main` branches.
- `wrangler.toml` points `main` to `dist/_worker.js/index.js` and serves static assets from `dist/` via the `ASSETS` binding.
- Keep `package-lock.json` committed so CI builds remain reproducible.
- Before merging UI changes, run `npm run build` to catch compile issues and confirm the generated Worker succeeds.
- SEO routing includes `src/pages/sitemap.xml.ts` and `src/pages/robots.txt.ts`; sitemap must include `/sport-bodies` and canonical drill-down URLs.

---

## 8. Backlog (Frontend Focus)

1. Add automated visual regression checks to catch layout drift when design tokens change.
2. Split Supabase auth/UI helpers into ES modules for easier test coverage.
3. Introduce content collections for FAQs and policy pages so marketing edits require less HTML wrangling.
4. Evaluate adding `astro:transitions` or partial hydration for future interactive dashboards once paid flows ship.
5. Keep child-results rendering DB-backed by `child_forecast_runs` run id; do not reintroduce browser-session-only child history.
6. Coordinate with backend when Stripe + credits launch to surface purchase states in the UI.



## 9. Product Journeys

Product navigation journeys and consent journey policy moved to:
- `docs/journeys.md`

## 10. References

- Backend repo: `../sporty-backend`
- Backend compliance baseline: `../sporty-backend/docs/compliance-baseline-gdpr-us.md`
- Worker deploy workflow: `.github/workflows/deploy.yml`
- Shared image catalog: `docs/images/catalog.yaml`
- Design system baseline: `src/styles/tailwind.css`
- Supabase auth helpers: `public/assets/js/app.js`

Update this handbook whenever architecture, runtime routes, deployment steps, or environment expectations change.
