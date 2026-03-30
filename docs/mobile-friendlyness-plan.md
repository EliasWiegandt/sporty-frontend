# Mobile-Friendlyness Plan

_Status: active_

This document is the canonical queue and working loop for the frontend-wide push to make Sporty mobile-friendly.

## 1. Mission

- Make the full frontend mobile-friendly.
- Treat desktop and mobile as first-class surfaces.
- Use modern phone widths as the primary responsive anchor:
  - `375px`
  - `390px`
  - `414px`
- Run a narrow-phone safety pass at `320px`.
- Preserve the current visual language and shared Tailwind primitives; fix root causes rather than layering page-local hacks.

## 2. Operating Loop

Each iteration should handle one atomic mobile issue only.

Loop:
1. Pick the highest-priority unblocked item from the queue below.
2. Implement only that issue.
3. Verify the affected flow in Playwright against the local frontend Worker app.
4. Record short QA notes in the iteration log.
5. Mark the item `done`, `partial`, or leave it `todo` with a blocker note.

Selection rules:
- Prefer shared shell/component fixes before page-local fixes.
- Prefer user-blocking issues before visual polish.
- If one item turns into a larger cluster, split it into new atomic items here rather than hiding complexity in one patch.

## 3. Verification Workflow

Canonical local run commands:

Backend:
```bash
cd ../sporty-backend
make run-backend
```

Frontend:
```bash
make run-frontend
```

Canonical browser QA path:
- Use Playwright, not the old `make snap` / Puppeteer scripts.
- Verify against `http://127.0.0.1:8787`.
- Default to mobile-style checks:
  - phone-width viewport
  - touch-style interaction
  - scroll + tap checks on real page flows

Default viewport set:
- `375x812`
- `390x844`
- `414x896`
- `320px` width safety pass when relevant

Definition of "looks ok" for a completed item:
- no horizontal overflow
- no overlapping controls
- readable text hierarchy
- primary actions reachable
- touch interactions usable
- no nearby regression on desktop

## 4. Priority Queue

| ID | Area | Problem | Definition of done | Playwright check | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| M001 | Global shell | Header/nav does not have a real mobile navigation pattern. | Header has a usable phone nav pattern with no overlap. | Open `/` at `390x844`; open/close nav; confirm links + CTA reachable. | none | done |
| M002 | Global shell | Header auth controls crowd the top bar on phone widths. | Auth actions fit cleanly in the mobile header/nav state. | Open `/` at `390x844`; inspect signed-out header state. | M001 preferred | done |
| M003 | Global shell | Header primary CTA may crowd branding/nav on narrow phones. | Brand, nav trigger, and primary CTA coexist without collision. | Open `/` at `320x712`; inspect top bar before scroll. | M001 preferred | done |
| M004 | Global shell | Footer link groups may not stack cleanly on phones. | Footer remains readable and balanced on phone widths. | Open `/` and `/results` at `390x844`; scroll to footer. | M001 preferred | done |
| M005 | Global spacing | Global page padding is too desktop-biased. | Shared page padding feels balanced on phone across major pages. | Open `/`, `/intake`, `/dashboard` at `390x844`; inspect page edges. | none | done |
| M006 | Global spacing | Shared card spacing is too roomy or cramped on phones. | Card primitives feel proportionate on phone widths without page-local hacks. | Open `/intake`, `/results`, `/dashboard` at `390x844`; inspect card density. | M005 preferred | done |
| M007 | Global controls | Buttons/pills may miss touch-friendly size targets. | Shared buttons/pills are comfortably tappable on phones. | Open `/`, `/intake`, `/dashboard` at `390x844`; inspect major actions. | none | todo |
| M008 | Global overflow | App shell may allow unintended horizontal overflow. | No root-level side-scroll on core pages at phone widths. | Open `/`, `/intake`, `/results`, `/dashboard` at `320x712`; verify no horizontal scroll. | M001-M007 partial reuse | todo |
| M009 | Home | Hero content stack is too desktop-shaped. | Hero copy, CTA group, and media stack cleanly on phones. | Open `/` at `390x844`; inspect hero before scroll. | M001, M005 | todo |
| M010 | Home | Hero media/image treatment may crop awkwardly on phones. | Hero media remains intentional and non-broken on phone widths. | Open `/` at `390x844` and `320x712`; inspect hero image block. | M009 preferred | todo |
| M011 | Home | Landing value cards need a phone-safe single-column pattern. | Core value cards collapse cleanly with readable spacing. | Open `/` at `390x844`; scroll through value-card grids. | M005, M006 | todo |
| M012 | Home | “How it works” section spacing/composition is desktop-biased. | Section reads cleanly on phones with no crowded blocks. | Open `/` at `390x844`; inspect “How it works” section. | M005, M006 | todo |
| M013 | Home | Landing accordions need touch-first QA on phones. | Accordion toggles are easy to tap and content does not overflow. | Open `/` at `390x844`; open/close landing accordions. | M007 | todo |
| M014 | Home | Sticky CTA or related landing JS behavior may be wrong on phones. | Phone behavior is intentional, not desktop carry-over. | Open `/` at `390x844`; scroll through page and observe CTA behavior. | M001, M009 | todo |
| M015 | Intake basics | Step header/progress area may crowd on phones. | Step identity and controls remain readable at phone widths. | Open `/intake` at `390x844`; inspect top of step flow. | M001, M005 | todo |
| M016 | Intake basics | Basics step field layout is too desktop-oriented. | Birthday/sex controls stack cleanly and stay easy to use on phones. | Open `/intake` at `390x844`; inspect basics step. | M015 preferred | todo |
| M017 | Intake basics | Validation/error messaging may appear too far from fields on phones. | Errors remain visible and understandable without awkward scrolling. | Open `/intake` at `390x844`; trigger basics validation. | M016 preferred | todo |
| M018 | Intake measurements | Measurement system toggle needs a tighter phone layout. | Metric/imperial toggle stays readable and tappable on narrow widths. | Open `/intake`; go to measurements at `390x844`; inspect toggle. | M015, M007 | todo |
| M019 | Intake measurements | Measurement cards use desktop-biased padding/spacing. | Measurement cards feel compact but readable on phones. | Open `/intake`; go to measurements at `390x844`; inspect multiple cards. | M006 | todo |
| M020 | Intake measurements | Single-value steppers may be too wide or crowded on phones. | Standard steppers fit phone width without clipping or cramped controls. | Open `/intake`; go to measurements at `390x844`; inspect several numeric fields. | M019 preferred | todo |
| M021 | Intake measurements | Height feet/inches dual-stepper may overflow or feel awkward on phones. | Feet/inches controls stack or size cleanly with no overflow. | Open `/intake`; go to measurements; switch to imperial at `390x844`. | M018 preferred | todo |
| M022 | Intake measurements | Inline hints/tooltips may overflow the viewport. | Measurement help remains readable and contained on phones. | Open `/intake`; go to measurements at `390x844`; open several help tips. | M019 preferred | todo |
| M023 | Intake past sports | Past sports list cards need a tighter phone layout. | Cards stack cleanly with readable labels and controls. | Open `/intake`; go to past sports at `390x844`; inspect empty and populated states. | M005, M006 | todo |
| M024 | Intake past sports | Add/remove sport actions may be too small or awkward on phones. | Past-sport actions are thumb-friendly and non-overlapping. | Open `/intake`; go to past sports at `390x844`; add/remove an entry. | M023 preferred | todo |
| M025 | Premium intake | Premium section wrappers may be too desktop-shaped. | Premium blocks stack cleanly at phone widths. | Open `/intake-premium` at `390x844`; inspect premium sections. | M005, M006 | todo |
| M026 | Premium intake | Trait question cards need a phone-safe layout. | Trait questions collapse cleanly and remain easy to tap. | Open `/intake-premium`; inspect traits at `390x844`. | M025 preferred | todo |
| M027 | Premium intake | Preference cards need a phone-safe layout. | Preference controls stack cleanly and stay tappable. | Open `/intake-premium`; inspect preferences at `390x844`. | M025 preferred | todo |
| M028 | Premium intake | Goal cards need a phone-safe layout. | Goal controls stack cleanly and stay tappable. | Open `/intake-premium`; inspect goals at `390x844`. | M025 preferred | todo |
| M029 | Premium intake | Injury cards need a phone-safe layout. | Injury controls stack cleanly and stay tappable. | Open `/intake-premium`; inspect injuries at `390x844`. | M025 preferred | todo |
| M030 | Intake actions | Bottom action row in intake flow may crowd on phones. | Continue/back/submit actions remain clear and reachable on phone widths. | Open `/intake` and `/intake-premium` at `390x844`; inspect action rows across steps. | M007, M015 | todo |
| M031 | Quick results | Results header and CTA hierarchy may be too desktop-oriented. | `/results` hero/header reads clearly on phones. | Open `/results` at `390x844`; inspect top section. | M001, M005 | todo |
| M032 | Quick results | Quick result cards may not stack cleanly on phones. | Result cards read cleanly with no broken card composition. | Open `/results` at `390x844`; inspect cards down the page. | M031 preferred | todo |
| M033 | Quick results | Result metric/factor rows may overflow at phone widths. | Metric rows wrap or stack without side-scroll. | Open `/results` at `390x844` and `320x712`; inspect card internals. | M032 preferred | todo |
| M034 | Quick results | Result CTAs and alignment helpers may assume desktop widths. | Card CTAs remain visible and visually coherent on phones. | Open `/results` at `390x844`; inspect lower card sections. | M032 preferred | todo |
| M035 | Quick results | Empty state layout may be too desktop-biased. | Empty state reads cleanly and primary action is reachable on phone. | Open `/results` in an empty-state scenario at `390x844`. | M031 preferred | todo |
| M036 | Premium results | Premium results hero/header may crowd on phones. | `/results/premium` top section reads clearly on phone widths. | Open `/results/premium?...` at `390x844`; inspect top section. | M031 | todo |
| M037 | Premium results | Premium card headers/meta layouts may assume desktop width. | Premium card top blocks stack cleanly on phones. | Open `/results/premium?...` at `390x844`; inspect several cards. | M036 preferred | todo |
| M038 | Premium results | Factor accordion toggles may be too dense for touch. | Accordion toggles are easy to tap and visually stable on phones. | Open `/results/premium?...` at `390x844`; open/close factor accordions. | M037 preferred | todo |
| M039 | Premium results | Accordion bodies may overflow or feel cramped on phones. | Expanded factor content wraps correctly with no clipped text. | Open `/results/premium?...` at `390x844`; expand accordions. | M038 preferred | todo |
| M040 | Premium results | Ratio/body metric rows or tables may side-scroll. | Metric content remains readable without unintended horizontal scroll. | Open `/results/premium?...` at `320x712`; inspect factor content. | M039 preferred | todo |
| M041 | Premium results | Chart sizing may not be phone-safe. | Donuts/bars/charts render legibly on phone widths. | Open `/results/premium?...` at `390x844`; inspect chart blocks. | M036 preferred | todo |
| M042 | Child intake | Child intake basics layout needs a phone pass. | `/child-intake` basics feel clean and usable on phones. | Open `/child-intake` at `390x844`; inspect opening sections. | M015, M005 | todo |
| M043 | Child intake | Parent-measurement sections may be too desktop-shaped. | Parent/child measurement sections stack cleanly on phone widths. | Open `/child-intake` at `390x844`; inspect measurement sections. | M042 preferred | todo |
| M044 | Child premium | Child premium blocks need the same phone-safe stacking as adult premium. | `/child-premium` sections read cleanly on phones. | Open `/child-premium` at `390x844`; inspect form sections. | M025, M042 | todo |
| M045 | Child results | Child results header/tab controls may be crowded on phones. | Header/tab controls remain readable and tappable on phones. | Open `/child-results` at `390x844`; inspect header + tabs. | M001, M005 | todo |
| M046 | Child results | Child result cards/details grids may assume desktop width. | Child result cards collapse cleanly with readable details. | Open `/child-results` at `390x844`; inspect results list. | M045 preferred | todo |
| M047 | Child results premium | Child premium results CTA flow may be too desktop-biased. | `/child-results/premium` CTA flow works cleanly on phones. | Open `/child-results/premium` at `390x844`; inspect CTA area. | M045 preferred | todo |
| M048 | Auth modal | Auth modal may not fit within phone viewport. | Auth modal fits on phone widths with no clipped chrome. | Open auth modal at `390x844`; inspect initial modal state. | M001, M005 | todo |
| M049 | Auth modal | Auth modal may become awkward with mobile keyboard open. | Inputs and submit actions remain usable with keyboard pressure. | Open auth modal at `390x844`; focus fields and inspect scroll/visibility. | M048 preferred | todo |
| M050 | Consent flows | Consent modal/banner flows need a phone usability pass. | Consent interactions remain readable and tappable on phones. | Trigger consent flow at `390x844`; inspect modal/banner layout. | M048 preferred | todo |
| M051 | Checkout | Child-selection modal injected by checkout JS may not be phone-safe. | Child-selection modal fits and remains usable on phones. | Open checkout child modal at `390x844`; inspect + interact. | M007, M048 | todo |
| M052 | Checkout | Legal modal injected by checkout JS may not be phone-safe. | Legal modal checklist/actions remain usable on phones. | Open checkout legal modal at `390x844`; inspect + interact. | M051 preferred | todo |
| M053 | Checkout success | Checkout success page may be too desktop-biased. | Success page reads cleanly and actions remain reachable on phones. | Open `/checkout/success` at `390x844`; inspect page. | M005 | todo |
| M054 | Dashboard | Dashboard top summary/hero layout needs a phone pass. | Top-of-dashboard reads cleanly on phones. | Open `/dashboard` at `390x844`; inspect top section. | M001, M005 | todo |
| M055 | Dashboard | Dashboard stat cards need a phone-safe stacking pattern. | Summary/stat cards stack cleanly and remain readable. | Open `/dashboard` at `390x844`; inspect card groups. | M054 preferred | todo |
| M056 | Dashboard | Dashboard history cards may be too dense for phone widths. | History cards remain readable and scannable on phones. | Open `/dashboard` at `390x844`; inspect history list. | M055 preferred | todo |
| M057 | Dashboard | Overflow menus may clip or be hard to use on touch. | Menus open fully and remain tappable on phones. | Open `/dashboard` at `390x844`; trigger overflow menus. | M056 preferred | todo |
| M058 | Dashboard | Delete confirmation flows may be awkward on phones. | Delete actions and confirmations remain clear on phone widths. | Open `/dashboard` at `390x844`; start delete flow. | M057 preferred | todo |
| M059 | Dashboard | Family/child cards may assume desktop width. | Family/child groupings stack cleanly on phones. | Open `/dashboard` at `390x844`; inspect family sections. | M055 preferred | todo |
| M060 | Sport-bodies directory | Search + directory cards need a phone-safe layout. | `/sport-bodies` search and card grid work cleanly on phones. | Open `/sport-bodies` at `390x844`; inspect search + cards. | M005, M006 | todo |
| M061 | Sport-body detail | Detail page evidence blocks may be too desktop-shaped. | `/sport-bodies/[targetId]` reads cleanly on phones. | Open a detail page at `390x844`; inspect major sections. | M060 preferred | todo |
| M062 | Content pages | Premium marketing page needs a phone pass. | `/premium` has no major phone-width layout issues. | Open `/premium` at `390x844`; inspect page sections. | M005, M006 | todo |
| M063 | Content pages | Science page citations/content blocks need a phone pass. | `/science` reads cleanly on phones with sane citation layout. | Open `/science` at `390x844`; inspect content + references. | M005 | todo |
| M064 | Content pages | Privacy page needs a phone pass. | `/privacy` has no major phone-width layout issues. | Open `/privacy` at `390x844`; inspect page. | M005 | todo |
| M065 | Content pages | Terms page needs a phone pass. | `/terms` has no major phone-width layout issues. | Open `/terms` at `390x844`; inspect page. | M005 | todo |
| M066 | Content pages | Guardian invite page needs a phone pass. | `/guardian-invite` works cleanly on phone widths. | Open `/guardian-invite` at `390x844`; inspect page. | M005 | todo |
| M067 | Legacy JS-rendered UI | JS-generated quick results markup may hide desktop assumptions. | Results JS is audited; any phone blockers are fixed or split into follow-ups. | Open `/results` at `390x844`; inspect JS-rendered card structure. | M032-M034 | todo |
| M068 | Legacy JS-rendered UI | JS-generated premium results markup may hide desktop assumptions. | Premium results JS is audited; blockers fixed or split out. | Open `/results/premium?...` at `390x844`; inspect JS-rendered areas. | M037-M041 | todo |
| M069 | Legacy JS-rendered UI | Dashboard JS-rendered sections may hide desktop assumptions. | Dashboard JS is audited; phone blockers fixed or split out. | Open `/dashboard` at `390x844`; inspect JS-driven sections. | M054-M059 | todo |
| M070 | Legacy JS-rendered UI | Checkout injected modal CSS may assume desktop width. | Injected modal styles are audited and phone-safe. | Open checkout modals at `390x844`; inspect injected layout. | M051, M052 | todo |

## 5. Iteration Log

Add one short entry per completed loop.

Template:

```md
### YYYY-MM-DD — M000
- Outcome: pass | partial | blocked
- Areas touched:
- Pages checked:
- QA notes:
- Follow-ups:
```

### 2026-03-26 — M001
- Outcome: pass
- Areas touched: `src/layouts/BaseLayout.astro`
- Pages checked: `/`
- QA notes: Replaced always-inline desktop nav with a phone menu trigger + collapsible mobile panel. Verified in Playwright at `390x844`: menu button visible, panel opens, nav links and sign-in action are reachable, panel closes cleanly.
- Follow-ups: `M002`, `M003`

### 2026-03-27 — M002
- Outcome: pass
- Areas touched: `src/layouts/BaseLayout.astro`
- Pages checked: `/`
- QA notes: Removed the header primary CTA, kept the auth CTA in the mobile header row, and removed duplicated auth controls from the burger panel. Verified in Playwright on signed-out landing at `390x844`, plus narrow-phone check: no overlap between brand, auth CTA, and menu trigger; header width stayed within the viewport.
- Follow-ups: `M003`, `M004`

### 2026-03-27 — M003
- Outcome: pass
- Areas touched: `src/layouts/BaseLayout.astro`
- Pages checked: `/`
- QA notes: Item became obsolete after removing the header primary CTA from both desktop and mobile header states. Narrow-phone Playwright check showed brand, auth CTA, and menu trigger fit without overlap.
- Follow-ups: `M004`, `M005`

### 2026-03-27 — M004
- Outcome: pass
- Areas touched: `src/styles/tailwind.css`
- Pages checked: `/`, `/results`
- QA notes: Re-verified live in Playwright at `390x844`. Both footer variants render as centered vertical stacks with readable spacing and no awkward wrap rows.
- Follow-ups: `M006`, `M007`

### 2026-03-27 — M005
- Outcome: pass
- Areas touched: `src/styles/tailwind.css`
- Pages checked: `/`, `/intake`, `/dashboard`
- QA notes: Shared mobile gutters were stacking up through `main` plus shell wrappers. Tightened phone-width `main` padding, reduced mobile `section-shell` inset/padding, and let `dashboard-shell` use full available width on phones so the core pages sit closer to the viewport edge without feeling cramped.
- Follow-ups: `M006`, `M007`

### 2026-03-27 — M006
- Outcome: pass
- Areas touched: `src/styles/tailwind.css`
- Pages checked: `/intake`, `/results`, `/dashboard`
- QA notes: Tightened the shared mobile card primitives instead of patching page-by-page: `card-shell`, `sample-card`, `dashboard-card`, `history-card`, and `stat-card` now use smaller phone padding/radii, with denser grid gaps. Playwright verification at `390x844` showed cleaner card density on intake and dashboard without cramped text or broken structure.
- Follow-ups: `M007`, `M008`

## 6. Notes

- Playwright can verify mobile-style behavior. In practice that means emulating phone-size viewports and touch interaction, not only shrinking a desktop browser window.
- The old `make snap` / Puppeteer scripts are considered legacy for this workstream and should not be the primary QA path in future docs or plans.
