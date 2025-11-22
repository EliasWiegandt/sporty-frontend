# Sporty Frontend

## Project Overview
The frontend for **Sporty**, a body-fit sports recommendation engine. This project handles the marketing website, user authentication (via Supabase), and the interactive intake flows for Adults and Children.

It is built with **Astro** and adapted for **Cloudflare Workers**, ensuring high performance and edge delivery.

### Key Technologies
- **Framework:** [Astro](https://astro.build/)
- **UI Library:** Preact (for interactive islands like the Intake form)
- **Styling:** Tailwind CSS
- **Infrastructure:** Cloudflare Pages / Workers (Adapter)
- **Auth & Data:** Supabase (Client-side integration)/
- **Payments:** Stripe (Checkout redirection)

## Key Files & Directories
- **`src/pages/`**: Astro routes.
    - `intake.astro`: Free adult intake shell.
    - `intake-premium.astro`: Premium adult intake shell.
    - `api/`: Server-side endpoints that proxy requests to the backend (hiding API keys).
- **`src/components/intake/IntakeApp.tsx`**: The primary Preact application managing the multi-step intake wizard.
- **`src/styles/tailwind.css`**: The source of truth for the design system (typography tokens `type-*`, layout shells `section-shell`, etc.).
- **`AGENTS.md`**: Guide for AI agents contributing to the frontend. **Read this second.**
- Intake design guidance now lives in the “Intake Experience” section of **`docs/handbook.md`**, which walks through the shared Preact island, stepper, and premium gating.
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

## Troubleshooting & Learnings

### 1. Rendering & HMR Issues
- **Symptom:** DOM elements (like match cards) appearing and then disappearing, or only partially rendering (e.g., 1 out of 3 cards).
- **Cause:** In Astro/Vite environments, scripts loaded with `is:inline` and `defer` can sometimes execute multiple times or conflict with Hot Module Replacement (HMR) state, leading to race conditions or double-initialization.
- **Fix:**
    1.  **Restart the Server:** `make run-frontend` (or `wrangler dev`) should be restarted to clear stale HMR state.
    2.  **Initialization Guards:** Use a global flag (e.g., `window.sportyResultsInitialized`) to ensure initialization logic (like `init()`) runs exactly once per page load.

### 2. Session Storage
- **Persistence:** `sessionStorage` is generally reliable across page loads in the same tab, but debugging it can be tricky if redirects happen quickly.
- **Debugging:** When debugging "missing data" issues, verify `sessionStorage` content manually in the console *before* assuming backend failure.

### 3. Script Scoping
- **IIFE & Debugging:** Code wrapped in an IIFE (Immediately Invoked Function Expression) is not accessible globally. To debug functions like `renderMatches` manually, you must explicitly expose them to `window` (e.g., `window.debugRenderMatches = renderMatches`) or set breakpoints.

### 4. Styling & Aspect Ratios
- **Avoid `<style>` in Astro:** Do not use `<style>` blocks in `.astro` files for global component styles (like `.match-card`). They can silently override Tailwind classes and cause confusion. Always centralize these styles in `src/styles/tailwind.css`.
- **Forcing Aspect Ratio:** To force a 1:1 (or other) aspect ratio on images that might be subject to global resets (like `img { height: auto }`):
    1.  **Container:** Use a wrapper (e.g., `<figure>`) with `width: 100%`, `aspect-ratio: 1/1`, and `overflow: hidden`.
    2.  **Image:** Use `display: block`, `width: 100%`, `height: 100% !important`, and `object-fit: cover`.
    3.  **Why !important?** It may be necessary to override global resets that force `height: auto`.

### 5. Component Reuse & Alignment
- **Shared Containers:** To ensure different content blocks (e.g., a list of details vs. a paragraph of text) align perfectly, reuse the exact same container class and HTML structure.
    - *Example:* The "Sports" details box and "Athletes' bodies" box both use `.match-card__desc-block` inside `.match-card__descriptions`.
    - *Benefit:* They automatically share the same padding, margins, and font styles, guaranteeing visual consistency without manual tweaking.
### 6. Verification Protocol
- **Manual Verification Only:** Do NOT perform visual verification (e.g., taking screenshots, using the browser tool, or running `make snap`) unless explicitly instructed by the user. The user will handle visual verification manually.
