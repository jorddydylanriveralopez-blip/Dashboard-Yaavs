# AGENTS.md

## Cursor Cloud specific instructions

Yaavs marketing dashboard: a Vite + React 19 + TypeScript SPA plus a small Express JSON API.

### Services & how to run (dev)
- `npm run dev:all` — runs both together (web + API) via `concurrently`.
- `npm run dev` — web only (Vite dev server, `http://localhost:5173`, `strictPort`).
- `npm run dev:server` — API only (Express, `http://localhost:3001`; health at `/api/health`).
- The API persists state to `server/data/store.json` (created on first run).
- The web app works standalone with `localStorage`. Cross-device sync via the API is opt-in: set `VITE_API_URL=http://localhost:3001` (see `.env.example`).

### Login
- Seed users live in `src/data/users.ts`. Admin login for testing: username `admin`, password `admin123`.

### Lint / build
- `npm run lint` and `npm run build` (`tsc -b && vite build`) — see `package.json`.
- Note: `npm run lint` currently reports pre-existing errors in the repo (unrelated to environment setup); the command itself runs fine.
