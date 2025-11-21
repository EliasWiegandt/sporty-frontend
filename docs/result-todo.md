# Sporty Results – Free Results TODO

High-level TODO list derived from `docs/results-design.md` for the `/results` page (free adult results).

## Backend / Contract

- [x] Confirm the `POST /v1/recommend-adult-free` response shape matches the design:
  - [x] `matches[].score` is 0–1 and can be treated as percentage.
  - [x] `matches[].score_breakdown.components` includes at least `body` and (when available) `past` with `score` and `weight`.
  - [x] `matches[].score_breakdown.metrics` entries include `user_value`, `cohort_mean`, `cohort_std_dev`, and `fit_score` for key measurements.
  - [x] `matches[].score_breakdown.details.traits.body.*` entries include `value`, `importance`, and `reasoning`.
  - [x] `matches[].score_breakdown.details.past_sports[]` (future) include at least a label, contribution, and `reasoning`.
  - [x] `matches[].optimal_body.spec` includes `overall_description`, per-measurement `*_reasoning` + `*_importance`, trait reasoning/importance, and `spec.media.card`.
- [x] Expose or document a per-factor **contribution metric** (or a clear recipe to derive it) so the frontend can rank factors by contribution. _Documented derivation in `docs/results-design.md`: contribution_score = fit_score (0–1) × importance weight (high=1.0, medium=0.6, low=0.3); use backend-supplied value if it appears._
- [ ] Ensure `sports` and `sports_subcategories` tables expose concise descriptions the frontend can consume. _Backend payload only returns slugs; requires Supabase lookups or an added description field._

## Data Mapping & Utilities

- [x] Implement utilities to:
  - [x] Normalize overall scores (0–1 → 0–100%). _(see `normalizePercentValue` in `public/assets/js/results.js`)_ 
  - [x] Map measurement keys (e.g. `height_cm`) to human labels (“Height”). _(MEASUREMENT_LABELS in `public/assets/js/results.js`)_ 
  - [x] Map traits keys (e.g. `muscle_fiber`) to human labels (“Muscle fiber composition”). _(TRAIT_LABELS in `public/assets/js/results.js`)_ 
  - [x] Convert importance values (`high`/`medium`/`low`) into UI tags. _(mapImportance helper)_ 
  - [x] Combine measurement fit scores and importance into a single **factor contribution score**. _(normalizeContribution: fit_score clamped 0–1 × importance weight)_ 
  - [x] Derive per-trait and per–past-sport contribution scores using importance and any provided weights. _(same normalizeContribution helper applies; hooks ready for trait/past-sport factors)_ 

## Top Matches Selection & Card Content

- [x] Implement top-match selection for the free results page:
  - [x] Sort `matches` by `score` descending.
  - [x] Group by `sport_slug` and keep the highest-scoring subcategory per sport (first encountered in sorted order).
  - [x] Select up to three distinct sports for display (1–3 cards).
- [x] For each selected match, populate the card header:
  - [x] Look up the subcategory display name from `sports_subcategories.name` (by `category_slug`) when available via Supabase.
  - [x] Use this single string as the card header (fallback to `category_slug`/`sport_slug`).
  - [x] Show overall fit percentage badge derived from `matches[i].score`.
- [x] For each card, populate descriptions:
  - [x] Fetch and render sport description (from `sports`, keyed by `sport_slug`) when available; fallback to spec/summary.
  - [x] Fetch and render subcategory description (from `sports_subcategories`, keyed by `category_slug`) when available.
  - [x] Render `optimal_body.spec.overall_description` as the body archetype description fallback.
- [x] For each card, surface key reasons:
  - [x] Use top measurement factors (fit_score + importance) to generate chips.
  - [x] Include past sport tags when present.
  - [x] Keep labels short/human-readable; aligns to factor panel mapping.

## Factor Contributions Panel (Top Match)

- [x] Implement a factor panel tied to the **top match**:
  - [x] Collect candidate factors from:
    - [x] Body measurements (`score_breakdown.metrics` + labels/importance).
    - [x] Traits (`score_breakdown.details.traits.body.*`).
    - [x] Past sports (`score_breakdown.details.past_sports[]` when available).
  - [x] Compute a contribution score for each factor (fit_score × importance weight) with backend value override if present.
  - [x] Sort factors by contribution descending.
- [x] Default view:
  - [x] Display the **top 5 factors** across measurements, traits, and past sports.
  - [x] For each factor row:
    - [x] Show factor label (measurement/trait/past sport).
    - [x] Show a contribution bar (0–100%).
    - [x] Show an importance tag (high/medium/low).
    - [x] Include an info icon using reasoning text when available.
  - [x] Use reasoning text from:
    - [x] Measurements: reasoning field if provided (fall back to none).
    - [x] Traits: `score_breakdown.details.traits.body.<trait>.reasoning`.
    - [x] Past sports: `score_breakdown.details.past_sports[i].reasoning` (if present).
- [x] “Show all factors” behavior:
  - [x] Toggle beneath the list to reveal all factors sorted by contribution.
  - [x] Collapse back to top 5.

## Optional Measurement Comparison Table

- [x] Keep the measurement comparison table on `/results`, hidden by default.
- [x] When the user clicks “Show all factors,” expand to reveal the full factor list *and* this table; collapse hides extras again.
- [x] Limit rows to measurement factors (capped at top 10).
- [x] Render columns: Measurement, You (`user_value`), Optimal (mean ± std-dev), Fit bar (fit_score%).
- [x] Table is visually secondary to the factor panel and tied to the same toggle.

## Empty & Edge States

- [x] Implement clear empty state when `matches` is empty or missing:
  - [x] Message: “We couldn’t generate a match. Please try running the intake again.”
  - [x] Hide match cards, factor panel, and measurement table in this state.
- [x] Handle partial data gracefully:
  - [x] If a factor lacks reasoning, the tooltip/info icon is suppressed.
  - [x] Default importance falls back to `medium` when missing.

## Styling & UX Polish

- [ ] Update `/results` layout to match the new structure:
  - [ ] Summary header with concise subline (no extra microcopy or “what to do next” block).
  - [ ] Three-card grid for top matches (responsive auto-fit behavior).
  - [ ] Factor contributions panel beneath cards.
  - [ ] Optional measurement comparison section beneath factor panel.
- [ ] Style contribution bars, chips, and importance tags using the existing Tailwind component layer in `src/styles/tailwind.css`.
- [ ] Ensure tooltips are accessible (keyboard focus, ARIA attributes).
- [ ] Verify layout remains desktop-first but reasonably responsive on smaller screens.
