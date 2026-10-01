# Defense Q&A

### Why this product?
Student freelancers often use spreadsheets or manually designed invoices. This product combines invoicing, tax calculation, payment links and follow-ups in one flow.

### Why PostgreSQL?
Invoices, clients and line items are relational and need reliable transactions (an invoice + its line items are written in one atomic create).

### How is GST calculated?
The taxable subtotal is reduced by discount. For same-state invoices, GST is split equally between CGST and SGST. For interstate invoices, the full GST becomes IGST. Per-item tax is prorated by line amount, then rounded to 2 decimals.

### How is the UPI link generated?
The app creates a UPI deep link containing payee UPI ID, payee name, amount and invoice reference, then renders it as a QR code (`upi://pay?pa=...&pn=...&am=...&cu=INR`).

### How is overdue status detected?
Computed at read time: an unpaid, non-draft invoice whose due date has passed is reported as OVERDUE — consistently on the list, detail and stats endpoints. No cron needed, and status is never stale.

### How does invoice numbering work, and what if I delete an invoice?
`INV-YYYY-NNNN` starts from `count + 1` and loops until a free number is found — so deletions can never produce a duplicate (the column is unique at the DB level too).

### How does emailing an invoice work?
The invoice list has a mail button. It builds an HTML email (items table, totals, UPI payment link) **attaches the invoice PDF**, and sends via SMTP:
- DRAFT invoice → sends and automatically moves it to **SENT**
- Already sent → sends a **payment reminder**
If the client has no email, the UI guides the user to add one; if SMTP isn't configured, the API returns a clear message instead of failing.

### Which email service do you use? Are credentials safe?
Gmail SMTP with an **App Password** (not the account password). Credentials live only in `backend/.env`, which is git-ignored — verified with `git check-ignore`, so they never reach GitHub. The password can be revoked anytime at https://myaccount.google.com/apppasswords.

### How is the site deployed? Why not Vercel?
Frontend is a **static Next.js export auto-deployed to GitHub Pages** by GitHub Actions on every push — zero cost, no vendor account. The API runs locally and is exposed through a **Cloudflare quick tunnel** for the demo. This needed no paid service or extra signup; a Vercel/Render setup is documented in `docs/DEPLOYMENT.md` as the 24/7 alternative.

### Is user input validated?
Yes — Zod schemas on every endpoint: valid dates, email format, positive quantities, required fields, and cross-checks (client must belong to the business). Errors return readable messages (`email: Invalid email address`) with correct HTTP codes (400/404/409/500, never raw stack traces).

### What happens when the API is unreachable?
The UI shows an explicit "Cannot reach the API server" screen with the expected API URL and a Retry button — never an infinite loading spinner.

### What would you add next?
Authentication/multi-tenancy, recurring invoices, scheduled reminder jobs, payment gateway webhooks (UPI confirmation), email open tracking, rate limiting, GSTIN checksum validation and audit logs.
