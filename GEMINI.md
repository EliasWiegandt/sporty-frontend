# Sporty Frontend

## Project Overview
The frontend for **Sporty**, a body-fit sports recommendation engine. This project handles the marketing website, user authentication (via Supabase), and the interactive intake flows for Adults and Children.

It is built with **Astro** and adapted for **Cloudflare Workers**, ensuring high performance and edge delivery.

### Key Technologies
- **Framework:** [Astro](https://astro.build/)
- **UI Library:** Preact (for interactive islands like the Intake form)
- **Styling:** Tailwind CSS
- **Infrastructure:** Cloudflare Pages / Workers (Adapter)
- **Auth & Data:** Supabase (Client-side integration)
- **Payments:** Stripe (Checkout redirection)

## Key Files & Directories
- **`src/pages/`**: Astro routes.
    - `intake.astro`: Free adult intake shell.
    - `intake-premium.astro`: Premium adult intake shell.
    - `api/`: Server-side endpoints that proxy requests to the backend (hiding API keys).
- **`src/components/intake/IntakeApp.tsx`**: The primary Preact application managing the multi-step intake wizard.
- **`src/styles/tailwind.css`**: The source of truth for the design system (typography tokens `type-*`, layout shells `section-shell`, etc.).
- **`AGENTS.md`**: Guide for AI agents contributing to the frontend. **Read this second.**
- **`docs/intake-design.md`**: Detailed design specification for the intake flow.
- **`docs/handbook.md`**: The definitive guide to the frontend architecture, visitor journeys, and consent policies. **Read this first.**
- **`public/assets/js/app.js`**: Global Supabase auth wrapper (`window.SportyApp`).

## Building and Running

### Prerequisites
- Node.js v20+
- `npm`

### Commands
- **Install Dependencies:**
  ```bash
  npm install
  ```
- **Start Dev Server (Astro):**
  ```bash
  npm run dev
  ```
  Runs at `http://localhost:4321`. Good for layout/content work.
- **Start Worker Preview (Wrangler):**
  ```bash
  npm run build && wrangler dev
  ```
  Simulates the Cloudflare Worker environment. Essential for testing API proxies (`/api/*`) and auth flows.
- **Build for Production:**
  ```bash
  npm run build
  ```
- **Verify UI:**
  ```bash
  make snap
  ```
  Runs Puppeteer to verify the intake flow and take screenshots.

## Development Conventions

### 1. Design System
- **Strict Tailwind Usage:** Do not create new CSS files. Use the utility classes defined in `src/styles/tailwind.css`.
- **Typography:** Always use `type-display`, `type-title`, `type-body`, etc., instead of raw `text-xl` classes for text.
- **Layout:** Use `section-shell` and `card-shell` to maintain consistent spacing and container widths.

### 2. Component Architecture
- **Islands Architecture:** The site is mostly static HTML. Use `client:load` or `client:visible` only for complex interactive parts (like the Intake form).
- **Intake Logic:** The `IntakeApp` (Preact) handles state and validation. It communicates with the Astro backend proxies (`/api/...`) which then talk to the Python backend.
- **Vanilla JS:** Scripts in `public/assets/js/` are NOT bundled. Keep them compatible with plain browsers (no imports/exports unless using native modules).

### 3. Documentation
- **Handbooks:** Keep `docs/handbook.md` updated. It is the source of truth.
- **Agents:** Refer to `AGENTS.md` for instructions on how AI agents should interact with this repo.
