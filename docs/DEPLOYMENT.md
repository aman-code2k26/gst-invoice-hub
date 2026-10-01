# Deployment

## A. Current live deployment (free — what the judges link uses)

**Live site:** https://aman-code2k26.github.io/gst-invoice-hub/
**Repo:** https://github.com/aman-code2k26/gst-invoice-hub

| Layer | Service | How it deploys |
|---|---|---|
| Frontend | GitHub Pages | Push to `main` → GitHub Actions builds the static export (`.github/workflows/deploy-pages.yml`) and publishes `frontend/out` |
| API | Local Express | Started by `scripts/live-demo.sh` on port 4000 |
| Public API URL | Cloudflare quick tunnel | `scripts/live-demo.sh` starts a tunnel and writes its URL into the workflow env (`NEXT_PUBLIC_API_URL`), then pushes → frontend redeploys |
| Database | Local PostgreSQL | `DATABASE_URL` in `backend/.env` |
| Email | Gmail SMTP (App Password) | `SMTP_*` in `backend/.env` (git-ignored) |

### Daily demo routine
```bash
cd gst-invoice-hub   # repo folder
./scripts/live-demo.sh
```
- Verifies/starts the API and tunnel
- If the tunnel URL changed → updates the workflow + pushes → site redeploys (~2 min)
- Open https://aman-code2k26.github.io/gst-invoice-hub/ (hard refresh if cached)

### Frontend build settings
`frontend/next.config.ts`:
- `output: "export"` — static files for Pages
- `basePath: process.env.NEXT_PUBLIC_BASE_PATH || ""` — set to `/gst-invoice-hub` in CI only (local dev unaffected)

### Credentials security
- `backend/.env` is git-ignored (verified with `git check-ignore`) — SMTP + DB passwords never reach GitHub
- Tunnel URLs are ephemeral; only the workflow file stores the current one

---

## B. Alternative: 24/7 cloud hosting (no laptop needed)

### 1. Database — Neon / Supabase / Render Postgres
Create a PostgreSQL database, then:
```bash
DATABASE_URL=<connection-string> npx prisma migrate deploy
```

### 2. API — Render (free tier)
- New → Web Service → connect this repo, root directory `backend`
- Build: `npm install && npx prisma generate && npm run build && npx prisma migrate deploy`
- Start: `npm start`
- Env vars:
  ```env
  DATABASE_URL=...
  FRONTEND_URL=https://<your-frontend-domain>
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=...
  SMTP_PASS=...
  SMTP_FROM="Name <user@gmail.com>"
  ```
- Health check path: `/api/health` (Render sets `PORT` automatically — the app reads it)

### 3. Frontend — Vercel (or keep GitHub Pages)
- Import repo, root directory `frontend`
- Env var: `NEXT_PUBLIC_API_URL=https://<your-render-domain>/api`
- Redeploy (or just push if using the Pages workflow after updating `NEXT_PUBLIC_API_URL`)

### 4. CORS
Backend `FRONTEND_URL` must include the exact frontend origin, comma-separated for several:
```env
FRONTEND_URL="http://localhost:3000,https://your-frontend-domain"
```

---

## SMTP (email to clients)

Works with any provider; Gmail App Password example:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASS=your16-character-app-password
SMTP_FROM="Your Studio <yourname@gmail.com>"
```

Getting a Gmail App Password:
1. https://myaccount.google.com/security → enable **2-Step Verification**
2. https://myaccount.google.com/apppasswords → create one (e.g. `invoice-hub`)
3. Copy the 16-character password into `backend/.env` and restart

Without SMTP configured, the UI's email button still responds with
`"SMTP is not configured…"` instead of failing.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Live site shows "Failed to fetch" | Tunnel URL died → run `./scripts/live-demo.sh`, wait ~2 min, hard refresh |
| "SMTP is not configured" | Fill `SMTP_*` in `backend/.env`, restart backend |
| "Client email is missing" | Clients tab → pencil → add email |
| Port 4000 in use | `lsof -i :4000` then stop the other process, or run with `PORT=4010` |
| Fresh database | `cd backend && npx prisma migrate deploy && npx prisma db seed` |
