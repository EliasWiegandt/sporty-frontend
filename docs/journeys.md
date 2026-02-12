# Sporty Frontend Journeys

Product/navigation journey reference for desktop MVP.

Source of truth for:
- visitor/user flows
- consent UX journey policy
- pricing/entry-point behavior

---

## Visitor Journeys (Desktop MVP)

This document defines the **high-level navigation and user flows** for the Sporty MVP (desktop-only).  
It focuses on how users move through the website to complete their core use cases — not on individual component design.

> **Environment**: Production lives on `sporty.plyml.com` and staging on `sporty-test.plyml.com`. References to “the site” below point to those domains.

---

## Consent Strategy (Unified Across Journeys)

To minimize friction, Sporty collects consent only at **two key moments**:

1. **Account Creation / Sign-Up**

   - Users grant general consent for measurement storage, analytics, and improvement.
   - Includes acknowledgment of data policy and rights.
   - Covers all standard body measurements and past sport history.

2. **First Paid Analysis (Adult or Child)**
   - Users grant explicit consent for storing and processing _sensitive data_ (injuries, health-related info, child data).
   - This single consent applies to all subsequent paid analyses unless revoked in the profile.

All other interactions — such as free, anonymous analyses — are purely transient (data processed but not stored).

Users can manage or revoke consent anytime in **Account → Data & Privacy**.

---

## Top-Level Site Structure

| Section            | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| **Home**           | Marketing overview, free entry point to analysis.                |
| **About**          | Explains Sporty’s AI approach and data ethics.                   |
| **Pricing**        | Explains free vs paid analyses and credit system.                |
| **Dashboard**      | Logged-in home for saved results, credits, and analysis history. |
| **Intake**         | Form flow for measurements, past sports, and premium inputs.     |
| **Results**        | Displays analysis outcomes, fit scores, and explanations.        |
| **Child Forecast** | Guardian-only flow for forecasting child sports suitability.     |
| **Account**        | Profile management, consent settings, and credit history.        |

Top navigation (desktop):

```

Sporty    |    About    |    Pricing    |    Dashboard/Login

```

Contextual CTAs may lead directly into `/intake` or `/child`.

---

## 1. Free Adult Journey (Anonymous or Logged-In)

### Goal

Discover which sports match your body without paying or storing data.

### Entry Points

- “See my match” CTA on Home.
- Marketing CTA banners or footer prompts.

### Flow

1. **Home ➝ Intake (Free Mode)**

  - The `/intake` page mounts `IntakeApp`, a three-step Preact island that collects Basics, Measurements (the twelve metrics defined in `src/data/measurementFields.ts`), and Past Sports, validates each input, and auto-saves drafts to `localStorage` so visitors can pick up where they left off.
  - Past sports entries are optional (up to five) and source their labels from Supabase’s `sports_subcategories`; they capture years played, starting age, intensity, and the liked/flair/skill flags that feed the matching backend even for anonymous runs.
  - Logged-in users keep their drafts in sync with session storage so saved runs appear automatically when they revisit.

2. **Submit ➝ Results Page (Quick Match)**

   - Displays top 3 sport matches with visual fit indicators and summaries.
   - “Save this run” prompts login if anonymous.

3. **Optional Next Steps**
   - “Upgrade for detailed analysis” leads to Pricing.
   - Logged-in users can revisit results from Dashboard.

### Key Pages Involved

- `/` (Home)
- `/intake`
- `/results`
- `/login` (if saving)

### Consent

- No consent needed for anonymous use.
- Logged-in users are already covered by sign-up consent.

---

## 2. Paid Adult Journey (Detailed Analysis)

### Goal

Get a deeper, personalized analysis including goals, preferences, injuries, and performance factors.

### Entry Points

- “Upgrade for detailed analysis” button on Results page.
- “Start new analysis” from Dashboard (requires credits).
- Direct purchase or Pricing page.

### Flow

1. **Dashboard ➝ Start New Analysis ➝ Intake (Premium)**

  - The premium intake reuses `IntakeApp`, adds the Traits step plus the Preference/Goal/Injury sections, and keeps the credit-aware `PremiumBlock` visible only when the user has adult credits and consents to storing detailed inputs.
  - Premium lists cap at 20 selections, forbid duplicate catalog IDs, collect priority/severity/notes, and require the “Apply one adult analysis credit” toggle before `/api/recommend-adult-premium` is allowed to post.
  - The premium block summary echoes the current credit total and consent state while the sidebar/top banner still surfaces the same totals for launch day marketing; failing to apply a credit shows an inline error and keeps the premium submission locked.

2. **Submit ➝ Results (Premium Analysis)**

   - Results page includes charts, breakdowns, and insights (body, goals, preferences, injuries).
   - User can compare with previous runs via History.

3. **Optional Next Steps**
   - “Start another analysis”
   - “View history”
   - “Share insights” (lightweight link copy only)

### Key Pages Involved

- `/dashboard`
- `/intake-premium`
- `/results/premium`
- `/pricing`

### Consent

- Triggered once at first paid analysis, covering future detailed runs.

---

## 3. Guardian Journey (Child Analysis Package)

### Goal

Purchase a $1 child credit to forecast a child’s body trajectory and unlock sport matches with guardian consent.

### Entry Points

- “Start child analysis” CTA on Home.
- “Forecast new child” from Guardian Dashboard.

### Flow

1. **Guardian Dashboard ➝ Start Child Analysis**

   - Choose or create a child profile.
   - Confirm guardian consent and apply a child credit (required before continuing).
   - Input child measurements and, optionally, parent measurements in the same flow.

2. **Submit ➝ Results (Child Analysis)**

   - The paid run returns the forecasted adult body profile, percentile context, and contribution breakdowns.
   - The same response includes premium sport matches blending preferences, goals, injuries, and past sports captured during intake.
   - The backend now routes these premium child inputs through the shared `app/matching.match_child_premium` helper so the component impact cards, match narratives, and alignment panels match the adult premium experience.

3. **Follow-Up**
   - Dashboard updated with the next recommended re-measure date and recent child analyses.
   - Notification prompt for future forecast windows.

### Key Pages Involved

- `/guardian` (dashboard)
- `/child-intake`
- `/child-results`
- `/child-premium`

### Consent

- Collected once at the first child analysis purchase, tied to guardian account.
- Co-guardians can later approve or revoke jointly in Account settings.

---

## Shared Navigation Principles

- **Desktop-first**: fixed top navigation bar, secondary side navigation in Dashboard and Intake flows.
- **Persistent CTAs**:
  - “See my match” (free flow)
  - “Start new analysis” (premium)
  - “Start child analysis” (guardian)
- **History access**: via Dashboard with sortable cards.
- **Measurement Locker**: available in Dashboard sidebar for quick reuse of past data.
- **Privacy & Consent Management**: under Account → Data & Privacy.

---

## Page Map (Summary)

| Page               | Purpose                              | Accessible To           |
| ------------------ | ------------------------------------ | ----------------------- |
| `/`                | Marketing homepage, free entry point | All                     |
| `/about`           | Mission & AI explanation             | All                     |
| `/pricing`         | Explains tiers & $5 credits          | All                     |
| `/science`         | Research summary & references        | All                     |
| `/intake`          | Free or premium data input           | Logged-out or logged-in |
| `/results`         | Free results                         | All                     |
| `/results/premium` | Paid detailed analysis               | Logged-in               |
| `/dashboard`       | Saved runs, credits, history         | Logged-in               |
| `/child-intake`    | Child analysis intake + credit gate  | Guardians               |
| `/child-results` | Child results (tabs: matches + forecast) | Guardians |
| `/account`         | Profile, consent, data rights        | Logged-in               |

---

## Summary

This document defines how users navigate through Sporty’s desktop MVP:

- **Free adults** can quickly discover suitable sports.
- **Paying adults** gain detailed, data-rich insights.
- **Guardians** purchase a child credit to forecast body trajectories and receive premium sport matches in one paid package.
- **Consent** is streamlined: once at signup, and once at the first paid adult or child analysis.

This hierarchy provides a clear framework for the frontend scaffold, ensuring all key routes, flows, and CTAs are aligned with Sporty’s product vision.


---

## 9. References

- Backend repo: `../sporty-backend`
- Worker deploy workflow: `.github/workflows/deploy.yml`
- Shared image catalog: `docs/images/catalog.yaml`
- Design system baseline: Tailwind component layer (`src/styles/tailwind.css`)
- Supabase auth helpers: `public/assets/js/app.js`

Update this handbook whenever we change page structure, deployment steps, or environment expectations.
