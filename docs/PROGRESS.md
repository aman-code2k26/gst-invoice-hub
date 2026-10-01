# Progress

## Done
- [x] Business profile API
- [x] Client CRUD API (incl. **edit endpoint** `PUT /api/clients/:id`)
- [x] Invoice CRUD API
- [x] GST calculations (CGST/SGST/IGST after discount)
- [x] UPI QR
- [x] PDF generation (reusable builder — download endpoint + email attachment)
- [x] Invoice status lifecycle (DRAFT → SENT → VIEWED → PAID / OVERDUE)
- [x] Overdue detection computed consistently on list / detail / stats
- [x] **Email invoice** `POST /api/invoices/:id/send` (HTML mail + PDF, auto-marks DRAFT → SENT)
- [x] **Email reminder** `POST /api/invoices/:id/reminder` (HTML mail + PDF)
- [x] **Client email editing UI** (Clients tab → pencil → edit)
- [x] **Email button in invoice list** (smart: send vs reminder, "no email" guidance)
- [x] Gmail SMTP configured (App Password, git-ignored `.env`) — real delivery verified
- [x] Backend hardening: readable validation errors, Prisma error mapping (404/409/400/500), unique invoice numbers, invalid-date & foreign-client checks, `headersSent` guard
- [x] TypeScript build clean (backend `tsc`, frontend `next build`)
- [x] Responsive dashboard
- [x] **Repo live on GitHub**: https://github.com/aman-code2k26/gst-invoice-hub
- [x] **Site live on GitHub Pages** with auto-deploy workflow
- [x] **Public API via Cloudflare quick tunnel** + `scripts/live-demo.sh` restart/redeploy
- [x] Docs updated (README, PLANNING, PROGRESS, DEPLOYMENT, DEFENSE_QA)

## Not in hackathon scope
- [ ] Authentication / multi-tenant
- [ ] Background scheduler / cron (auto-overdue emails)
- [ ] Payment gateway webhook (UPI confirmation)
- [ ] Email open/click tracking
- [ ] Rate limiting & audit logs
