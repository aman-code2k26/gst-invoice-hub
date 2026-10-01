# Planning

## User journey
Business profile → Client (with email) → Invoice → Preview → PDF/UPI → **Email (invoice or reminder, PDF attached)** → Track status → Reminder → Paid.

## 32-hour build plan
- 0–2h: architecture + UI
- 2–8h: dashboard/client/invoice UI
- 8–14h: invoice API + GST engine
- 14–18h: PDF + QR
- 18–22h: status/aging
- 22–26h: **email sending (invoice + reminder) & client email editing**
- 26–30h: testing/deployment (GitHub Pages + tunnel + live-demo script)
- 30–32h: demo, PPT and defense

## GST rules used by the demo
- Same-state: CGST = GST/2, SGST = GST/2
- Interstate: IGST = GST
- Tax is calculated after discount.
- GST rates are entered per line item.

> For production accounting, verify the applicable Indian tax rules with a qualified professional.

## Key design decisions
- **Single-tenant demo**: one business profile per workspace (no auth in hackathon scope).
- **Invoice numbering**: `INV-YYYY-NNNN` generated from count with a uniqueness loop — deletions can never cause collisions.
- **Effective status**: overdue is computed at read time (list, detail, stats) instead of mutating rows on a cron.
- **Email delivery**: Gmail SMTP with an App Password stored only in git-ignored `backend/.env`; emails include the invoice PDF.
- **Hosting**: frontend on GitHub Pages (static export), API local + Cloudflare quick tunnel — zero paid accounts for the demo.
