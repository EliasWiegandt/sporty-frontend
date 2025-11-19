# Sporty Intake TODOs

_Last updated: 2025-11-16_

This document breaks the intake redesign into **small, incremental tasks** that a smaller model (such as `gpt-5.1-codex-mini`) or a human can pick up one by one.

Before touching anything:

- Read (or re‑read):
  - `AGENTS.md`
  - `docs/handbook.md`
  - `docs/intake-design.md`
  - `../sporty-backend/docs/handbook.md`
  - `../sporty-backend/docs/VISION.md`

Always keep `docs/intake-design.md` as the **source of truth** for what the intake should collect and how free vs premium flows differ.

Use this checklist as a queue of **micro‑tasks**. Each item should be implemented and validated in isolation, with small, focused diffs.

---

## 0. Guidance for `gpt-5.1-codex-mini`

These tasks are designed so that `gpt-5.1-codex-mini` can execute them reliably. If you are that model (or another smaller model), follow these rules strictly:

- **Always load context first**
  - Before editing code, re-open:
    - `docs/intake-design.md`
    - The specific files mentioned in the TODO item.
  - Do not rely on memory of earlier steps; re-read the relevant sections.

- **Do exactly one item at a time**
  - Pick a single checkbox from this list.
  - Implement only that item (and any explicitly required sub-bullets).
  - Do not “fix nearby things” unless the item explicitly instructs you to.

- **Preserve existing design principles**
  - Reuse:
    - `measurementFields` in `src/data/measurementFields.ts` as the single source of truth for measurements.
    - Shared shells and utilities from `src/styles/tailwind.css` (e.g., `card-shell`, `section-shell`, `btn-pill`, typography tokens).
    - The same core step sequence described in `docs/intake-design.md` (Basics → Measurements → Past sports for free; premium adds steps).
  - Do not introduce new UI patterns when an equivalent shared component or class already exists.

- **Keep forms well-designed**
  - Maintain:
    - Clear headings and short explanatory copy at the top of each step.
    - Grouped measurements (core, torso/width, extremities) as described in `docs/intake-design.md`.
    - Consistent input styles (same number steppers, same combo styles, same spacing).
  - Error messages should be:
    - Short, specific, and located near the input and/or status area.
    - Helpful (“Height must be between 120–230 cm”) rather than vague.

- **Minimize surface area of changes**
  - Prefer adding or editing small functions/components over large refactors.
  - Avoid renaming files, moving directories, or changing public APIs unless the TODO item explicitly requests it.

- **Mirror the backend contract**
  - Never add or remove fields from payloads without cross-checking:
    - `docs/intake-design.md`
    - Backend models in `../sporty-backend/app/main.py` and `../sporty-backend/app/matching/service.py`.
  - When in doubt, keep the frontend payload strictly aligned with `FormData` / `PremiumAnalysisRequest`.

- **Validate after each change**
  - After implementing a task:
    - Re-scan the modified files for obvious type/logic errors.
    - Ensure the new code still matches the patterns and naming in the surrounding file.
  - Do not move on to another checkbox until the current one looks correct and consistent.

---

## 1. Orientation & Validation (no code changes)

- [x] Confirm the current free intake implementation:
  - [x] Inspect `src/pages/intake.astro` to understand structure and what fields/steps exist.
  - [x] Inspect `public/assets/js/intake.js` to understand current stepper logic, validation, draft saving, and submission payloads.
- [x] Confirm measurement definitions:
  - [x] Review `src/data/measurementFields.ts` and note which measurement IDs are currently present.
  - [x] Cross‑check them against the 11 non‑derived measurements listed in `docs/intake-design.md` and the backend (`scripts-ordered/C_04_seed_optimal_body_measurements.py`, `app/main.py`, `app/matching/service.py` in the backend repo).

_Goal:_ you have a clear mental map of today’s intake and the target state described in `docs/intake-design.md`.

---

## 2. Measurement Fields (frontend data only)

**Objective:** Extend the frontend measurement config to cover all 11 non‑derived body measurements. No behavior changes yet.

- [x] Extend measurement configuration:
  - [x] In `src/data/measurementFields.ts`, add a `MeasurementFieldConfig` entry for `torso_length_cm`.
  - [x] In the same file, add `ankle_circumference_cm`.
  - [x] And add `wrist_circumference_cm`.
  - [x] For each new field, choose `min`, `max`, and `step` consistent with backend `FORM_BOUNDS` and realistic adult ranges (see `docs/intake-design.md` and backend `app/main.py`).
  - [x] Add `hint` and `help` text (measurement instructions) aligned with the research tone from the existing fields.
- [x] Confirm ordering and grouping:
  - [x] Ensure the new entries appear in a grouping that matches the logical clusters in `docs/intake-design.md` (e.g., torso/width/extremities).

_Goal:_ `measurementFields` is the single source of truth for all 11 measurement IDs with good UX copy.

---

## 3. Free Intake Markup (Astro only, still using existing JS)

**Objective:** Update the free intake page to display and label all 11 measurements, without changing the stepper behavior yet.

- [x] Wire new measurements into the free intake:
  - [x] In `src/pages/intake.astro`, locate the measurements step (currently maps `measurementFields` into `<MeasurementField />`).
  - [x] Confirm that `measurementMeta` is built from `measurementFields` and passed via `data-measurements` to the form.
  - [x] Verify that adding new entries to `measurementFields` automatically surfaces them in the measurements step. If not:
    - [x] Update the markup so the measurements step renders **all** entries from `measurementFields` (including torso/ankle/wrist) via the same mapping (now handled by the grouped rendering in `MeasurementsStep`).
- [x] Adjust labels / helper text if necessary:
  - [x] Ensure the headings and intro copy in the measurements card acknowledge the extended set (e.g., mention limb, torso, and joint‑girth measurements).

_Goal:_ the `/intake` page visually shows all 11 measurements using the existing `MeasurementField` pattern.

---

## 4. Free Intake Validation & Payload (still vanilla JS)

**Objective:** Ensure the current vanilla JS intake logic validates and sends all 11 measurements for free runs.

- [x] Extend measurement validation:
  - [x] In `public/assets/js/intake.js`, locate the `MEASUREMENT_FIELDS` mapping built from `form.dataset.measurements`.
  - [x] Confirm that the three new fields (`torso_length_cm`, `ankle_circumference_cm`, `wrist_circumference_cm`) appear in `measurementConfig` (they should if `measurementMeta` contains them).
  - [x] Verify that `validateMeasurements(fd)` iterates over all `MEASUREMENT_FIELDS` and enforces `min`/`max` bounds for the new fields without any hard‑coded exclusions.
  - [x] If any field is skipped or treated specially, update the logic so all 11 measurements are required and validated.
- [x] Extend payload building for free flow:
  - [x] Locate `buildSubmissionPayload` in `public/assets/js/intake.js`.
  - [x] Confirm that the object spread `...measurements` includes all 11 IDs from `MEASUREMENT_FIELDS`.
  - [x] Ensure there is no hard‑coded whitelist restricting which measurement keys end up in the payload.
- [x] Smoke‑check (no network needed):
  - [x] Confirm in code that a free run payload would now contain all 11 numeric properties, alongside `birthday` and `sex`.

_Goal:_ free analysis payloads are structurally ready to include the extended measurement set.

---

## 5. Remove Free‑Flow Traits & Tags

**Objective:** Make the free intake strictly body‑plus‑past‑sports only. Traits and tags should not be part of the free `/intake` experience.

- [x] Remove traits UI from free intake:
  - [x] In `src/pages/intake.astro`, identify the "Traits" card/step.
  - [x] Remove that step from the free `/intake` stepper (or hide it behind a premium‑only route).
  - [x] Ensure the stepper nav only lists:
    - Basics
    - Measurements
    - Past sports (optional)
- [x] Stop collecting traits for free runs:
  - [x] In `public/assets/js/intake.js`, identify `TRAIT_FIELDS` and `collectTraitAnswers()`.
  - [x] Ensure that free runs (calls to `/api/recommend-adult-free`) do **not** attach `traits` to the payload.
  - [x] Keep trait logic accessible for future premium use (do not delete; just avoid attaching to free payloads).
- [x] Remove tags usage from frontend:
  - [x] Search in this repo for `tags` in the intake code path.
  - [x] If any tags field is still present in forms, validation, or payload assembly, remove it so the frontend no longer references `FormData.tags`.

_Goal:_ `/intake` is a body‑only + past‑sports flow; traits and tags are not part of free runs.

---

## 6. Premium Input Alignment (data model only)

**Objective:** Prepare clear TypeScript types for premium inputs that match backend expectations, without changing UI yet.

- [x] Create a TypeScript schema for intake data:
  - [x] Add a new file, e.g. `src/data/intakeSchema.ts`.
  - [x] Define `FreeIntakeData` type including:
    - `birthday`, `sex`.
    - All 11 measurement keys.
    - `pastSports` array mirroring `PastSportEntry` shape.
  - [x] Define `PremiumIntakeData` extending `FreeIntakeData` with:
    - `traits` object (keys matching backend trait fields).
    - `preferences`, `goals`, `injuries` arrays mirroring backend payloads (`PreferenceInputPayload`, `GoalInputPayload`, `InjuryInputPayload`).
- [x] Add payload builders (pure functions, no UI yet):
  - [x] Implement `buildFreePayload(data: FreeIntakeData): any` that returns an object compatible with `FormData` for `/v1/recommend-adult-free`.
  - [x] Implement `buildPremiumPayload(data: PremiumIntakeData, userId: string): any` that returns an object compatible with `PremiumAnalysisRequest` for `/v1/recommend-adult-premium`.
  - [x] Ensure these functions include all 11 measurements and do **not** emit `tags` or legacy `preferences: string`.

_Goal:_ the intake data model is explicitly captured in TS, ready to be used by a Preact island or other UI logic.

---

## 7. Preact Island Scaffolding (no behavior yet)

**Objective:** Introduce a minimal Preact Astro island that can eventually replace the vanilla JS stepper, without changing behavior today.

- [x] Add a Preact island entrypoint:
  - [x] Create `src/components/intake/IntakeApp.tsx` (or similar).
  - [x] Implement a minimal component that:
    - Renders a simple placeholder `<div>` (visually hidden) for now.
    - Accepts props for `mode` (`"free"` | `"premium"`) and initial data (optional).
- [x] Mount the island on the free intake page:
  - [x] In `src/pages/intake.astro`, add an Astro island:
    - [x] Wrap the existing form markup in a container like `<div data-intake-root>...</div>` (or decide on a structure).
    - [x] Add `<IntakeApp client:load mode="free" />` in a non‑breaking way (e.g., below existing form) so current behavior remains intact.
  - [x] Ensure imports and paths follow the repo’s conventions.

_Goal:_ Preact is wired into the intake page, but does not control anything yet. No behavior should change.

---

## 8. Gradual Migration: Stepper Logic into Island

**Objective:** Move stepper state and navigation from Preline + vanilla JS into the Preact island, in small steps, while keeping UX stable.

Work in very small increments; after each bullet, confirm behavior still matches the existing intake.

- [x] Copy stepper state into Preact:
  - [x] In `IntakeApp.tsx`, introduce internal state for `currentStepIndex` and total steps.
  - [x] Mirror the current step labels (`Basics`, `Measurements`, `Past sports`) inside the island.
- [x] Render stepper nav from Preact:
  - [x] Replace the static stepper nav buttons in `src/pages/intake.astro` with a Preact‑rendered stepper header inside `IntakeApp`.
  - [x] Keep the existing classes (`btn-pill`, etc.) so styling remains consistent.
- [x] Modernize stepper visuals:
  - [x] Add step numbers or clear active/completed styling to the Preact nav buttons so users can see progress at a glance.
  - [x] Keep layout as a horizontal wizard at the top, but refine small details (e.g., subtle progress indication, clear current step state) without changing the underlying shells.
- [x] Implement navigation rules in Preact:
  - [x] In `IntakeApp`, introduce a `canNavigateTo(targetIndex)` helper that:
    - Allows going back to any previous step.
    - Blocks skipping ahead past the highest completed step.
  - [x] Wire nav button `onClick` handlers to call `setCurrentStepIndex` only when `canNavigateTo` returns `true`.
- [x] Control which step is visible from Preact:
  - [x] Move the per‑step cards (Basics, Measurements, Past sports) into Preact components (e.g., `BasicsStep`, `MeasurementsStep`).
    - [x] Create `BasicsStep` component mirroring the current basics markup (birthday + sex).
    - [x] Create `MeasurementsStep` component mirroring the measurements card and fields.
    - [x] Create `PastSportsStep` component mirroring the past-sports card and template.
  - [x] Ensure only the active step is rendered/mounted based on `currentStepIndex`.
- [x] Wire back/next buttons:
  - [x] Move stepper action buttons into `IntakeApp`.
  - [x] Implement `Next` and `Back` handlers that update `currentStepIndex`.
- [x] Remove Preline stepper dependency:
  - [x] Remove `data-hs-stepper` and related stepper attributes from `src/pages/intake.astro` once Preact fully controls nav and step visibility.
  - [x] Delete `setupStepperGuards`, `setupStepperNavShortcuts`, and other Preline stepper glue from `public/assets/js/intake.js` once they are no longer used.

_Goal:_ the visual stepper and step visibility are fully controlled by Preact, with the same steps as before; vanilla `hs-stepper` is no longer relied on for navigation.

---

## 9. Gradual Migration: Validation, Drafts, and Submission into Island

**Objective:** Move core behaviors from `public/assets/js/intake.js` into the Preact island, then remove the old JS file once parity is achieved.

Do this in small, testable chunks:

- [x] Migrate measurement validation:
  - [x] Port `validateBasics` and `validateMeasurements` logic into pure helpers in `IntakeApp` (or a separate module).
  - [x] Use the TypeScript schema from `intakeSchema.ts` for types.
  - [x] Wire these validators into the `Next` button so users cannot advance with invalid data.
- [x] Migrate draft save/restore:
  - [x] Port `restoreDraft()` and `saveDraft()` behavior into the island (using a new or reused `STORAGE_KEY`).
  - [x] Ensure that changing inputs in Preact triggers `saveDraft` and that revisiting `/intake` restores the draft into state.
- [x] Migrate submission:
  - [x] Implement a `handleSubmitFree()` inside `IntakeApp` that:
    - Builds the payload via `buildFreePayload`.
    - Calls `/api/recommend-adult-free`.
    - Handles success by writing to `sessionStorage` and redirecting to `/results`.
    - Handles errors by showing status messages in the UI.
  - [x] Use `window.SportyApp` for auth/consent and optional `saveRecommendation`, mirroring the existing logic.
- [x] Remove old JS once parity is achieved:
  - [x] After verifying that the Preact‑driven intake behaves identically to the old one, remove `<script src="/assets/js/intake.js">` from `src/pages/intake.astro`.
  - [x] Delete `public/assets/js/intake.js` once no other page depends on it (confirm via search).

_Goal:_ `/intake` is fully powered by the Preact island; vanilla `intake.js` is no longer needed.

---

## 10. Premium Intake Page & Behavior

**Objective:** Introduce a premium intake page that reuses the same island with `mode="premium"` and adds premium steps (traits, preferences, goals, injuries).

- [x] Create a premium intake page:
  - [x] Add `src/pages/intake-premium.astro` (or a similar route as decided in `intake-design.md`).
  - [x] Wrap it in `BaseLayout`, mirroring `/intake`.
  - [x] Mount `<IntakeApp client:load mode="premium" />` on this page.
- [x] Implement premium‑mode behavior in the island:
  - [x] In `IntakeApp`, branch on `mode` to:
    - Show traits, preferences, goals, and injuries steps only in `"premium"` mode.
    - Keep free mode limited to Basics + Measurements + Past sports.
  - [x] For premium mode:
    - Use `PremiumIntakeData` type.
    - Use `buildPremiumPayload` for submission.
    - Require `userId` (via `SportyApp`); if missing, prompt login.
- [x] Wire upgrade paths:
  - [x] Ensure the free results page links to the premium intake (e.g., CTA “Upgrade for detailed analysis” goes to the new route).
  - [x] Ensure the dashboard has a path to start a new premium analysis.

_Goal:_ There is a distinct premium intake experience wired into the app that shares logic with the free flow but adds premium steps and payloads.

---

## 11. Cleanup & Documentation

- [x] Remove dead code and references (no old stepper helpers, trait-only fragments, or `tags` references remain after the island take-over).
- [x] Update documentation:
  - [x] Update `docs/handbook.md` to reference:
    - The split between free and premium intake pages.
    - The full list of 11 measurements.
    - The fact that traits/preferences/goals/injuries are premium‑only.
  - [x] Update `README.md` (frontend) with a short note on the Preact island powering the intake and where to look for its code.
  - [x] If any backend contracts change, update the backend docs (`../sporty-backend/docs/handbook.md`) accordingly.

_Goal:_ The codebase and docs agree on how the intake works; new contributors can follow `intake-design.md` and this TODO list to make further changes safely.