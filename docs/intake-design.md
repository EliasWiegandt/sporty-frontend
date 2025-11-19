# Sporty Intake Design

_Last updated: 2025-11-16_

This document defines the product, UX, and technical design for Sporty’s adult intake flows. It is the canonical reference for how we collect body measurements and related context for:

- **Free adult analysis** — `/intake`
- **Premium adult analysis** — separate premium intake page (route TBD, e.g. `/intake/premium` or `/intake?mode=premium`)

Child / guardian flows are covered in the front‑ and backend handbooks and are out of scope here except where they reuse the same body model.

The goal is to support a **clean, stable, and easy‑to‑maintain multi‑step form** that a small model can work on incrementally (TODO list), while staying tightly aligned with the backend contracts and measurement research.

---

## 1. Design Goals

- **Single source of truth for fields**: every intake field maps directly to backend models (`FormData`, `PremiumAnalysisRequest`) and the matching engine’s measurement keys.
- **Two clear products**:
  - `/intake` — free, body‑only analysis (+ optional past sports).
  - Premium intake — extends the free data with traits, preferences, goals, and injuries; kept out of the free flow.
- **Anthropometry first**: collect the full non‑derived measurement set required by the matching engine, once, with high‑quality helpers.
- **Premium signals feel special**: traits and premium inputs are visually differentiated and only appear behind credit / login gates.
- **Implementation simplicity**: minimal moving parts, easy to reason about, and easy to modify via small TODOs.
- **Consistency with existing system**: reuse existing styling (Tailwind component layer, shells), Preline primitives, and Supabase integration.

---

## 2. Backend Contracts & Required Measurements

The backend treats the following as the **canonical adult body measurement set**. These keys are seeded into `optimal_body_measurements` via `scripts-ordered/C_04_seed_optimal_body_measurements.py` and are used by the matching engine (`MEASUREMENT_KEYS` in `app/matching/service.py`).

### 2.1 Non‑derived measurement keys

These are the **base anthropometric inputs** we must either collect from the user or safely infer:

- `height_cm` — standing height.
- `weight_kg` — body weight.
- `arm_span_cm` — fingertip‑to‑fingertip span with arms extended horizontally.
- `leg_inseam_cm` — inner leg length from crotch to ankle bone.
- `shoulder_width_cm` — biacromial shoulder width.
- `hip_width_cm` — hip width across the widest point.
- `hand_length_cm` — distance from wrist crease to tip of middle finger.
- `foot_length_cm` — heel‑to‑toe length of the longest toe.
- `torso_length_cm` — vertical distance approximating seated or torso length (see UX notes below).
- `ankle_circumference_cm` — ankle girth.
- `wrist_circumference_cm` — wrist girth.

These are backed by bounds in `FORM_BOUNDS` and mapped into reference‑population columns via `MEASUREMENT_MAP` in `app/main.py`.

### 2.2 Derived ratios (not directly asked)

The matching engine derives several **ratio measurements** via `derive_ratio_measurements` in `app/matching/traits.py`:

- `ape_index` — `arm_span_cm / height_cm`.
- `shoulder_hip_ratio` — `shoulder_width_cm / hip_width_cm`.
- `leg_torso_ratio` — `leg_inseam_cm / torso_length_cm`.

These ratios should **not** be collected directly in the intake; they come from the base fields above and are seeded as derived entries into `optimal_body_measurements`.

### 2.3 Other payload pieces

For adults, the relevant backend models are:

- `FormData` (free analysis)
  - Required: `birthday`, `sex`, the 11 non‑derived measurements above.
  - Optional: `past_sports[]`, `traits{}`.
  - Legacy: `preferences: str`, `tags: string[]` (no longer used by the frontend; see below).
- `PremiumAnalysisRequest` (premium analysis)
  - Required: `user_id`, `birthday`, `sex`, the same 11 measurements.
  - Optional: `past_sports[]`, `traits{}`.
  - Premium payload: `premium.preferences[]`, `premium.goals[]`, `premium.injuries[]`.

**Design decision:**  
The new intake design treats:

- `tags` and free‑form `preferences` on `FormData` as **unused / legacy**; the intake will not expose or populate them.
- `traits` as a **premium‑only** signal: free runs never collect or send trait answers.

---

## 3. Product Vision: Two Intake Pages

### 3.1 Free adult intake (`/intake`)

Purpose:

- Provide a **fast, friction‑light** way for adults to get body‑fit sport matches for free.
- Collect the full, research‑backed body measurements to power accurate matching.
- Optionally collect past sports to feed correlations, without surfacing premium‑only questions.

Key characteristics:

- No traits, no preferences/goals/injuries — those belong to premium.
- Requires login only if the user wants to **save** runs; anonymous runs are still allowed.
- Uses the same 11 measurement keys as premium; nothing “reserved” for paid tiers at the measurement level.
- Includes optional past sports with the existing richness (years played, intensity, flair/skill, etc.).

### 3.2 Premium adult intake (separate page)

Purpose:

- Turn the free experience into a **deeper premium analysis** by layering on:
  - Traits (physiological cues).
  - Goals and preferences.
  - Injury history.
  - Past sports (reused from free, but surfaced as an explicit component in premium scoring).

Key characteristics:

- **Requires login + credit.**
- Reuses the same base measurements as the free flow, prefilled where possible.
- Adds premium‑only steps:
  - Trait questions.
  - Preferences.
  - Goals.
  - Injuries.
- Payload is sent to `/api/recommend-adult-premium`, which the Worker forwards to `/v1/recommend-adult-premium`.

UX relationship between the two:

- A user can:
  - Start with the free intake, view free results, then “Upgrade to premium analysis” which preloads the premium intake with the same measurements.
  - Or, go directly to the premium intake from Pricing or Dashboard.

---

## 4. Proposed Tech Stack

The current intake relies on:

- Server‑rendered Astro page (`src/pages/intake.astro`).
- Preline’s `hs-stepper` and combo components (via `data-hs-*` attributes).
- A large vanilla JS file (`public/assets/js/intake.js`) that coordinates:
  - Stepper behavior.
  - Validation.
  - Draft persistence in `localStorage`.
  - Supabase auth/consent integration (`window.SportyApp`).
  - Free vs premium submission toggling.

This works but is becoming **hard to reason about** and evolve. For the new design, we want a stack that:

- Keeps Astro’s strengths for SSR and routing.
- Keeps Tailwind + existing shells (`card-shell`, `btn-pill`, etc.).
- Keeps Preline for low‑level widgets (combo boxes, number steppers) where it adds value.
- Improves the structure and testability of the multi‑step form logic.

### 4.1 Architecture

**Core idea:**  
Move the multi‑step form state into a **single Preact Astro island**, while leaving most markup and styling in `.astro` templates and Tailwind component classes.

Concretely:

- **Astro pages**
  - `src/pages/intake.astro` — free intake shell.
  - `src/pages/intake-premium.astro` (or similar) — premium intake shell.
  - Each page:
    - Provides SEO, layout (`BaseLayout`), and top‑level structure.
    - Renders a root `<div data-intake-root>` where the island mounts.
    - Includes non‑interactive copy (headings, body text) directly in Astro.

- **Preact island (`src/components/intake/IntakeApp.tsx`)**
  - Hydrated on both pages with `client:load` or `client:visible`.
  - **Centralized State:** Holds the master state for `basics` (birthday, sex), `measurements` (height, weight, etc.), and `pastSports`.
  - **Controlled Components:** Renders steps (`BasicsStep`, `MeasurementsStep`, `PastSportsStep`) as fully controlled components, passing down `value` props and receiving updates via `onChange` callbacks. Lower-level inputs like `MeasurementField` and `NumberStepper` are also fully controlled.
  - **State-Based Validation:** Runs validation logic directly against the state objects (not the DOM or `FormData`), ensuring reliable navigation and data integrity.
  - **Responsibilities:**
    - Orchestrate step navigation.
    - Manage form state and validation.
    - Read/write local draft state (via `localStorage`).
    - Coordinate with `window.SportyApp` for auth/consent.
    - Construct final JSON payloads.

- **Preline + vanilla helpers**
  - Preline’s styling classes are used for visual consistency.
  - Complex interactive widgets (steppers, custom dropdowns) are implemented as Preact components to avoid conflicts with Preline's imperative DOM logic.

### 4.2 Why Preact island over pure vanilla

Pros:

- **Centralized state**: a single source of truth for all intake values instead of many DOM queries and custom events.
- **Typed data model**: we can mirror `FormData` / `PremiumAnalysisRequest` in TypeScript, making it harder to accidentally drift from the backend contract.
- **Reliable Validation:** Validating state objects eliminates race conditions and synchronization issues common with DOM-based validation.
- **Better for small models**: the code naturally decomposes into small, testable pieces (e.g. `buildFreePayload`, `validateMeasurementsStep`, `MeasurementsStep` component).

Cons (and mitigations):

- Slightly more JS bundle for the island vs pure vanilla:
  - Limited to the intake pages; other pages remain static.
  - Preact is small and Astro is already optimized for this pattern.

### 4.3 Supporting modules & Verification

To keep the island simple and reusable, we use:

- `src/data/intakeSchema.ts`: TypeScript types and payload builders.
- `src/components/intake/steps/*`: Presentational Preact components for each step.
- `scripts/snap_intake_flow.js`: A Puppeteer script that automates walking through the intake flow (filling basics, measurements, past sports) and taking screenshots at each step. This ensures the flow logic and UI are working correctly.

---

## 5. Free Intake: Element‑by‑Element Design

This section describes the free intake (`/intake`) in detail.

### 5.1 Step structure

Free intake aims for a **compact but complete** flow:

1. **Basics**
   - Birthday and sex.
2. **Body measurements**
   - All 11 non‑derived measurements, grouped into logical clusters to keep the step manageable.
3. **Past sports (optional)**
   - Same semantics as today: up to five sports with intensity and flair/skill flags.

We intentionally **do not** surface traits, preferences, goals, or injuries in the free intake.

### 5.2 Basics step (Free)

Fields:

- `birthday` (required)
  - Input: date picker.
  - Validation:
    - Non‑empty.
    - Reasonable age range (e.g. 16–80 years for adult intake; actual bounds to be aligned with backend).
- `sex` (required)
  - Options:
    - `female`
    - `male`
    - `other`
    - `prefer_not_to_say`
  - Component:
    - Preline combo or pill‑style radio set.
  - Validation:
    - Non‑empty.
    - Must map to the backend’s `Literal["male", "female", "other", "prefer_not_to_say"]`.

Copy:

- Short explanation that birthday and sex are used to place the user into the right reference cohort; no gender identity assumptions.

### 5.3 Measurements step (Free)

Goal: collect all 11 non‑derived measurements with helpful guidance, while avoiding overwhelming the user.

Grouping (tentative):

- **Core linear metrics**
  - `height_cm`
  - `weight_kg`
  - `arm_span_cm`
  - `leg_inseam_cm`
- **Width and length**
  - `shoulder_width_cm`
  - `hip_width_cm`
  - `torso_length_cm`
- **Extremities**
  - `hand_length_cm`
  - `foot_length_cm`
  - `ankle_circumference_cm`
  - `wrist_circumference_cm`

Implementation:

- Reuse the existing `MeasurementField` component as the base.
- Extend `measurementFields` in `src/data/measurementFields.ts` to cover:
  - `torso_length_cm`
  - `ankle_circumference_cm`
  - `wrist_circumference_cm`
  - Each with:
    - Sensible `min`, `max`, `step`.
    - Hints and measurement instructions aligned with the research docs.
- Use the same numeric +/− steppers and helper text pattern for all measurements.

Validation:

- Each field is required for free runs.
- Enforce the backend’s `FORM_BOUNDS` ranges (or stricter UI ranges where needed), with clear error messages:
  - “Enter your [label] before continuing.”
  - “[Label] must be between X and Y cm/kg.”

### 5.4 Past Sports step (Free)

Fields per sport (as today):

- `sport_subcategory_id` (hidden id selected via search).
- `years_played` (0–80, half‑year increments).
- `age_started_years` (0–80, year increments).
- `intensity` (`light`, `moderate`, `intense`, `elite`).
- `liked` (yes/no).
- `had_flair` (yes/no).
- `achieved_skill` (yes/no).

Behavior:

- Allow up to five entries.
- All fields are optional; empty list is valid.
- When the user is logged in and has consent, these will be persisted via `SportyApp.saveRecommendation` with the free result.

UX:

- Short explanation that past sports help the system learn which bodies align with which sports.
- Emphasize that this step is optional and can be skipped.

---

## 6. Premium Intake: Element‑by‑Element Design

The premium intake extends the free flow with additional steps. The exact route will be documented once finalized (for now we assume `src/pages/intake-premium.astro`).

### 6.1 Step structure (Premium)

Proposed structure:

1. **Basics & measurements**
   - Same fields as free intake, prefilled if coming from a recent free run or from saved profile data.
2. **Traits (premium only)**
   - Trait questions currently defined in `src/pages/intake.astro` are moved here.
3. **Preferences**
   - Premium preference selections (ids + priority).
4. **Goals**
   - Training / outcome goals (ids + priority).
5. **Injuries**
   - Injury history entries with severity and subcategory.
6. **Past sports**
   - Same as free, but explicitly framed as contributing to the premium match.

### 6.2 Traits step (Premium only)

Fields (logical keys as used by the matching engine):

- `muscle_fiber`
- `metabolic_tendency`
- `joint_laxity`
- `foot_arch`
- `temperature_tolerance`
- `handedness` / `sport_side` → combined into a `dominant_side` signal for the backend.

Implementation:

- UI options and helper copy can be ported from the existing trait cards in `src/pages/intake.astro`.
- In the premium island:
  - Store answers in a `traits` object keyed by the backend trait names.
  - Attach `traits` only to the premium payload.

Design rule:

- Free intake must **not** show these questions; traits are part of the premium value proposition.

### 6.3 Preferences, goals, and injuries (Premium)

Preferences:

- Map to backend `PreferenceInputPayload` entries:
  - `preference_id` (required).
  - `priority` (`must_have` or `nice_to_have`).
- UI:
  - List or picker of preference chips; each chip toggles selection and priority.

Goals:

- Map to `GoalInputPayload`:
  - `goal_id`, `priority`.
- UI:
  - Similar chip or checkbox layout, grouped by category (performance, enjoyment, aesthetics, etc.).

Injuries:

- Map to `InjuryInputPayload`:
  - `injury_id` (required).
  - Optional: `injury_subcategory_id`, `notes`.
  - `severity` (`severe`, `somewhat_bad`, `mostly_healed`).
- UI:
  - Addable list of injury entries (similar pattern to past sports).

Payload:

- The Preact island constructs:

```ts
premium: {
  apply_credit: true,
  preferences: PreferenceInputPayload[],
  goals: GoalInputPayload[],
  injuries: InjuryInputPayload[],
}
```

and sends it to `/api/recommend-adult-premium`.

---

## 7. Consent, Auth, and Storage

The intake must continue to follow the consent rules from the handbooks:

- Free runs can be anonymous and **do not** persist sensitive data by default.
- Logged‑in users:
  - Measurements and results are stored only when consent is granted.
  - Premium runs involving injuries/child data require the elevated consent tier.

Implementation notes for the island:

- Use `window.SportyApp` for:
  - Auth snapshots (`user`, `hasConsent`).
  - `ensureConsent()` prompts when needed.
  - `saveRecommendation()` after successful analysis.
- Respect the existing patterns from `public/assets/js/intake.js`, but centralize the logic inside the Preact component.

---

## 8. Summary

- The backend now relies on **11 non‑derived body measurements** (including `torso_length_cm`, `ankle_circumference_cm`, `wrist_circumference_cm`) plus derived ratios.
- The new intake design will:
  - Collect all 11 measurements in the **free intake**, plus optional past sports.
  - Reserve **traits, preferences, goals, and injuries** for a **separate premium intake**.
  - Stop exposing legacy `tags` and free‑form `preferences` from `FormData`.
- Technically, we move the multi‑step form logic into a **single Preact Astro island**, keeping Astro + Tailwind + Preline for structure and styling, and mirroring backend models in TypeScript.

Next step: create a separate `intake-todo.md` (or similar) with a granular, model‑friendly TODO list that references this document and the relevant files in `src/` and `public/`.

