import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient, Prisma, InvoiceStatus, TaxMode } from "@prisma/client";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { z } from "zod";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL?.split(",") ?? "*" }));
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);

const emptyToNull = (v: unknown) => (v === "" ? null : v);
const optionalText = z.preprocess(emptyToNull, z.string().nullable().optional());
const optionalEmail = z.preprocess(emptyToNull, z.string().email().nullable().optional());

const businessSchema = z.object({
  name: z.string().min(2),
  ownerName: optionalText,
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  pan: optionalText,
  gstin: optionalText,
  state: optionalText,
  upiId: optionalText,
  logoUrl: optionalText
});

const clientSchema = z.object({
  businessId: z.string(),
  name: z.string().min(2),
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  gstin: optionalText,
  state: optionalText
});

const clientUpdateSchema = clientSchema.partial();

const invoiceSchema = z.object({
  businessId: z.string(),
  clientId: z.string(),
  dueDate: z.string().refine(s => !Number.isNaN(new Date(s).getTime()), {
    message: "dueDate must be a valid date"
  }),
  taxMode: z.enum(["INTRA_STATE", "INTER_STATE"]),
  discount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    rate: z.number().nonnegative(),
    gstRate: z.number().nonnegative()
  })).min(1)
});

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calculate(items: Array<{quantity:number;rate:number;gstRate:number}>, discount: number, taxMode: TaxMode) {
  const subtotal = round(items.reduce((s, x) => s + x.quantity * x.rate, 0));
  const taxableAmount = round(Math.max(0, subtotal - discount));
  const grossBeforeTax = subtotal || 1;
  let cgst = 0, sgst = 0, igst = 0;
  if (taxMode === "INTRA_STATE") {
    const totalTax = items.reduce((sum, x) => {
      const proportion = (x.quantity * x.rate) / grossBeforeTax;
      return sum + taxableAmount * proportion * (x.gstRate / 100);
    }, 0);
    cgst = round(totalTax / 2);
    sgst = round(totalTax / 2);
  } else {
    igst = round(items.reduce((sum, x) => {
      const proportion = (x.quantity * x.rate) / grossBeforeTax;
      return sum + taxableAmount * proportion * (x.gstRate / 100);
    }, 0));
  }
  return { subtotal, taxableAmount, cgst, sgst, igst, total: round(taxableAmount + cgst + sgst + igst) };
}

function upiLink(upiId: string | null | undefined, name: string, amount: number, invoiceNumber: string) {
  if (!upiId) return null;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Invoice " + invoiceNumber)}`;
}

function withEffectiveStatus<T extends { status: InvoiceStatus; dueDate: Date }>(invoice: T, now = new Date()): T {
  const overdue = invoice.status !== InvoiceStatus.PAID
    && invoice.status !== InvoiceStatus.DRAFT
    && invoice.status !== InvoiceStatus.OVERDUE
    && invoice.dueDate < now;
  return overdue ? { ...invoice, status: InvoiceStatus.OVERDUE } : invoice;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "GST Invoice Hub API" }));

app.get("/api/business", async (_req, res) => {
  let business = await prisma.businessProfile.findFirst({ include: { clients: true } });
  if (!business) {
    business = await prisma.businessProfile.create({ data: { name: "My Freelance Studio" }, include: { clients: true } });
  }
  res.json(business);
});

app.put("/api/business/:id", async (req, res) => {
  const data = businessSchema.parse(req.body);
  const business = await prisma.businessProfile.update({ where: { id: req.params.id }, data });
  res.json(business);
});

app.get("/api/clients", async (req, res) => {
  const businessId = String(req.query.businessId);
  res.json(await prisma.client.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } }));
});

app.post("/api/clients", async (req, res) => {
  const data = clientSchema.parse(req.body);
  res.status(201).json(await prisma.client.create({ data }));
});

app.delete("/api/clients/:id", async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

app.put("/api/clients/:id", async (req, res) => {
  const data = clientUpdateSchema.parse(req.body);
  const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Client not found" });
  const { businessId: _ignored, ...updates } = data;
  res.json(await prisma.client.update({ where: { id: req.params.id }, data: updates }));
});

app.get("/api/invoices", async (req, res) => {
  const businessId = String(req.query.businessId);
  const invoices = await prisma.invoice.findMany({
    where: { businessId },
    include: { client: true, items: true },
    orderBy: { createdAt: "desc" }
  });
  const now = new Date();
  res.json(invoices.map(inv => withEffectiveStatus(inv, now)));
});

app.post("/api/invoices", async (req, res) => {
  const data = invoiceSchema.parse(req.body);
  const business = await prisma.businessProfile.findUnique({ where: { id: data.businessId } });
  if (!business) return res.status(404).json({ error: "Business not found" });

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client || client.businessId !== data.businessId) {
    return res.status(400).json({ error: "Client not found for this business" });
  }

  const count = await prisma.invoice.count({ where: { businessId: data.businessId } });
  const year = new Date().getFullYear();
  let sequence = count + 1;
  let invoiceNumber = `INV-${year}-${String(sequence).padStart(4, "0")}`;
  while (await prisma.invoice.findUnique({ where: { invoiceNumber } })) {
    sequence += 1;
    invoiceNumber = `INV-${year}-${String(sequence).padStart(4, "0")}`;
  }
  const calc = calculate(data.items, data.discount, data.taxMode as TaxMode);
  const link = upiLink(business.upiId, business.name, calc.total, invoiceNumber);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      businessId: data.businessId,
      clientId: data.clientId,
      dueDate: new Date(data.dueDate),
      taxMode: data.taxMode as TaxMode,
      discount: data.discount,
      notes: data.notes,
      ...calc,
      upiLink: link,
      items: { create: data.items.map(i => ({ ...i, amount: round(i.quantity * i.rate) })) }
    },
    include: { client: true, business: true, items: true }
  });

  res.status(201).json(invoice);
});

app.get("/api/invoices/:id", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, business: true, items: true }
  });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json(withEffectiveStatus(invoice));
});

app.patch("/api/invoices/:id/status", async (req, res) => {
  const status = z.enum(["DRAFT","SENT","VIEWED","PAID","OVERDUE"]).parse(req.body.status) as InvoiceStatus;
  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: { status, paidAt: status === InvoiceStatus.PAID ? new Date() : null }
  });
  res.json(invoice);
});

app.get("/api/invoices/:id/qr", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice?.upiLink) return res.status(404).json({ error: "UPI link unavailable" });
  const dataUrl = await QRCode.toDataURL(invoice.upiLink, { width: 280, margin: 1 });
  res.json({ dataUrl, upiLink: invoice.upiLink });
});

type InvoiceFull = Prisma.InvoiceGetPayload<{ include: { client: true; business: true; items: true } }>;

function buildInvoicePdf(invoice: InvoiceFull): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const qrPromise = invoice.upiLink
      ? QRCode.toDataURL(invoice.upiLink, { width: 180, margin: 1 })
      : Promise.resolve(null);

    qrPromise.then(qr => {
      const doc = new PDFDocument({ size: "A4", margin: 45 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.font("Helvetica-Bold").fontSize(22).text(invoice.business.name);
      doc.font("Helvetica");
      doc.fontSize(10).text(invoice.business.address || "");
      doc.text(`GSTIN: ${invoice.business.gstin || "—"}   PAN: ${invoice.business.pan || "—"}`);
      doc.moveDown();
      doc.fontSize(20).text("TAX INVOICE", { align: "right" });
      doc.fontSize(10).text(`Invoice: ${invoice.invoiceNumber}`, { align: "right" });
      doc.text(`Issue: ${invoice.issueDate.toLocaleDateString("en-IN")}`, { align: "right" });
      doc.text(`Due: ${invoice.dueDate.toLocaleDateString("en-IN")}`, { align: "right" });

      doc.moveDown();
      doc.fontSize(12).text("Bill To", { underline: true });
      doc.fontSize(10).text(invoice.client.name);
      doc.text(invoice.client.address || "");
      doc.text(`GSTIN: ${invoice.client.gstin || "—"}`);

      doc.moveDown();
      const y = doc.y;
      doc.fontSize(10).text("Description", 45, y);
      doc.text("Qty", 315, y);
      doc.text("Rate", 365, y);
      doc.text("GST", 430, y);
      doc.text("Amount", 485, y);
      doc.moveTo(45, y + 16).lineTo(550, y + 16).stroke();

      let rowY = y + 26;
      invoice.items.forEach(item => {
        doc.text(item.description, 45, rowY, { width: 255 });
        doc.text(String(item.quantity), 315, rowY);
        doc.text(`₹${item.rate.toFixed(2)}`, 365, rowY);
        doc.text(`${item.gstRate}%`, 430, rowY);
        doc.text(`₹${item.amount.toFixed(2)}`, 485, rowY);
        rowY += 22;
      });

      rowY += 10;
      doc.moveTo(350, rowY).lineTo(550, rowY).stroke();
      rowY += 15;
      doc.text(`Subtotal: ₹${invoice.subtotal.toFixed(2)}`, 370, rowY);
      rowY += 18;
      doc.text(`Discount: ₹${invoice.discount.toFixed(2)}`, 370, rowY);
      rowY += 18;
      if (invoice.cgst) doc.text(`CGST: ₹${invoice.cgst.toFixed(2)}`, 370, rowY), rowY += 18;
      if (invoice.sgst) doc.text(`SGST: ₹${invoice.sgst.toFixed(2)}`, 370, rowY), rowY += 18;
      if (invoice.igst) doc.text(`IGST: ₹${invoice.igst.toFixed(2)}`, 370, rowY), rowY += 18;
      doc.fontSize(13).text(`TOTAL: ₹${invoice.total.toFixed(2)}`, 370, rowY);
      rowY += 35;

      if (qr) {
        doc.fontSize(10).text("Scan to pay via UPI", 45, rowY);
        doc.image(Buffer.from(qr.split(",")[1], "base64"), 45, rowY + 18, { width: 120 });
        doc.fontSize(9).text(invoice.business.upiId || "", 180, rowY + 45);
      }
      if (invoice.notes) doc.fontSize(9).text(`Notes: ${invoice.notes}`, 45, 735, { width: 500 });
      doc.end();
    }).catch(reject);
  });
}

app.get("/api/invoices/:id/pdf", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, business: true, items: true }
  });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  const pdf = await buildInvoicePdf(invoice);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.end(pdf);
});

function smtpTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function invoiceEmailHtml(invoice: InvoiceFull, kind: "invoice" | "reminder") {
  const rows = invoice.items.map(i =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i.description}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${i.quantity}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">₹${i.rate.toFixed(2)}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${i.gstRate}%</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">₹${i.amount.toFixed(2)}</td></tr>`
  ).join("");
  const taxes = [
    invoice.cgst ? `<div>CGST: ₹${invoice.cgst.toFixed(2)}</div>` : "",
    invoice.sgst ? `<div>SGST: ₹${invoice.sgst.toFixed(2)}</div>` : "",
    invoice.igst ? `<div>IGST: ₹${invoice.igst.toFixed(2)}</div>` : ""
  ].join("");
  const heading = kind === "invoice"
    ? `Invoice ${invoice.invoiceNumber}`
    : `Payment reminder — ${invoice.invoiceNumber}`;
  const intro = kind === "invoice"
    ? `Please find attached invoice <b>${invoice.invoiceNumber}</b> from <b>${invoice.business.name}</b>.`
    : `This is a friendly reminder for invoice <b>${invoice.invoiceNumber}</b> of <b>₹${invoice.total.toFixed(2)}</b>, due on <b>${invoice.dueDate.toLocaleDateString("en-IN")}</b>.`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1e293b">
    <h2 style="margin-bottom:4px">${heading}</h2>
    <p>Hi ${invoice.client.name},</p>
    <p>${intro}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #e2e8f0">
      <thead><tr style="background:#f8fafc">
        <th style="padding:6px 8px;text-align:left">Description</th>
        <th style="padding:6px 8px;text-align:right">Qty</th>
        <th style="padding:6px 8px;text-align:right">Rate</th>
        <th style="padding:6px 8px;text-align:right">GST</th>
        <th style="padding:6px 8px;text-align:right">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;margin-top:12px;font-size:14px">
      <div>Subtotal: ₹${invoice.subtotal.toFixed(2)}</div>
      ${invoice.discount ? `<div>Discount: − ₹${invoice.discount.toFixed(2)}</div>` : ""}
      ${taxes}
      <div style="font-size:18px;font-weight:bold;margin-top:6px">Total: ₹${invoice.total.toFixed(2)}</div>
    </div>
    ${invoice.upiLink ? `<p style="margin-top:14px">Pay instantly via UPI: <a href="${invoice.upiLink}">${invoice.business.upiId || "UPI link"}</a></p>` : ""}
    <p style="color:#64748b;font-size:12px;margin-top:18px">Sent by ${invoice.business.name}${invoice.business.email ? ` · ${invoice.business.email}` : ""}${invoice.business.phone ? ` · ${invoice.business.phone}` : ""}</p>
  </div>`;
}

async function emailInvoice(invoice: InvoiceFull, kind: "invoice" | "reminder") {
  if (!invoice.client.email) {
    return { status: 400 as const, body: { error: "Client email is missing. Add it from the Clients tab (edit client)." } };
  }
  const transport = smtpTransport();
  if (!transport) {
    return { status: 200 as const, body: { sent: false, message: "SMTP is not configured. Add SMTP_HOST/SMTP_USER/SMTP_PASS to backend .env to send email." } };
  }
  const pdf = await buildInvoicePdf(invoice);
  const subject = kind === "invoice"
    ? `Invoice ${invoice.invoiceNumber} from ${invoice.business.name} — ₹${invoice.total.toFixed(2)}`
    : `Payment reminder — ${invoice.invoiceNumber} (₹${invoice.total.toFixed(2)})`;
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: invoice.client.email,
      subject,
      html: invoiceEmailHtml(invoice, kind),
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf }]
    });
  } catch (err: any) {
    console.error("Email send failed:", err);
    return { status: 502 as const, body: { error: `Failed to send email: ${err?.message || "unknown error"}` } };
  }

  let status = invoice.status;
  if (kind === "invoice" && invoice.status === InvoiceStatus.DRAFT) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.SENT } });
    status = InvoiceStatus.SENT;
  }
  return { status: 200 as const, body: { sent: true, status } };
}

async function handleEmailRoute(req: any, res: any, kind: "invoice" | "reminder") {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, business: true, items: true }
  });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  const result = await emailInvoice(invoice, kind);
  res.status(result.status).json(result.body);
}

app.post("/api/invoices/:id/send", (req, res) => handleEmailRoute(req, res, "invoice"));

app.post("/api/invoices/:id/reminder", (req, res) => handleEmailRoute(req, res, "reminder"));

app.get("/api/stats", async (req, res) => {
  const businessId = String(req.query.businessId);
  const found = await prisma.invoice.findMany({ where: { businessId } });
  const now = new Date();
  const invoices = found.map(inv => withEffectiveStatus(inv, now));
  const total = invoices.reduce((s, x) => s + x.total, 0);
  const paid = invoices.filter(x => x.status === InvoiceStatus.PAID).reduce((s, x) => s + x.total, 0);
  const outstanding = invoices.filter(x => x.status !== InvoiceStatus.PAID).reduce((s, x) => s + x.total, 0);
  const overdue = invoices.filter(x => x.status === InvoiceStatus.OVERDUE).reduce((s, x) => s + x.total, 0);
  res.json({ count: invoices.length, total, paid, outstanding, overdue });
});

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  console.error(err);
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: err.issues.map(issue => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ")
    });
  }
  if (typeof err?.status === "number" && err.status < 500) {
    return res.status(err.status).json({ error: err.message || "Bad request" });
  }
  if (err?.code === "P2025") return res.status(404).json({ error: "Record not found" });
  if (err?.code === "P2002") return res.status(409).json({ error: "A record with this value already exists" });
  if (err?.code === "P2003" || err?.code === "P2014") {
    return res.status(400).json({ error: "Related record not found or still in use" });
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
