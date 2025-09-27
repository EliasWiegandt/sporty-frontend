# Sporty — Landing Page Design Spec (2025-09-25)

Purpose: capture the adult-focused marketing page as it now relies on square (1:1) illustrations generated via NanoBanana/Gemini anchors. This keeps engineering, content, and image generation in sync.

---

## Audience & Promise
- **Audience:** Adults exploring sports that fit their bodies today. Child/guardian messaging is deferred until the child landing returns.
- **Core promise:** “Find the sport that fits your body today—no login required.”
- **Supporting message:** Free, instant matches now; paid deep analyses and child forecasts are coming soon.

---

## Page Structure (top → bottom)

1. **Sticky Header**
   - Logo on left, inline nav (`How it works`, `Plans`, `FAQ`), primary CTA `Start free` on right.
   - Subtle blur + translucent background while scrolling.

2. **Hero Panel**
   - Content block: badge “New · Free body-fit matches”, H1 headline, narrative paragraph, primary CTA `Start the free match`, secondary CTA `Explore paid options`.
   - Visual slot: three square image tiles arranged in a mosaic, each highlighting a different adult athlete (basketball, swimmer, runner). See catalog keys `landing.hero.tile_a`, `landing.hero.tile_b`, `landing.hero.tile_c`.
   - Layout: two-column grid, 24px radius card, soft shadow, padding `clamp(2rem, 5vw, 4rem)`. Mosaic stacks responsively on smaller screens.

3. **How It Works**
   - Title “Three quick steps”, subtitle clarifying minimal inputs.
   - Three cards (numbered 1–3) with headings `Measure`, `Match`, `Explore`; no imagery required.

4. **Plan Options**
   - Title “Choose the depth you need”, supporting text describing free vs paid.
   - Two cards: highlighted free tier (badge, bullet list, CTA) and upcoming $5 Pro Analysis (three bullets, waitlist CTA).

5. **Sample Results**
   - Title “What your free results look like”.
   - Three cards, each topped with a square illustration: `Top three matches`, `Measurement breakdown`, `Actionable next steps` (catalog keys `landing.sample_results.tile_matches`, `landing.sample_results.tile_metrics`, `landing.sample_results.tile_next_steps`).

6. **Why Body Fit Matters**
   - Narrow section with explanatory paragraph and founders quote block.
   - No imagery beyond typography.

7. **FAQ**
   - Four cards answering key questions about price, measurements, launch timeline, and child forecasts.

8. **Footer**
   - Three-column layout with brand blurb, footer nav (Start free, Plans, FAQ, legal drafts, contact), dynamic © year.

---

## Visual Language
- **Typography:** Inter & Nunito (Google Fonts). Headline sizes use fluid clamp values; body text at 1rem base.
- **Color palette:**
  - Primary accent teal `#0ea5a5` with darker hover `#0c7c7c`.
  - Secondary CTA pink `#fb7185`.
  - Background `#f8fafc`, surfaces `#ffffff`, muted text `#475569`, body text `#0f172a`.
- **Buttons:** Pill-shaped, 2px border, hover scale/box-shadow transitions.
- **Cards:** 20–24px radius, soft shadows defined by `--shadow-card`.
- **Spacing:** Generous clamp-based padding for responsive clarity.

---

## Image Requirements
- All hero and sample-result visuals use square (1:1) assets to align with NanoBanana/Gemini generation constraints.
- Preferred format: WebP.
- Maintain cohesive art direction (semi-realistic, soft gradients, inclusive representation) across tiles.
- Each tile should work standalone and also read as part of a mosaic when placed side by side.

### Catalog Cross-Reference
| Section | Catalog Key | Aspect Ratio |
|---------|-------------|--------------|
| Hero tile — basketball warmup | `landing.hero.tile_a` | 1:1 |
| Hero tile — swimmer stretch | `landing.hero.tile_b` | 1:1 |
| Hero tile — runner prep | `landing.hero.tile_c` | 1:1 |
| Sample results — sport cards collage | `landing.sample_results.tile_matches` | 1:1 |
| Sample results — metric bars | `landing.sample_results.tile_metrics` | 1:1 |
| Sample results — next steps checklist | `landing.sample_results.tile_next_steps` | 1:1 |

Legacy child marketing assets remain under keys prefixed with `legacy.`; move them back into planning when the child-focused landing is scheduled.

---

## Accessibility & Performance
- All interactive elements have visible focus styles and descriptive labels.
- When real imagery ships, include alt text from the catalog for each tile.
- Aim for Lighthouse ≥ 90; keep individual tiles under ~200 KB to accommodate multiple hero tiles.

---

## Future Considerations
- Once paid plans launch, replace “coming soon” card with live pricing, integrate Stripe entry points, and consider adding testimonial/logo tiles (also 1:1) to the hero mosaic.
- Add real founder photo or quote block once available.
- Reintroduce a dedicated child/guardian page; update design + catalog accordingly.
