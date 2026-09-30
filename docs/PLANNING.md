# Planning

## User journey
Business profile → Client → Invoice → Preview → PDF/UPI → Send → Track → Reminder → Paid.

## 32-hour build plan
- 0–2h: architecture + UI
- 2–8h: dashboard/client/invoice UI
- 8–14h: invoice API + GST engine
- 14–18h: PDF + QR
- 18–22h: status/aging
- 22–26h: reminders
- 26–30h: testing/deployment
- 30–32h: demo, PPT and defense

## GST rules used by the demo
- Same-state: CGST = GST/2, SGST = GST/2
- Interstate: IGST = GST
- Tax is calculated after discount.
- GST rates are entered per line item.

> For production accounting, verify the applicable Indian tax rules with a qualified professional.
