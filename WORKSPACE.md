# Sporty Workspace

This VS Code workspace contains two sibling repos:

- `sporty-frontend`: Cloudflare Worker that serves static UI and proxies API.
- `sporty-backend`: FastAPI service with `POST /recommend-adult-free`.

## Quick Start
1) Install deps:
   - Backend: Python 3.10+, `pip install -r ../sporty-backend/requirements.txt`
   - Frontend: `npm i -g wrangler` (Node 18+)
2) Set env:
   - Backend: `export API_KEY=dev-key-123`
   - Worker (dev): `wrangler secret put BACKEND_URL` → `http://127.0.0.1:8000`
     and `wrangler secret put BACKEND_API_KEY` → `dev-key-123`
3) Run tasks:
   - VS Code → Terminal → Run Task → "Dev: Both (Worker + Backend)"

## Troubleshooting
- 401 Unauthorized: Ensure Worker `BACKEND_API_KEY` equals backend `API_KEY`.
- Network errors: Verify backend at `http://127.0.0.1:8000` and worker at `http://127.0.0.1:8787`.
- CORS: Requests should go via the Worker; avoid direct browser calls to backend.
 - Health: Check Worker at `GET http://127.0.0.1:8787/api/healthz`. Avoid scheduled pings to the backend on Render free tier.
