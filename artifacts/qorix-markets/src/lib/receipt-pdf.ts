// Receipt PDF generator — produces clean, bank-style A4 PDF receipts for
// INR deposits and withdrawals. Renders directly with jsPDF (no DOM capture)
// so the output is crisp at any zoom and works even if the source modal
// isn't currently mounted.
import jsPDF from "jspdf";

type ReceiptKind = "deposit" | "withdrawal";

type StatusKey = "pending" | "approved" | "rejected";

export interface ReceiptInput {
  kind: ReceiptKind;
  reference: string;          // e.g. "QM-000022" / "WT-000017"
  status: StatusKey;
  statusLabel: string;        // "Pending" | "Approved" | "Paid" | "Rejected"
  headlineLabel: string;      // "DEPOSIT SUBMITTED" / "WITHDRAWAL PAID"
  amountInr: number;
  amountUsdt?: number | null; // shown for deposits / withdrawals
  rateUsed?: number | null;
  method: string;             // "Small Shark" / "Bank Account · NEFT/IMPS"
  beneficiary?: string | null;
  ifsc?: string | null;
  utrOrRef?: string | null;   // bank UTR (deposit) / payout reference (withdraw approved)
  utrLabel?: string;          // "UTR / Ref" | "Payout Ref"
  createdAt: string;          // ISO
  reviewedAt?: string | null; // ISO
  adminNote?: string | null;
  user?: { fullName?: string | null; email?: string | null; id?: number | null };
}

const BRAND = {
  emerald: [16, 185, 129] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  ink: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  hairline: [226, 232, 240] as [number, number, number],
  paper: [255, 255, 255] as [number, number, number],
  band: [248, 250, 252] as [number, number, number],
};

function statusColor(status: StatusKey): [number, number, number] {
  if (status === "approved") return BRAND.emerald;
  if (status === "rejected") return BRAND.rose;
  return BRAND.amber;
}

function fmtINR(n: number): string {
  return `INR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Generate and download a bank-style receipt PDF for an INR deposit or
 * withdrawal. Returns the suggested filename so callers can show toasts.
 */
export function downloadReceiptPdf(r: ReceiptInput): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48; // margin
  const accent = statusColor(r.status);

  // Top accent band
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 8, "F");

  // Header — brand + receipt label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BRAND.emerald);
  doc.text("Qorix", M, 56);
  doc.setTextColor(...BRAND.ink);
  doc.text(" Markets", M + doc.getTextWidth("Qorix"), 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text("Automated Trading & Wallet Platform", M, 72);
  doc.text("qorixmarkets.com  -  support@qorixmarkets.com", M, 86);

  // Right-aligned receipt meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  const kindTitle = r.kind === "deposit" ? "DEPOSIT RECEIPT" : "WITHDRAWAL RECEIPT";
  doc.text(kindTitle, pageW - M, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Reference: ${r.reference}`, pageW - M, 72, { align: "right" });
  doc.text(`Issued: ${fmtDate(new Date().toISOString())}`, pageW - M, 86, { align: "right" });

  // Hairline separator
  doc.setDrawColor(...BRAND.hairline);
  doc.setLineWidth(0.6);
  doc.line(M, 104, pageW - M, 104);

  // Status hero band
  let y = 132;
  doc.setFillColor(...BRAND.band);
  doc.roundedRect(M, y, pageW - 2 * M, 100, 8, 8, "F");

  // Status pill (top-right of band)
  const pillW = 110;
  const pillH = 22;
  const pillX = pageW - M - 16 - pillW;
  const pillY = y + 16;
  doc.setFillColor(...accent);
  doc.roundedRect(pillX, pillY, pillW, pillH, 11, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(r.statusLabel.toUpperCase(), pillX + pillW / 2, pillY + 14.5, { align: "center" });

  // Headline label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...accent);
  doc.text(r.headlineLabel, M + 20, y + 32);

  // Big amount
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...BRAND.ink);
  doc.text(fmtINR(r.amountInr), M + 20, y + 68);

  // USDT subline
  if (r.amountUsdt != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    const rateStr = r.rateUsed && r.rateUsed > 0 ? ` @ INR ${r.rateUsed.toFixed(2)}` : "";
    doc.text(`Equivalent: ${r.amountUsdt.toFixed(2)} USDT${rateStr}`, M + 20, y + 86);
  }

  y += 132;

  // Transaction details section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  doc.text("TRANSACTION DETAILS", M, y);
  y += 8;
  doc.setDrawColor(...BRAND.hairline);
  doc.line(M, y, pageW - M, y);
  y += 18;

  type Row = [label: string, value: string];
  const rows: Row[] = [
    ["Method", r.method],
    [r.kind === "deposit" ? "Amount Credited" : "Amount Debited",
      `${r.kind === "deposit" ? "+" : "-"} ${fmtINR(r.amountInr)}`],
  ];
  if (r.amountUsdt != null) {
    rows.push([r.kind === "deposit" ? "USDT Credited (on approval)" : "USDT Held",
      `${r.amountUsdt.toFixed(2)} USDT`]);
  }
  if (r.beneficiary) rows.push(["Beneficiary", r.beneficiary]);
  if (r.ifsc) rows.push(["IFSC", r.ifsc]);
  if (r.utrOrRef) rows.push([r.utrLabel ?? "UTR / Ref", r.utrOrRef]);
  rows.push(["Submitted", fmtDate(r.createdAt)]);
  if (r.reviewedAt) {
    const lbl = r.status === "approved" && r.kind === "withdrawal" ? "Paid On" : "Reviewed";
    rows.push([lbl, fmtDate(r.reviewedAt)]);
  }
  rows.push(["Status", r.statusLabel]);
  rows.push(["Reference", r.reference]);
  if (r.adminNote) rows.push(["Note", r.adminNote]);

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.ink);
    const wrapped = doc.splitTextToSize(value, pageW - 2 * M - 180);
    doc.text(wrapped, pageW - M, y, { align: "right" });
    const rowH = Math.max(18, wrapped.length * 13);
    y += rowH;
    doc.setDrawColor(...BRAND.hairline);
    doc.setLineWidth(0.4);
    doc.line(M, y - 6, pageW - M, y - 6);
  }

  // Account holder block (if available)
  if (r.user?.fullName || r.user?.email) {
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink);
    doc.text("ACCOUNT HOLDER", M, y);
    y += 8;
    doc.setDrawColor(...BRAND.hairline);
    doc.line(M, y, pageW - M, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink);
    if (r.user.fullName) { doc.text(r.user.fullName, M, y); y += 14; }
    if (r.user.email) {
      doc.setTextColor(...BRAND.muted);
      doc.text(r.user.email, M, y);
      y += 14;
    }
    if (r.user.id) {
      doc.setTextColor(...BRAND.muted);
      doc.text(`Customer ID: ${r.user.id}`, M, y);
      y += 14;
    }
  }

  // Footer
  const footerY = pageH - 64;
  doc.setDrawColor(...BRAND.hairline);
  doc.line(M, footerY, pageW - M, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    "This is a computer-generated receipt and does not require a signature.",
    pageW / 2,
    footerY + 18,
    { align: "center" },
  );
  doc.text(
    "For questions, contact support@qorixmarkets.com or visit qorixmarkets.com/contact",
    pageW / 2,
    footerY + 32,
    { align: "center" },
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.emerald);
  doc.text("Qorix Markets - Secured by design", pageW / 2, footerY + 46, { align: "center" });

  const safeRef = r.reference.replace(/[^A-Za-z0-9_-]/g, "");
  const filename = `qorix-${r.kind}-${safeRef}.pdf`;
  doc.save(filename);
  return filename;
}
