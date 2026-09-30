# Deployment

## PostgreSQL
Create a PostgreSQL database on Supabase, Neon, Railway, or another provider.

Set:
`DATABASE_URL=...`

Run:
```bash
npx prisma migrate deploy
```

## Express API
Recommended:
- Render
- Railway
- Fly.io

Root directory: `backend`

Build:
```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

Start:
```bash
npm start
```

## Next.js
Recommended:
- Vercel

Root directory: `frontend`

Environment:
```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND/api
```

## CORS
Backend:
```env
FRONTEND_URL=https://YOUR-FRONTEND
```

## SMTP
For reminder emails, configure any SMTP provider:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Invoice Hub <no-reply@example.com>"
```
