Supabase Schema & Policies (Draft)

Canonical plan for auth, storage, and row-level security. Adult-only MVP first; child flows follow.

Auth
- Use Supabase Auth (email/password, optional OAuth) with `auth.users` as the authority.
- Frontend uses `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (public client key).
- Backend uses `SUPABASE_SECRET_KEY` for server-side operations; never expose to clients.
- In the Supabase dashboard go to **Settings → API → Data API**, add `public` (alongside `api`) to **Exposed schemas**, and include `public` in **Extra search path**. Otherwise the Data API returns `PGRST106` when REST clients (such as the taxonomy seeding script) target tables in the `public` schema.

Tables

1) profiles
- id: uuid PK (matches `auth.users.id`)
- created_at: timestamptz default now()
- updated_at: timestamptz default now()
- display_name: text
- birthdate: date null
- sex: text null
- is_adult: boolean not null default true

2) children
- id: uuid PK default gen_random_uuid()
- created_at: timestamptz default now()
- birthdate: date not null
- sex: text not null
- name: text null (pseudonym allowed)

3) guardianships
- id: uuid PK default gen_random_uuid()
- guardian_user_id: uuid not null references auth.users(id)
- child_id: uuid not null references children(id)
- role: text not null default 'parent'  -- e.g., parent, legal_guardian
- created_at: timestamptz default now()
- unique (guardian_user_id, child_id)

4) guardian_invites
- id: uuid PK default gen_random_uuid()
- child_id: uuid not null references children(id)
- inviter_user_id: uuid not null references auth.users(id)
- invitee_email: text null
- token_hash: text not null (sha256 of plaintext token; store only hash)
- status: text not null in ('issued','accepted','approved','revoked','expired')
- invited_user_id: uuid null (set after accept)
- issued_at: timestamptz default now()
- expires_at: timestamptz not null
- accepted_at: timestamptz null
- approved_by: uuid null references auth.users(id)
- approved_at: timestamptz null

4) measurements
- id: uuid PK default gen_random_uuid()
- subject_type: text not null check in ('adult','child')
- subject_user_id: uuid null references auth.users(id)  -- when subject_type='adult'
- subject_child_id: uuid null references children(id)   -- when subject_type='child'
- measured_at: timestamptz not null default now()
- height_cm: numeric(6,2) null
- weight_kg: numeric(6,2) null
- arm_span_cm: numeric(6,2) null
- leg_inseam_cm: numeric(6,2) null
- shoulder_width_cm: numeric(6,2) null
- hip_width_cm: numeric(6,2) null
- hand_length_cm: numeric(6,2) null
- foot_length_cm: numeric(6,2) null

5) preferences
- id: uuid PK default gen_random_uuid()
- subject_type: text not null ('adult','child')
- subject_user_id: uuid null references auth.users(id)
- subject_child_id: uuid null references children(id)
- notes: text null
- tags: text[] not null default '{}'
- created_at: timestamptz default now()

6) health_injuries
- id: uuid PK default gen_random_uuid()
- subject_type: text not null ('adult','child')
- subject_user_id: uuid null references auth.users(id)
- subject_child_id: uuid null references children(id)
- description: text not null
- onset_date: date null
- severity: text null  -- e.g., mild|moderate|severe
- created_at: timestamptz default now()

7) goals
- id: uuid PK default gen_random_uuid()
- subject_type: text not null ('adult','child')
- subject_user_id: uuid null references auth.users(id)
- subject_child_id: uuid null references children(id)
- goal_type: text not null  -- 'body' | 'skill'
- description: text not null
- target_date: date null
- created_at: timestamptz default now()

8) past_sports
- id: uuid PK default gen_random_uuid()
- subject_type: text not null ('adult','child')
- subject_user_id: uuid null references auth.users(id)
- subject_child_id: uuid null references children(id)
- sport_id: uuid references sports(id)
- liked: boolean null
- skill_rating: int2 null check 1..5
- years: int2 null
- created_at: timestamptz default now()

9) submissions
- id: uuid PK default gen_random_uuid()
- user_id: uuid not null references auth.users(id)  -- who submitted
- subject_type: text not null ('self','child')
- subject_child_id: uuid null references children(id)
- payload: jsonb not null  -- snapshot of all inputs
- created_at: timestamptz default now()

10) recommendations
- id: uuid PK default gen_random_uuid()
- user_id: uuid not null references auth.users(id)
- submission_id: uuid not null references submissions(id)
- model_version: text not null
- summary: text null
- created_at: timestamptz default now()

11) recommendation_items
- id: uuid PK default gen_random_uuid()
- recommendation_id: uuid not null references recommendations(id)
- sport_id: uuid references sports(id)
- rank: int2 not null
- reason: text not null

12) consents
- id: uuid PK default gen_random_uuid()
- user_id: uuid references auth.users(id)
- child_id: uuid references children(id)
- consent_type: text not null  -- 'data_retention' | 'child_guardian' | etc.
- version: text not null
- granted_at: timestamptz not null default now()
- revoked_at: timestamptz null

13) sports
- id: uuid PK default gen_random_uuid()
- slug: text unique (generated from taxonomy ids)
- name: text not null
- description: text null

14) roles
- id: uuid PK default gen_random_uuid()
- slug: text unique not null (concatenated hierarchy, e.g. `swimming-freestyle-sprint`)
- sport_slug: text not null references sports(slug)
- category: jsonb not null default '{}'::jsonb (contains nested `id`/`name`/`description` for each taxonomy level; the top-level sport entry is included)
- created_at: timestamptz default now()

15) optimal_bodies  (import of backend data)
- id: bigint generated always as identity primary key
- sport_slug: text not null references sports(slug)
- category_slug: text null references roles(slug)
- cohorts: jsonb not null (e.g. `{ "sex": "female", "level": "elite" }`)
- spec: jsonb not null (body ranges, rationale, example athletes, etc.)
- model: text not null
- source: text not null default 'backend_generated'
- version: int not null default 1
- is_current: boolean not null default true (only one current row per sport/category/cohort)
- replaced_by: bigint null (links superseded rows)
- replaced_at: timestamptz null
- created_at / updated_at: timestamptz default now()

RLS Policies (high-level)
- profiles: owner-only (auth.uid() = id).
- measurements/preferences/health_injuries/goals/past_sports: owner-only for adults; for children, allow if `auth.uid()` is in guardianships for the row’s child.
- submissions/recommendations/recommendation_items: owner-only (auth.uid() = user_id).
- consents: owner-only; for child consents, the guardian creating them can read.
- sports/roles/optimal_bodies: readable by all (SELECT), writes restricted to backend using the Supabase secret key.
- guardian_invites: readable by inviter, invited user, and active guardians of the child; writes via RPCs only.

Billing tables
- `billing_products(id, name, description, credit_type, stripe_price_id_test, stripe_price_id_live, is_active, metadata)`
  - Public SELECT so the frontend can present offerings.
  - Writes restricted to backend using the Supabase secret key.
- `purchases(id, user_id, product_id, stripe_price_id, stripe_mode, amount, currency, quantity, status, paid_at, raw)`
  - Links Supabase users to Stripe Checkout sessions and the product purchased.
- `analysis_credits(id, user_id, product_id, credit_type, remaining, source_purchase_id, subject_child_id, consumed_at, metadata)`
  - Tracks remaining credits and which child (if any) they are reserved for.

NOTE: Backend requests that require elevated privileges must use the Supabase secret key; prefer RLS with anon/user JWTs for client reads. All writes go through backend endpoints or vetted RPCs for validation and auditing.

Import Plan (optimal_bodies)
- Parse `../sporty-backend/data/optimal_bodies/generated_gpt-5-mini.jsonl`.
- For each line, map fields: sport, category_path, cohorts, spec, model.
- Insert into `optimal_bodies`.
- Optionally derive/normalize to link sport to `sports` and roles to `roles`.

Required Environment
- Frontend: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (public, client)
- Backend: SUPABASE_URL, SUPABASE_SECRET_KEY (secret, server)

Pages (planned)
- Free example (anonymous) on front page (body-only inputs, no storage).
- Adult intake (authenticated) with health, injuries, goals, tags, past sports.
- Parent intake (authenticated) to input parent data for child recommendations.
- Child intake (authenticated guardian) for child’s measurements and preferences.
- Consent screens (adult data retention; guardian consent for child data).
- Results view + history of submissions and recommendations.
- Account settings: profile, export/delete data (DSR), sign-out.
  - Legal pages: Privacy, Terms, Disclaimers.

SQL Files
- Backend keeps canonical SQL files:
  - `../sporty-backend/supabase/schema.sql` — tables and constraints
  - `../sporty-backend/supabase/policies.sql` — RLS policies
Apply them in the Supabase SQL editor (in order) or via `psql`.

RPCs (auth required)
- `api.create_child(name text, birthdate date, sex sex_kind) -> uuid`
- `api.invite_guardian(child_id uuid, invitee_email text default null, ttl_hours int default 168) -> text` (returns plaintext token)
- `api.accept_guardian_invite(token text) -> uuid` (returns child_id)
- `api.approve_guardian_invite(invite_id uuid) -> void`
- `api.revoke_guardian(child_id uuid, guardian_user_id uuid) -> void`
