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
- Client address book
- Dynamic invoice builder
- Automatic CGST/SGST or IGST calculation
- Discount support
- UPI QR generation
- Invoice lifecycle: DRAFT → SENT → VIEWED → PAID / OVERDUE
- PDF invoice generation
- One-click reminder email
- PostgreSQL + Prisma
- Next.js + Tailwind frontend
- Express API backend

## Project structure

```text
gst-invoice-hub/
├── frontend/        # Next.js + Tailwind
├── backend/         # Express + Prisma API
└── docs/
```

## Requirements
- Node.js 20+
- PostgreSQL 15+
- npm

## 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
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

1. Open dashboard.
2. Add a client.
3. Create an invoice.
4. Select CGST+SGST for same-state billing or IGST for interstate billing.
5. Add items and discount.
6. Save invoice.
7. Open invoice and download PDF.
8. Send it / change status.
9. Use the reminder action for overdue invoices.

## Deployment

### Database: Supabase / Neon / any PostgreSQL
Create a PostgreSQL database and copy its connection string into `DATABASE_URL`.

### Backend: Render / Railway / Fly.io
Build command:
```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

Start command:
```bash
npm start
```

Set:
- `DATABASE_URL`
- `PORT=4000`
- `FRONTEND_URL=https://your-frontend-domain`
- SMTP variables if email reminders are required

### Frontend: Vercel
Set:
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain/api
```

Then deploy the `frontend` directory.

## Production notes
- Add authentication before real-world use.
- Do not store bank passwords or UPI PINs.
- Use HTTPS.
- Keep GST/tax settings configurable.
- Configure a transactional email provider for automatic reminders.
- Add rate limiting and request validation before public launch.
