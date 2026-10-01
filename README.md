# GST Invoice & Payment Link Hub

Hackathon-ready Micro-SaaS for student freelancers.

## 🔴 Live demo (for judges)

**https://aman-code2k26.github.io/gst-invoice-hub/**

Fully working deployment: static frontend on GitHub Pages + Express/Prisma API exposed
through a Cloudflare tunnel. To restart the demo backend after a reboot, run:

```bash
./scripts/live-demo.sh
```

(it starts the API + tunnel, updates the public API URL, and redeploys the frontend — takes ~2 minutes)


## Features
- Business profile with PAN/GST/UPI
- Client address book with **editable profiles + email** (pencil → edit)
- Dynamic invoice builder
- Automatic CGST/SGST or IGST calculation
- Discount support
- UPI QR generation
- Invoice lifecycle: DRAFT → SENT → VIEWED → PAID / OVERDUE
- PDF invoice generation
- **Email invoicing**: one click from the invoice list — sends the invoice (PDF attached) and marks DRAFT → SENT
- **One-click payment reminders** by email (HTML mail + PDF attachment)
- Client email shown per invoice (with "no email" hint)
- Effective overdue status computed consistently on list/detail/stats
- Input validation (dates, emails, foreign-client checks) with readable errors
- PostgreSQL + Prisma
- Next.js + Tailwind frontend
- Express API backend
- Gmail SMTP delivery (App Password), git-ignored credentials

## Project structure

```text
gst-invoice-hub/
├── frontend/                 # Next.js + Tailwind (static export → GitHub Pages)
├── backend/                  # Express + Prisma API
├── docs/                     # Planning, progress, deployment, defense Q&A
├── scripts/live-demo.sh      # Starts API + tunnel, redeploys frontend
└── .github/workflows/        # Auto-deploy frontend to GitHub Pages
```

## Requirements
- Node.js 20+
- PostgreSQL 15+
- npm

## 1. Backend

```bash
cd backend
cp .env.example .env      # then fill DATABASE_URL + SMTP (see below)
npm install
npx prisma generate
npx prisma migrate deploy  # applies prisma/migrations
npm run dev
```

Backend runs at http://localhost:4000

## 2. Frontend

Open another terminal:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Environment

Backend `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/gst_invoice_hub?schema=public"
PORT=4000
FRONTEND_URL="http://localhost:3000"

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Invoice Hub <no-reply@example.com>"
```

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Demo flow

1. Open dashboard (live link above, or http://localhost:3000).
2. **Clients tab → Add client** — include their **email** (required for sending).
3. **New invoice** → pick client, due date, CGST+SGST (same state) or IGST (interstate), items and discount → Save.
4. **Invoice list** → download the **PDF**, mark **PAID**, or click **✉️ email**:
   - DRAFT → emails the invoice (PDF attached) and marks it **SENT**
   - SENT/VIEWED/OVERDUE → emails a **payment reminder**
5. Watch dashboard stats update (paid / outstanding / overdue).

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET / PUT | `/api/business[/:id]` | Business profile |
| GET / POST | `/api/clients` | List / create clients |
| PUT / DELETE | `/api/clients/:id` | Edit / delete client |
| GET / POST | `/api/invoices` | List / create invoices |
| GET | `/api/invoices/:id` | Invoice detail (effective status) |
| PATCH | `/api/invoices/:id/status` | Change lifecycle status |
| GET | `/api/invoices/:id/pdf` | Download PDF |
| GET | `/api/invoices/:id/qr` | UPI QR (data URL) |
| POST | `/api/invoices/:id/send` | **Email invoice (PDF) + mark SENT** |
| POST | `/api/invoices/:id/reminder` | **Email payment reminder (PDF)** |
| GET | `/api/stats?businessId=` | Dashboard aggregates |

## Deployment

### Current (live) architecture — fully free, no hosting accounts

| Layer | How |
|---|---|
| Frontend | **GitHub Pages** — static export, auto-built by GitHub Actions on every push (`.github/workflows/deploy-pages.yml`) |
| Backend | Runs locally (`scripts/live-demo.sh`) and is exposed publicly through a **Cloudflare quick tunnel** |
| Database | Local PostgreSQL |
| Email | Gmail SMTP via App Password (`backend/.env`, git-ignored) |

Restart everything with:
```bash
./scripts/live-demo.sh
```
It starts/restarts the API + tunnel, updates the site's API URL and redeploys the frontend (~2 min).
Run it once before demos — tunnel URLs change on restart.

### Alternative: 24/7 cloud hosting (Render + Vercel + Neon)
See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for full instructions.

## Production notes
- Add authentication before real-world use.
- Do not store bank passwords or UPI PINs.
- Use HTTPS.
- Keep GST/tax settings configurable.
- Configure a transactional email provider for automatic reminders.
- Add rate limiting and request validation before public launch.
