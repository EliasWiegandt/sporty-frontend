# Sporty User Journeys (Desktop MVP)

This document defines the **high-level navigation and user flows** for the Sporty MVP (desktop-only).  
It focuses on how users move through the website to complete their core use cases — not on individual component design.

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

   - User enters body measurements.
   - Optionally adds past sports (anonymous if not logged in).
   - If logged in, results can be saved automatically.

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

   - Prefilled measurements from last run.
   - User adds preferences, goals, injuries, and performance factors.
   - Sidebar or top banner shows available credits.

2. **Submit ➝ Results (Premium Analysis)**

   - Results page includes charts, breakdowns, and insights (body, goals, preferences, injuries).
   - User can compare with previous runs via History.

3. **Optional Next Steps**
   - “Start another analysis”
   - “View history”
   - “Share insights” (lightweight link copy only)

### Key Pages Involved

- `/dashboard`
- `/intake?premium=true`
- `/results/premium`
- `/pricing`

### Consent

- Triggered once at first paid analysis, covering future detailed runs.

---

## 3. Guardian Journey (Child Forecast)

### Goal

Forecast a child’s likely sports suitability using their and their parents’ body data.

### Entry Points

- “Forecast a child” CTA on Home.
- “Forecast new child” from Guardian Dashboard.

### Flow

1. **Guardian Dashboard ➝ Forecast New ➝ Intake (Child)**

   - Step 1: Choose or create child profile.
   - Step 2: Input child measurements.
   - Step 3: Confirm or edit parent measurements.
   - Credit check and consent if first use.

2. **Submit ➝ Results (Child Forecast)**

   - Forecasted adult body profile and top matching sports.
   - Visuals: growth projections, parental contribution chart.
   - CTA to “Save forecast” or “Add co-guardian”.

3. **Follow-Up**
   - Dashboard updated with next recommended re-measure date.
   - Notification prompt for future forecast.

### Key Pages Involved

- `/guardian` (dashboard)
- `/child-intake`
- `/child-results`

### Consent

- Collected once at first child forecast purchase, tied to guardian account.
- Co-guardians can later approve or revoke jointly in Account settings.

---

## Shared Navigation Principles

- **Desktop-first**: fixed top navigation bar, secondary side navigation in Dashboard and Intake flows.
- **Persistent CTAs**:
  - “See my match” (free flow)
  - “Start new analysis” (premium)
  - “Forecast a child” (guardian)
- **History access**: via Dashboard with sortable cards.
- **Measurement Locker**: available in Dashboard sidebar for quick reuse of past data.
- **Privacy & Consent Management**: under Account → Data & Privacy.

---

## Page Map (Summary)

| Page               | Purpose                              | Accessible To           |
| ------------------ | ------------------------------------ | ----------------------- |
| `/`                | Marketing homepage, free entry point | All                     |
| `/about`           | Mission & AI explanation             | All                     |
| `/pricing`         | Explains tiers & credits             | All                     |
| `/intake`          | Free or premium data input           | Logged-out or logged-in |
| `/results`         | Free results                         | All                     |
| `/results/premium` | Paid detailed analysis               | Logged-in               |
| `/dashboard`       | Saved runs, credits, history         | Logged-in               |
| `/child-intake`    | Child forecast input                 | Guardians               |
| `/child-results`   | Child forecast results               | Guardians               |
| `/account`         | Profile, consent, data rights        | Logged-in               |

---

## Summary

This document defines how users navigate through Sporty’s desktop MVP:

- **Free adults** can quickly discover suitable sports.
- **Paying adults** gain detailed, data-rich insights.
- **Guardians** forecast sports for their children.
- **Consent** is streamlined: once at signup, and once at first paid analysis.

This hierarchy provides a clear framework for the frontend scaffold, ensuring all key routes, flows, and CTAs are aligned with Sporty’s product vision.
