# Sporty – Vision & Implementation Plan

## Vision

Sporty helps people find sports that fit them best. Recommendations combine **body measurements**, **preferences**, **injuries**, and **goals**. Two tracks drive the experience: **adults** and **children**.

- **Front page (free, no login)**
  - Adults (18+) can enter body measurements and receive a basic sport recommendation.
  - Free, anonymous, body-only scoring.

- **Logged-in users (free)**
  - Adults can store multiple measurement sets.
  - Re-run the free body-based suggestion without retyping.

- **Paid features (one-time purchases, $5 each via Stripe Checkout)**
  - **Adult Package**
    - Intake adds preferences, injuries, goals.
    - Returns a detailed analysis with richer recommendations.
    - Each purchase grants one adult analysis credit.
  - **Child Package**
    - Intake collects a child’s measurements.
    - Optionally links consenting parent accounts to include parent data.
    - Forecasts the child’s future adult body and recommends likely-fit sports.
    - Each purchase grants one child analysis credit tied to a single child profile.
    - Checkout requires `subject_child_id` metadata so credits are scoped correctly.
  - **Linking parents**
    - Guardians confirm relationships through invitations/approvals.
    - Only data from consenting parents is included.
    - Adults cannot enter another adult’s body data without their account.
  - **Mixing packages**
    - Users can hold adult and child credits simultaneously.
    - Adult analyses always require an adult credit, even if linked to a child.

## Requirements for Implementation

Codex (this agent) supports the teams by mapping pages, flows, and integration points across frontend, backend, and Supabase.

### Pages (initial backlog)
- Front page (marketing + CTA to free flow)
- Free suggestion page (body measurements → basic recommendation)
- Login/signup (Supabase auth)
- Purchase page (select Adult or Child package, redirect to Stripe Checkout)
- Saved measurements (manage stored bodies for logged-in adults)
- Add child (create child profile, input measurements, request second parent link)
- Link parent (send/accept guardian invitations)
- Analysis results (display basic vs detailed vs forecast outputs)

### Backend & Infrastructure
- **Supabase**
  - Auth + Postgres with RLS and guardian links.
  - Tables: users, children, guardianships, measurements, preferences, injuries, goals, past sports, billing_products, purchases, analysis_credits, recommendation_results.
- **Stripe**
  - One-time products: `adult_package`, `child_package` ($5 each).
  - Checkout sessions created server-side; webhooks grant credits.
- **Backend (FastAPI on Render)**
  - `/recommend-adult-free` supports free flow.
  - Add `/create-checkout-session`, `/stripe-webhook`, and persistence endpoints.
- **Frontend (Cloudflare Worker + site)**
  - Routes pages, proxies backend calls, manages Supabase auth state.
  - Redirects to Stripe Checkout and handles return URLs.
- **Environments**
  - Test (`sporty-test`) and Production (`sporty`).
  - Deploy via GitHub Actions (Worker + Render). Supabase seeded separately with Makefile commands.

Keep documentation synchronized as flows evolve so both repos reflect the shared product direction.
