# Defense Q&A

### Why this product?
Student freelancers often use spreadsheets or manually designed invoices. This product combines invoicing, tax calculation, payment links and follow-ups.

### Why PostgreSQL?
Invoices, clients and line items are relational and need reliable transactions.

### How is GST calculated?
The taxable subtotal is reduced by discount. For same-state invoices, GST is split equally between CGST and SGST. For interstate invoices, the full GST becomes IGST.

### How is the UPI link generated?
The app creates a UPI deep link containing payee UPI ID, payee name, amount and invoice reference, then renders it as a QR code.

### How is overdue status detected?
An unpaid invoice whose due date has passed is treated as overdue by the status endpoint.

### What would you add next?
Authentication, recurring invoices, payment gateway webhooks, scheduled email jobs, audit logs, GSTIN validation and multi-tenant billing.
