# Sporty Results Design

_Last updated: 2025-11-19_

This document defines the intended design for the **free adult results** page at `/results`. It focuses on how we present matches and, critically, how we explain **why** a body fits certain sports, using the data returned by the backend.

Premium and child results will extend these ideas; this document scopes free adult results only.

---

## 1. Goals

- Help users quickly understand:
  - Which sports they match with (top 3).
  - How strong each match is.
  - Why their body fits those sports.
- Communicate the **reasoning behind the match**:
  - Show how much different factors contribute to the match.
  - Explain why each factor matters at all.
  - Link factors to concrete measurements and traits.
- Use a mix of **words and simple graphics**:
  - Bars, chips, and tables (HTML/CSS-based).
  - Short, research-grounded explanations for each factor.
- Keep the free experience focused on **body + (optional) past sports**; premium factors (goals, preferences, injuries) appear only in premium results.

---

## 2. Backend Inputs (Free Results)

The free results page consumes the JSON payload returned from `POST /v1/recommend-adult-free`. Example (truncated for clarity):

```json
{
  "request": {
    "birthday": "1995-05-15",
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 59.0,
    "arm_span_cm": 170.0,
    "leg_inseam_cm": 80.0,
    "shoulder_width_cm": 44.0,
    "pelvic_bone_width_cm": 98.0,
    "hand_length_cm": 19.0,
    "foot_length_cm": 24.0,
    "past_sports": [],
    "traits": {}
  },
  "suggested_sport": "swimming",
  "total_considered": 8,
  "matches": [
    {
      "score": 0.4509757949717622,
      "score_breakdown": {
        "components": {
          "body": { "score": 0.6442511356739461, "weight": 0.7 },
          "past": { "score": 0.0, "weight": 0.3 }
        },
        "metrics": {
          "height_cm": {
            "user_value": 168.0,
            "cohort_mean": 175.0,
            "cohort_std_dev": 6.0,
            "fit_score": 0.973144963058051
          },
          "arm_span_cm": { "...": "..." }
        },
        "details": {
          "traits": {
            "user": {},
            "body": {
              "muscle_fiber": {
                "value": "slow_twitch_dominant",
                "importance": "high",
                "reasoning": "Distance freestyle relies on endurance..."
              }
            }
          },
          "past_sports": []
        }
      },
      "optimal_body": {
        "sport_slug": "swimming",
        "category_slug": "swimming-freestyle-distance",
        "cohorts": { "sex": "female", "level": "elite" },
        "spec": {
          "overall_description": "Elite female distance freestyle swimmer: tall and lean...",
          "height_reasoning": "Tall stature is commonly observed...",
          "height_importance": "high",
          "arm_span_reasoning": "Arm span near or slightly greater than height...",
          "arm_span_importance": "high",
          "...": "..."
        }
      }
    }
  ]
}
```

Key pieces we rely on:

- `matches[].score` — overall match score (0–1, treated as a percentage on the UI).
- `matches[].score_breakdown.components` — high-level factors (e.g. `body`, `past`) with scores and weights.
- `matches[].score_breakdown.metrics` — per-measurement fit details (user vs cohort mean/std-dev, `fit_score` in 0–1).
- `matches[].score_breakdown.details.traits.body.*` — inferred trait values with `importance` and `reasoning`.
- `matches[].score_breakdown.details.past_sports[]` — (future) per–past-sport contribution and reasoning.
- `matches[].optimal_body.sport_slug` / `category_slug` — identifiers for Supabase taxonomy lookups.
- `matches[].optimal_body.spec` — research spec, including:
  - `overall_description` — narrative description of the body archetype for the sport/subcategory.
  - Per-measurement `*_reasoning` + `*_importance`.
  - Trait-level reasoning and importance.
  - `spec.media.card` — illustration metadata for the card.

The frontend may also query Supabase (or a cached mapping) for:

- **Sport description** from `sports`.
- **Subcategory description** from `sports_subcategories`.

Those descriptions are used directly in the match cards.

---

## 3. Page Layout (Free Results)

Route: `/results`

High-level structure from the user’s perspective:

1. Summary header.
2. Top 3 match cards (each a different sport).
3. Factor contributions panel (top 5 factors + “show all”).
4. (Optional) Measurement comparison details, if we want a denser view.

### 3.1 Summary Header

**Purpose:** Confirm the user is seeing results for their latest run and anchor the page.

- Title: “Your sport matches”.
- Subline: short, neutral summary, e.g. “Based on your measurements and any past sports you shared, here are your top matches.”  
  - We **avoid** extra microcopy here; keep it tight and factual.
- We do **not** show overall next-step guidance here (no “what to do next” block).

### 3.2 Top Matches (3 cards, 3 sports)

**Goal:** Show the three most relevant but distinct sports, with clear fit and explanation, inside each card.

#### Selection rules

- Start from `matches` sorted by `score` descending.
- We want **three cards**, each for a **different sport**:
  - At most one card per `sport_slug`.
  - For each sport, we pick the highest-scoring subcategory (highest `score` for that `sport_slug`).
  - If there aren’t three distinct `sport_slug` values, we show as many unique sports as available (1–3).

#### Card header

For each selected match:

- Header text: the **subcategory display name** from `sports_subcategories.name`, e.g.
  - `Swimming - Freestyle - Distance`
  - `Soccer - Forward - Winger`
  - This single name already encodes sport + role + position, so we don’t prepend a separate sport name.
- Overall fit:
  - Use `matches[i].score` normalized to 0–100% (if ≤ 1, multiply by 100 and round).
  - Display as a percentage badge in the header, e.g. `82% fit`.

#### Card body: descriptions

Each card includes:

- **Subcategory display name**:
  - The `sports_subcategories.name` value, used as the card header.
- **Sport description**:
  - Text from the Supabase sport record (short description of the sport overall, keyed by `sport_slug`).
- **Subcategory description**:
  - Text from the sport subcategory record (role/event/position description, keyed by `category_slug`).
- **Body archetype description**:
  - The `optimal_body.spec.overall_description` text.

These are stacked as a compact description block near the top of the card, giving the user context for what the role is and what bodies tend to look like in that role.

#### Card body: key reasons (chips + bullets)

Each card surfaces the **top 3–5 factors** behind the match:

- Render as “reason chips” and/or short bullet lines inside the card, for example:
  - `Long arms vs cohort`
  - `Shoulder width alignment`
  - `Past: Basketball`
- These chips are derived from the same **factor contributions** described in section 3.3:
  - Top measurements by contribution (e.g. `arm_span_cm`, `leg_inseam_cm`, `shoulder_width_cm`).
  - Top traits by contribution (e.g. `muscle_fiber`, `metabolic_tendency`).
  - Top past sports (if present).

The label for each chip is concise and human-readable; full reasoning appears in the factor panel (see below).

---

## 4. Factor Contributions Panel

**Goal:** Explain, factor by factor, **how much** each factor contributed and **why it matters at all**, with concise text plus lightweight graphics.

This panel is shared across the page (it explains the top match) and is located under the match cards.

### 4.1 Factor model

We treat the following as **factors**:

- **Body measurements** — derived from:
  - `score_breakdown.metrics[*]` (`fit_score`, `user_value`, `cohort_mean`, `cohort_std_dev`).
  - `optimal_body.spec.*_importance` and `*_reasoning` (e.g. `height_importance`, `height_reasoning`).
- **Traits** — derived from:
  - `score_breakdown.details.traits.body.*` entries with `value`, `importance`, and `reasoning`.
- **Past sports** — derived from:
  - Entries in `score_breakdown.details.past_sports[]` (expected to include at least a label, contribution, and reasoning once wired).

**Contribution metric (derived until backend supplies one):**
- If the backend provides `contribution_score`, use it directly.
- Otherwise compute `contribution_score = fit_score_normalized × importance_weight`, where:
  - `fit_score_normalized` is `fit_score` clamped to 0–1 and scaled to 0–100 for display.
  - `importance_weight` maps `high` → 1.0, `medium` → 0.6, `low` → 0.3 (adjustable if backend shares weights).
- Sort factors by this derived score for the top-5/all lists.
- Present the top 5 factors by default; “Show all factors” reveals the remaining entries sorted by contribution.

Each factor row in the UI has:

- A name (e.g. “Height”, “Arm span”, “Muscle fiber composition”, “Past: Basketball”).
- A contribution strength (how much this factor pushed the match up/down).
- An importance tag (e.g. “high”, “medium”, “low”).
- A short reasoning snippet (why this factor matters, not just that it exists).

### 4.2 Top 5 + “Show all factors”

To avoid overwhelming users:

- By default we show the **top 5 factors** across:
  - Body measurements.
  - Traits.
  - Past sports.
- “Top” is defined by contribution magnitude (largest positive or negative effect on the match). The exact contribution metric is a front/back-end contract:
  - Either the backend provides an explicit `contribution_score` per factor, or
  - The frontend derives a contribution score from `fit_score` × importance weight.

UI behavior:

- A list or table of 5 rows:
  - Each row shows a label, a small contribution bar, and an importance tag.
- Beneath the list, a **“Show all factors”** toggle:
  - When activated, the panel “folds out” to reveal the **full list of factors**, again sorted from largest contribution to smallest.
  - Clicking “Hide extra factors” collapses back to top 5.

### 4.3 Per-factor row design

Each factor row includes:

- **Name:** human-readable, e.g.:
  - Measurements: “Height”, “Arm span”, “Leg inseam”.
  - Traits: “Muscle fiber composition”, “Metabolic tendency”.
  - Past sports: “Past: Basketball”.
- **Contribution bar:**
  - A horizontal bar representing contribution strength (0–100%), with a clear direction for positive vs negative influence if available.
  - Example:
    - 80%: strong positive contributor.
    - 20%: mild contributor.
    - 0%: negligible contributor.
- **Importance tag:**
  - Directly from `*_importance` or `importance` fields (`high`, `medium`, `low`).
  - Rendered as a small pill, e.g. `High importance`.
- **Reasoning tooltip/info:**
  - A small info icon (“i”) next to the label.
  - Hover/focus shows a tooltip with the **reasoning text**:
    - Measurements: use `optimal_body.spec.<measurement>_reasoning` (e.g. `height_reasoning`, `arm_span_reasoning`).
    - Traits: use `score_breakdown.details.traits.body.<trait>.reasoning`.
    - Past sports: use `score_breakdown.details.past_sports[i].reasoning` (when available).
  - This text answers “Why does this factor matter at all?” with research-backed language.

Example row (distance freestyle swimmer):

- Label: `Arm span`
- Contribution bar: `88% alignment`
- Importance: `High`
- Tooltip: `"Arm span near or slightly greater than height increases catch length in freestyle and is a common feature in elite swimmers, contributing to distance-per-stroke efficiency without excessive drag."`

### 4.4 Relationship to cards

- The top chips/bullets on each match card are **derived from the top factors**:
  - E.g. if “Arm span” and “Leg inseam” are in the top 5, the card might show chips like:
    - `Strong arm span alignment`
    - `Leg length supports propulsion`
- The factor panel gives the **detailed view**; the cards keep it digestible.

---

## 5. Optional: Measurement Comparison Table

We may keep a compact comparison table for users who want a denser view:

- Columns:
  - Measurement.
  - You (`user_value`).
  - Optimal body (`cohort_mean ± cohort_std_dev`).
  - Fit bar (fit_score as 0–100%).
- Rows:
  - Limited to key measurements (e.g. those in the top 5–10 factors).

This table backs up the factor panel with raw numbers but is not the primary explanation surface.

---

## 6. Empty and Edge States

- **No matches / empty summary**:
  - If `matches` is empty or missing, show a clear empty state:
    - “We couldn’t generate a match. Please try running the intake again.”
  - No factor panel is shown.
- **Partial data**:
  - If some reasoning fields or importance flags are missing:
    - Hide the tooltip/icon for that factor.
    - Fall back to generic wording (“This measurement contributed less to this match.”).

---

## 7. Implementation Notes

- Keep visuals grounded in **simple HTML/CSS**:
  - Bars (contribution, fit) as `div`–based progress strips.
  - Cards and chips styled via the existing component layer in `src/styles/tailwind.css`.
- Prefer server-provided reasoning:
  - Always use backend `*_reasoning` and `importance` strings when present; avoid inventing new reasoning text in the frontend.
- Sorting and top-factor selection happen **per match**:
  - The factor panel is primarily tied to the **top match** shown on the page.
  - Future extensions can allow switching the active match to re-render the factor panel.

This design should give users a clear, research-backed explanation of their free results while staying within the existing Astro + vanilla JS stack and MVP constraints.
