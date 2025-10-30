# Sporty Frontend – Tailwind & Preline Migration Plan

This checklist tracks the work required to replace the current Open Props + UnoCSS + Webcore UI stack with Tailwind CSS + Preline. We’re standardising on Tailwind for tokens/utilities, using Preline for interactives, and phasing out legacy styling so every surface pulls from one consistent system. We’ll start with Tailwind’s native theme tokens (colors, spacing, etc.), alias them to Sporty semantic names, and only introduce custom tokens when the defaults fall short. Core brand cues like the dark teal palette and pill-shaped primary/secondary CTAs stay intact—just expressed through the new Tailwind tokens. The current Tailwind landing becomes our source of truth, keeping bespoke refinements (e.g. the tuned hero) while swapping hard-coded values for shared tokens.

---

## 1. Architecture & Foundation

- [x] Define Sporty Tailwind tokens (colors, spacing, radius, typography, shadows) inside the `@theme` block and commit the canonical set.
- [x] Move shared primitives into Tailwind layers: typography defaults in `@layer base`, reusable patterns (`btn-pill`, `section-shell`) in `@layer components`, and one-off helpers in `@layer utilities`.
- [x] Extract a reusable Tailwind preset/config (`tailwind.sporty-preset`) so islands or future apps can share the same tokens.
- [x] Record these decisions (tokens, layering, preset usage) in `docs/handbook.md`, `README.md`, and `FRONTEND_TODO.md` for future contributors.

- [x] Keep the Sporty dark-teal brand palette as the primary color family (map Tailwind emerald/teal tokens to `brand-*`).
- [x] Ensure the pill-shaped primary/secondary CTAs remain the canonical button style, expressed via Tailwind component classes.

- [x] Update docs once the migration is complete (README, docs/handbook.md, AGENTS.md, FRONTEND_TODO.md) with Tailwind/Preline setup notes.
- [x] Switch the Tailwind landing (`src/pages/landing-tailwind.astro`) to be the default `/` page and back up/remove the legacy landing implementation.

- [x] Confirm Tailwind/PostCSS config aligns with production build tooling (purge paths, plugins, `tailwind.config.js` tokens).
- [x] Document the Tailwind design tokens (brand palette, typography scale, spacing, radius, shadows) and update `docs/handbook.md` + `README.md`.
- [x] Decide how to ship Preline JS (global import vs. lazy component import) and document initialization patterns (e.g., `window.HSStaticMethods.autoInit()`).
- [x] Remove UnoCSS integration from `astro.config.mjs` once no longer used; update build commands and CI/caching notes.
- [x] Replace Webcore integration and audit any runtime dependencies (modals, accordions, etc.) that need Tailwind/Preline equivalents.

## 2. Layout & Components

- [ ] Inventory all global styles (`src/styles/*.css`, Uno shortcuts) and flag replacements needed in Tailwind (base layer vs. component layer).
- [ ] Rebuild shared layout primitives (`BaseLayout`, nav, footer) in Tailwind + Preline; ensure responsive breakpoints match existing UX.
- [x] Replace Webcore UI components page-by-page with Tailwind/Preline implementations (modals, accordions, badges, grids).
- [ ] Create a small internal component library (buttons, cards, section shells, chip styles) in Tailwind for reuse across pages.
- [ ] Validate hero sections and CTA bars to confirm spacing, sticky behavior, and Preline animations work as expected.
- [x] Move guardian + results inline styles (`premium-shell`, `component-card`, `impact-bar`, `match-card__*`, etc.) into Tailwind components so the pages no longer ship bespoke `<style>` blocks.
- [x] Port privacy, account, pricing, terms, dashboard, checkout, about, and intake pages to Tailwind utilities (2025-10-30).

## 3. Page-by-Page Migration

- [x] Home / Landing (`landing-tailwind` → eventual `/`): finish layout, imagery, and consent copy; remove legacy landing markup when ready.
- [x] Preserve bespoke hero refinements when promoting `landing-tailwind` to `/`, replacing hard-coded values with shared tokens instead of reverting the UX.
- [x] Preserve bespoke hero refinements when promoting `landing-tailwind` to `/`, swapping hard-coded values for shared tokens instead of reverting the UX.
- [x] Pricing, Intake, Results, Dashboard, Account, Terms/Privacy pages: port each to Tailwind, removing UnoCSS classes and Webcore components.
- [ ] Authentication flows (buttons, forms, modals) – ensure Tailwind handles focus states, error messaging, and Preline JS components.
- [ ] Child/Guardian flows (tables, stepper forms, cards) – rebuild layout using Tailwind grid utilities and Preline components.
- [ ] API route templates or Astro API responses that inject HTML – ensure any inline styles or class names match new Tailwind conventions.

## 4. Assets & Utilities

- [ ] Update `public/assets/js/landing.js` (and similar scripts) to support new `data-image-key` usage and ensure Supabase image loads match new hero/banner needs.
- [x] Audit any custom JavaScript that expected Webcore classes; rewrite to target Tailwind/Preline selectors.
- [ ] Verify icon usage (Iconify, etc.) and ensure Tailwind handles sizing and color tokens.
- [ ] Review animations/transitions – replace Open Props animations with Tailwind keyframes or Preline utilities where needed.

## 5. Testing & Cleanup

- [ ] Cross-browser check (Chrome, Safari, Firefox) for responsive layouts after migration.
- [x] Remove unused CSS/JS (Open Props imports, UnoCSS config files, Webcore styles).
- [x] Update docs (`AGENTS.md`, `docs/handbook.md`, `README.md`) to describe Tailwind/Preline workflows and any new scripts.
- [ ] Run Lighthouse/CLS audits to confirm layout shifts and performance remain acceptable.
- [ ] Coordinate final cutover branch, flip `/` to Tailwind landing, and clean up alternate routes (`/landing-tailwind`) post QA.

---

### Token mapping plan (2025-10-29)

- Canonical Tailwind design tokens live in `src/styles/tailwind.css` under the `@theme` block; future shared presets should source from that file.
- Legacy Open Props aliases (`--brand-*`) remain defined in the theme so leftover UnoCSS components can read consistent values while we migrate.
- New semantic tokens: `--color-surface`, `--color-text`, `--color-border`, `--color-focus-ring`, and state colors (`--color-info|success|warning|danger`) replace ad-hoc uses of `var(--gray-*)` and custom RGBA focus rings.
- Radius and spacing helpers (`--radius-sm` … `--radius-4xl`, `--spacing-15|18|20|22|24|28`) map UNO shortcut sizes (`rounded-[20px]`, `px-8`, etc.) to reusable Tailwind-friendly values.
- Shadow tokens (`--shadow-button`, `--shadow-card`, `--shadow-section`, `--shadow-focus`) cover the recurring elevation styles reused across intake/results surfaces.

### Component layer status (2025-10-29)

- Tailwind `@layer base` now handles anchors, buttons, imagery, and list resets so we can drop matching global styles later.
- Shared button patterns (`btn-primary`, `btn-ghost`, `btn-pill`, `cta-*`, `nav-button`), card shells, summary/pill chips, and intake layout scaffolding (`intake-shell`, `intake-card`, grids, premium panels) are defined in `@layer components`.
- Remaining cleanup: confirm guardian/chart surfaces don’t introduce new utility gaps once those pages migrate, then remove UnoCSS entirely.

### UnoCSS retirement (2025-10-30)

- ✅ All shortcut styles migrated into Tailwind `@layer` definitions; no UnoCSS-only classes remain in templates.
- ✅ Removed `uno.config.ts`, the UnoCSS integration, and related dependencies from `package.json`/`astro.config.mjs`.
- ✅ `npm run build` passes without UnoCSS, confirming the Tailwind components cover every previous shortcut.
- Ongoing: keep an eye on new components to ensure they pull from Tailwind tokens so the codebase stays UnoCSS-free.

**Working notes:** Mark each task as we complete it. For larger tasks, create dedicated issues/branches referencing this plan so we can track progress collaboratively.
