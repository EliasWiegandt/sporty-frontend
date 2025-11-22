# Sporty — Frontend Agent Guide

Read this guide plus `docs/handbook.md` before contributing.

## Mission
- Read `docs/handbook.md` in this repo for full API, schema, and operations context.
- Read `../sporty-frontend/docs/handbook.md` to understand client expectations, payload contracts, and UX flows.
- Use this document as a quick checklist once both handbooks are understood.
## Quick Facts
- Live prod is hosted at `https://sporty.plyml.com` (staging: `https://sporty-test.plyml.com`). When docs say “sporty,” they refer to that domain, not `sporty.ai`.
- Build pipeline: `npm run build` emits `dist/_worker.js/index.js` + assets; `wrangler deploy` publishes the generated Worker (see `wrangler.toml`).
- Node 20 is required in CI; commit `package-lock.json` with dependency changes.
- Browser JS lives under `public/assets/js/` (no bundler—keep scripts compatible with plain browsers).
- Design system → Tailwind tokens/components defined in `src/styles/tailwind.css` (buttons, layout shells, match cards, etc.); Iconify web component (`<iconify-icon>` for the laurel wreath logo).
- **No `<style>` blocks**: Do not use `<style>` blocks in `.astro` files. They cause specificity issues. Put all component CSS in `src/styles/tailwind.css`.
- Preline interactivity is initialised by an inline module in `BaseLayout`; add the documented `data-hs-*` attributes and Preline will auto-init after load.
- Before reusing a layout/helper class from `src/styles/tailwind.css`, read the definition. Grid/min-width values there can hard-cap section widths (the hero bug came from `hero-shell`). If a section needs custom sizing, create/extend a dedicated stylesheet instead of stacking shortcuts.
- Navbar CTA copy defaults to “Try free analysis” via `defaultPrimaryAction` in `BaseLayout`; update that constant if marketing copy changes.
- Premium adult and child analyses each cost a single $5 credit—keep `src/data/landingContent.ts`, `/pricing`, and docs aligned when copy changes.
- Science research copy lives in `src/pages/science.astro`; keep landing teasers in `src/data/landingContent.ts` aligned and use `.science-item-refs` so each source renders on its own line. The old `/` “Why body fit matters” section is retired—don’t resurrect it.

## Local Dev
```bash
npm install
npm run dev          # Astro dev server
# or, to exercise the Worker:
npm run build
wrangler dev
```
- `.dev.vars` should provide the same vars as production (API key, Supabase URLs, Stripe publishable key).
- `make run-frontend` runs `npm run build` + `wrangler dev` in sequence.

## Collaboration
- Update `README.md` + `docs/handbook.md` whenever you add a page, adjust Tailwind/Preline usage, or change build/deploy steps.
- Keep `BaseLayout` as the single source of truth for the top nav and auth controls; add props instead of duplicating markup in pages.
- Never expose Supabase service-role or Stripe secret keys in the frontend; only the Worker/backend should handle them.
- Prefer the CLI’s built-in helpers (search/explore panels, file viewers, etc.) when inspecting the codebase; fall back to raw shell commands only when the helper can’t capture what you need so output stays easy to follow.
- When you need to look up files or content, use the dedicated search/read helpers (`rg`, file viewers, tree explorers) instead of running general-purpose shell listings; reserve fallback shells for cases the helpers can’t cover.

## Intake Architecture
- The intake form (`/intake` and Premium) uses a **Preact island architecture** centered on `IntakeApp.tsx`.
- **State:** `IntakeApp.tsx` holds the single source of truth for `basics`, `measurements`, and `pastSports`.
- **Validation:** Validation is performed via pure functions against the state objects, NOT by querying the DOM (`FormData`).
- **Components:** All form steps (`BasicsStep`, etc.) and inputs (`NumberStepper`, `MeasurementField`) are **Controlled Components** (receiving `value` and `onChange`). Do not use uncontrolled inputs or `useRef` to read values manually.
- **Verification:** Use `make snap` to verify the UI. This runs `scripts/snap_intake_flow.js`, which uses Puppeteer to automatically fill out the intake form and take screenshots of each step (Basics, Measurements, Past Sports), ensuring the flow logic is sound.
- See the “Intake Experience” section in `docs/handbook.md` for the detailed design spec that replaced the removed documents.

## Consent & Visual Asset Guidelines
- Follow the consent flows documented in `docs/handbook.md` (see “Consent Strategy”): always offer preview modes, gate storage behind explicit opt-ins (measurements, goals/preferences, injuries, child data), and surface revoke controls. UI copy must explain purpose, retention, and provide links to Privacy/Data Rights pages.
- Distinguish visual asset pipelines: use coded charts/tables for data (fit contributions, growth curves, etc.), and rely on the illustration generator for human/sport scenes or measurement helpers. Maintain the illustration backlog referenced in the journeys file and ensure every chart has an accessible text/table fallback.

If the repo drifts from the handbook, fix the docs first.


## MVP Investment Policy
- Invest effort in polished charts and illustration placeholders—the journeys lean on strong visual storytelling.
- Keep everything else lightweight: reuse existing components, prefer simple CSS/HTML patterns, and defer advanced animations.
- Use Astro islands sparingly (vanilla or Preact) to deliver interactivity without bloating the MVP surface.
- Only add dependencies that directly serve the MVP scope (charts, consent); avoid speculative tooling.

## Quick Checklist

1. Confirm you have read both handbooks (frontend + backend).
2. Follow consent and data-handling rules documented in the handbooks.
3. Keep updates scoped to this repo unless coordinated with the sibling repo.
