# Sporty Frontend – Tailwind & Preline Migration Plan

This checklist tracks the work required to replace the current Open Props + UnoCSS + Webcore UI stack with Tailwind CSS + Preline. We’re standardising on Tailwind for tokens/utilities, using Preline for interactives, and phasing out legacy styling so every surface pulls from one consistent system. We’ll start with Tailwind’s native theme tokens (colors, spacing, etc.), alias them to Sporty semantic names, and only introduce custom tokens when the defaults fall short. Core brand cues like the dark teal palette and pill-shaped primary/secondary CTAs stay intact—just expressed through the new Tailwind tokens. The current Tailwind landing becomes our source of truth, keeping bespoke refinements (e.g. the tuned hero) while swapping hard-coded values for shared tokens.

---

## 1. Architecture & Foundation

- [ ] Define Sporty Tailwind tokens (colors, spacing, radius, typography, shadows) inside the `@theme` block and commit the canonical set.
- [ ] Move shared primitives into Tailwind layers: typography defaults in `@layer base`, reusable patterns (`btn-pill`, `section-shell`) in `@layer components`, and one-off helpers in `@layer utilities`.
- [ ] Extract a reusable Tailwind preset/config (`tailwind.sporty-preset`) so islands or future apps can share the same tokens.
- [ ] Record these decisions (tokens, layering, preset usage) in `docs/handbook.md`, `README.md`, and `FRONTEND_TODO.md` for future contributors.

- [ ] Keep the Sporty dark-teal brand palette as the primary color family (map Tailwind emerald/teal tokens to `brand-*`).
- [ ] Ensure the pill-shaped primary/secondary CTAs remain the canonical button style, expressed via Tailwind component classes.

- [ ] Update docs once the migration is complete (README, docs/handbook.md, AGENTS.md, FRONTEND_TODO.md) with Tailwind/Preline setup notes.
- [ ] Switch the Tailwind landing (`src/pages/landing-tailwind.astro`) to be the default `/` page and back up/remove the legacy landing implementation.

- [ ] Confirm Tailwind/PostCSS config aligns with production build tooling (purge paths, plugins, `tailwind.config.js` tokens).
- [ ] Document the Tailwind design tokens (brand palette, typography scale, spacing, radius, shadows) and update `docs/handbook.md` + `README.md`.
- [ ] Decide how to ship Preline JS (global import vs. lazy component import) and document initialization patterns (e.g., `window.HSStaticMethods.autoInit()`).
- [ ] Remove UnoCSS integration from `astro.config.mjs` once no longer used; update build commands and CI/caching notes.
- [ ] Replace Webcore integration and audit any runtime dependencies (modals, accordions, etc.) that need Tailwind/Preline equivalents.

## 2. Layout & Components

- [ ] Inventory all global styles (`src/styles/*.css`, Uno shortcuts) and flag replacements needed in Tailwind (base layer vs. component layer).
- [ ] Rebuild shared layout primitives (`BaseLayout`, nav, footer) in Tailwind + Preline; ensure responsive breakpoints match existing UX.
- [ ] Replace Webcore UI components page-by-page with Tailwind/Preline implementations (modals, accordions, badges, grids).
- [ ] Create a small internal component library (buttons, cards, section shells, chip styles) in Tailwind for reuse across pages.
- [ ] Validate hero sections and CTA bars to confirm spacing, sticky behavior, and Preline animations work as expected.

## 3. Page-by-Page Migration

- [ ] Home / Landing (`landing-tailwind` → eventual `/`): finish layout, imagery, and consent copy; remove legacy landing markup when ready.
- [ ] Preserve bespoke hero refinements when promoting `landing-tailwind` to `/`, replacing hard-coded values with shared tokens instead of reverting the UX.
- [ ] Preserve bespoke hero refinements when promoting `landing-tailwind` to `/`, swapping hard-coded values for shared tokens instead of reverting the UX.
- [ ] Pricing, Intake, Results, Dashboard, Account, Terms/Privacy pages: port each to Tailwind, removing UnoCSS classes and Webcore components.
- [ ] Authentication flows (buttons, forms, modals) – ensure Tailwind handles focus states, error messaging, and Preline JS components.
- [ ] Child/Guardian flows (tables, stepper forms, cards) – rebuild layout using Tailwind grid utilities and Preline components.
- [ ] API route templates or Astro API responses that inject HTML – ensure any inline styles or class names match new Tailwind conventions.

## 4. Assets & Utilities

- [ ] Update `public/assets/js/landing.js` (and similar scripts) to support new `data-image-key` usage and ensure Supabase image loads match new hero/banner needs.
- [ ] Audit any custom JavaScript that expected Webcore classes; rewrite to target Tailwind/Preline selectors.
- [ ] Verify icon usage (Iconify, etc.) and ensure Tailwind handles sizing and color tokens.
- [ ] Review animations/transitions – replace Open Props animations with Tailwind keyframes or Preline utilities where needed.

## 5. Testing & Cleanup

- [ ] Cross-browser check (Chrome, Safari, Firefox) for responsive layouts after migration.
- [ ] Remove unused CSS/JS (Open Props imports, UnoCSS config files, Webcore styles).
- [ ] Update docs (`AGENTS.md`, `docs/handbook.md`, `README.md`) to describe Tailwind/Preline workflows and any new scripts.
- [ ] Run Lighthouse/CLS audits to confirm layout shifts and performance remain acceptable.
- [ ] Coordinate final cutover branch, flip `/` to Tailwind landing, and clean up alternate routes (`/landing-tailwind`) post QA.

---

**Working notes:** Mark each task as we complete it. For larger tasks, create dedicated issues/branches referencing this plan so we can track progress collaboratively.
