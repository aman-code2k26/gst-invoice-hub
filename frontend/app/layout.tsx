import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "InvoiceHub — GST Invoicing",
  description: "Micro-SaaS GST invoice and payment link hub for freelancers"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
