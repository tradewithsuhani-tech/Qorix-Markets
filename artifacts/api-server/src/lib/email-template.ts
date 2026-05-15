// ─────────────────────────────────────────────────────────────────────────
// Merchant operational alert email (bank-grade)
// ─────────────────────────────────────────────────────────────────────────
//
// Used for "New INR deposit/withdrawal pending" merchant notifications.
// Designed to look like a premium bank transactional alert because
// merchants frequently screenshot & share these (community marketing
// channel). Inline CSS, table layout, mobile responsive.

export type MerchantAlertKind = "deposit" | "withdrawal";

export interface MerchantAlertInput {
  kind: MerchantAlertKind;
  reference: string;             // QM-000022 / WT-000017
  amountInr: number;             // e.g. 96500
  amountUsdt?: number | null;
  rateUsed?: number | null;
  method?: string | null;        // method display (deposit) or "UPI" / "Bank · NEFT/IMPS"
  beneficiary?: string | null;   // for withdrawals
  ifsc?: string | null;
  utr?: string | null;           // for deposits
  createdAt: Date;
  ctaUrl: string;                // merchant panel deep link
  slaMinutes?: number;           // 10 by default — used in compliance pill
  noteToMerchant?: string;       // 1-line context line under the headline
}

function _fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _fmtTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function buildMerchantAlertHtml(opts: MerchantAlertInput): { subject: string; text: string; html: string } {
  const isDeposit = opts.kind === "deposit";
  const sla = opts.slaMinutes ?? 10;
  const action = isDeposit ? "DEPOSIT" : "WITHDRAWAL";
  const verb = isDeposit ? "submitted" : "requested";
  const subject = `[Action Required] New INR ${opts.kind} pending — ₹${_fmtINR(opts.amountInr)} · ${opts.reference}`;

  const headline = isDeposit
    ? `A user just ${verb} an INR deposit of ₹${_fmtINR(opts.amountInr)}.`
    : `A user just ${verb} an INR withdrawal of ₹${_fmtINR(opts.amountInr)}.`;
  const subline = isDeposit
    ? `Verify the UTR on your bank statement and approve to credit USDT to the user's wallet.`
    : `First merchant to claim from the panel becomes the owner. Process the payout within ${sla} minutes to avoid escalation.`;
  const note = opts.noteToMerchant ? escapeHtml(opts.noteToMerchant) : escapeHtml(subline);

  // Build details rows (tableized for max email-client compat).
  const rows: Array<[string, string]> = [];
  rows.push(["Reference ID", opts.reference]);
  rows.push([isDeposit ? "Amount to Credit" : "Amount to Pay Out", `₹${_fmtINR(opts.amountInr)}`]);
  if (opts.amountUsdt != null) {
    const rateStr = opts.rateUsed && opts.rateUsed > 0 ? ` @ ₹${opts.rateUsed.toFixed(2)}/USDT` : "";
    rows.push(["USDT Equivalent", `${opts.amountUsdt.toFixed(2)} USDT${rateStr}`]);
  }
  if (opts.method) rows.push(["Method", opts.method]);
  if (opts.utr) rows.push(["UTR / Bank Ref", opts.utr]);
  if (opts.beneficiary) rows.push(["Beneficiary", opts.beneficiary]);
  if (opts.ifsc) rows.push(["IFSC Code", opts.ifsc]);
  rows.push(["Submitted At", _fmtTime(opts.createdAt)]);
  rows.push(["SLA", `Process within ${sla} minutes`]);

  const detailsRowsHtml = rows.map(([label, value], i) => {
    const border = i === 0 ? "" : "border-top:1px solid rgba(255,255,255,0.06);";
    return `
      <tr>
        <td style="${border}padding:14px 20px;color:#94A3B8;font-size:12.5px;letter-spacing:0.3px;font-weight:500;width:42%;">${escapeHtml(label)}</td>
        <td align="right" style="${border}padding:14px 20px;color:#FFFFFF;font-size:13px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'SF Mono',Menlo,Consolas,monospace;word-break:break-word;">${escapeHtml(value)}</td>
      </tr>`;
  }).join("");

  // Plain-text fallback (also used as the SES Text body).
  const text = [
    `${action} PENDING — ₹${_fmtINR(opts.amountInr)} · ${opts.reference}`,
    "",
    headline,
    subline,
    "",
    "Transaction details:",
    ...rows.map(([k, v]) => `  • ${k}: ${v}`),
    "",
    `Review & ${isDeposit ? "approve" : "claim"} now: ${opts.ctaUrl}`,
    "",
    "— Qorix Markets · Operations Desk",
  ].join("\n");

  const preheader = `₹${_fmtINR(opts.amountInr)} ${opts.kind} awaiting your review · Ref ${opts.reference} · SLA ${sla} min`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>${escapeHtml(subject)}</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .ma-outer { padding:16px 8px !important; }
    .ma-card { border-radius:18px !important; }
    .ma-hero-pad { padding:26px 18px 22px !important; }
    .ma-amount { font-size:32px !important; }
    .ma-headline { font-size:14px !important; }
    .ma-detail-pad { padding:0 !important; }
    .ma-cta-btn { padding:15px 28px !important; font-size:14px !important; }
    .ma-foot-pad { padding:18px !important; }
    .ma-section-pad { padding:0 18px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#05070D;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#05070D;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ma-outer" style="background:#05070D;padding:32px 16px;">
  <tr><td align="center">

    <!-- MAIN CARD -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ma-card" style="max-width:600px;background:#0A0F1C;border:1px solid rgba(16,185,129,0.18);border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6);">

      <!-- TOP ACCENT BAR -->
      <tr><td height="6" style="height:6px;line-height:6px;font-size:1px;background:linear-gradient(90deg,#10B981 0%,#14B8A6 50%,#06B6D4 100%);">&nbsp;</td></tr>

      <!-- LOGO BAR -->
      <tr>
        <td align="left" style="padding:18px 24px 8px 28px;background:#0A0F1C;">
          <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="220" height="150" style="display:block;width:220px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
        </td>
      </tr>

      <!-- HERO -->
      <tr>
        <td class="ma-hero-pad" style="padding:8px 32px 28px;background:#0A0F1C;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);font-size:10.5px;letter-spacing:1.6px;color:#FCD34D;font-weight:800;text-transform:uppercase;">
                  ⚠ Action Required · ${escapeHtml(action)}
                </div>
              </td>
              <td align="right" style="vertical-align:top;">
                <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.35);font-size:10.5px;letter-spacing:1.4px;color:#6EE7B7;font-weight:800;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'SF Mono',Menlo,Consolas,monospace;">
                  ${escapeHtml(opts.reference)}
                </div>
              </td>
            </tr>
          </table>
          <div class="ma-amount" style="margin-top:22px;font-size:44px;line-height:1.05;font-weight:800;color:#FFFFFF;letter-spacing:-1px;">
            ₹${_fmtINR(opts.amountInr)}
          </div>
          <div style="margin-top:6px;font-size:11.5px;letter-spacing:1.5px;color:#10B981;text-transform:uppercase;font-weight:700;">
            ${isDeposit ? "INR Deposit · Pending Verification" : "INR Withdrawal · Pending Payout"}
          </div>
          <div class="ma-headline" style="margin-top:18px;font-size:15px;line-height:1.6;color:#E2E8F0;font-weight:500;">
            ${escapeHtml(headline)}
          </div>
          <div style="margin-top:8px;font-size:13px;line-height:1.65;color:#94A3B8;">
            ${note}
          </div>
        </td>
      </tr>

      <!-- DETAILS CARD -->
      <tr>
        <td class="ma-section-pad" style="padding:0 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:16px;">
            <tr>
              <td style="padding:14px 20px 8px;">
                <div style="font-size:10.5px;letter-spacing:2px;color:#64748B;font-weight:800;text-transform:uppercase;">Transaction Details</div>
              </td>
            </tr>
            ${detailsRowsHtml}
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td align="center" style="padding:28px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#10B981 0%,#14B8A6 50%,#06B6D4 100%);box-shadow:0 14px 40px rgba(16,185,129,0.4);">
                <a href="${opts.ctaUrl}" target="_blank" class="ma-cta-btn" style="display:inline-block;padding:16px 38px;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:14.5px;letter-spacing:0.4px;border-radius:14px;">
                  ${isDeposit ? "Review &amp; Approve" : "Claim &amp; Process Payout"}&nbsp;&nbsp;→
                </a>
              </td>
            </tr>
          </table>
          <div style="margin-top:12px;font-size:11px;color:#64748B;letter-spacing:0.4px;">
            Or sign in: <a href="${opts.ctaUrl}" style="color:#7DD3FC;text-decoration:none;border-bottom:1px solid rgba(125,211,252,0.4);">qorixmarkets.com/merchant</a>
          </div>
        </td>
      </tr>

      <!-- SLA WARNING -->
      <tr>
        <td class="ma-section-pad" style="padding:24px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(90deg,rgba(245,158,11,0.08) 0%,rgba(244,63,94,0.06) 100%);border:1px solid rgba(245,158,11,0.25);border-radius:14px;">
            <tr>
              <td style="padding:14px 18px;">
                <div style="font-size:11px;letter-spacing:1.6px;color:#FCD34D;font-weight:800;text-transform:uppercase;margin-bottom:4px;">⏱ Service Level Agreement</div>
                <div style="font-size:12.5px;color:#CBD5E1;line-height:1.6;">
                  Auto-escalation triggers in <strong style="color:#FFFFFF;">${sla} minutes</strong>. Unclaimed requests will be routed to admin and may impact your merchant score.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- TRUST PILLS -->
      <tr>
        <td class="ma-section-pad" style="padding:18px 28px 24px;">
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:12px 10px;text-align:center;line-height:1.9;">
            <span style="display:inline-block;color:#6EE7B7;font-size:10.5px;letter-spacing:1.8px;font-weight:700;text-transform:uppercase;margin:0 8px;white-space:nowrap;">SSL · 256-bit</span>
            <span style="display:inline-block;color:#67E8F9;font-size:10.5px;letter-spacing:1.8px;font-weight:700;text-transform:uppercase;margin:0 8px;white-space:nowrap;">Audited Ledger</span>
            <span style="display:inline-block;color:#FCD34D;font-size:10.5px;letter-spacing:1.8px;font-weight:700;text-transform:uppercase;margin:0 8px;white-space:nowrap;">Merchant · Tier 1</span>
          </div>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td class="ma-foot-pad" style="padding:22px 28px 28px;background:#06090F;border-top:1px solid rgba(255,255,255,0.05);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:10px;">
                <div style="font-size:13px;letter-spacing:5px;color:#94A3B8;font-weight:800;">QORIX&nbsp;MARKETS</div>
                <div style="font-size:10.5px;color:#475569;margin-top:3px;letter-spacing:0.5px;">Operations Desk · Merchant Network</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:6px 0;line-height:1.9;">
                <a href="https://qorixmarkets.com/merchant" style="color:#7DD3FC;text-decoration:none;font-size:11.5px;font-weight:600;margin:0 8px;white-space:nowrap;">Merchant Panel</a>
                <span style="color:#334155;">·</span>
                <a href="mailto:support@qorixmarkets.com" style="color:#7DD3FC;text-decoration:none;font-size:11.5px;font-weight:600;margin:0 8px;white-space:nowrap;">Support</a>
                <span style="color:#334155;">·</span>
                <a href="https://qorixmarkets.com/merchant/sla" style="color:#7DD3FC;text-decoration:none;font-size:11.5px;font-weight:600;margin:0 8px;white-space:nowrap;">SLA Policy</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.04);">
                <div style="font-size:10.5px;color:#475569;line-height:1.7;padding-top:12px;">
                  © ${new Date().getFullYear()} Qorix Markets · Operations · This alert is sent only to active merchants on your tier.<br/>
                  Do not share this email with end users. Process via the merchant panel only.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>

    <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Content-ID for the brand logo CID inline attachment. Email-service
// attaches the PNG with this exact cid on every HTML send, so any
// <img src="cid:${BRAND_LOGO_CID}"> in a template resolves without
// needing an external URL. Keep this value stable — changing it would
// break image rendering in already-queued emails.
export const BRAND_LOGO_CID = "qorix-logo@brand";

// Convert a plain-text message (admin-typed multi-line body with URLs +
// newlines) into safe HTML suitable for dropping into a renderer's
// `bodyHtml` slot — escapes HTML, auto-linkifies http/https URLs, and
// preserves newlines as <br/>. Identical conversion to the one used
// inside buildBrandedEmailHtml so output stays consistent across every
// renderer that accepts a free-form admin body.
export function messageToBodyHtml(message: string): string {
  const escaped = escapeHtml(message);
  const linkified = escaped.replace(/(https?:\/\/[^\s<]+)/g, (full) => {
    const display = full.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `<a href="${full}" style="color:#7DD3FC;text-decoration:none;border-bottom:1px solid rgba(125,211,252,0.4);white-space:nowrap;">${display}</a>`;
  });
  return linkified.replace(/\n/g, "<br/>");
}

// ─────────────────────────────────────────────────────────────────────────
// Premium Telegram channel invite email — dark sky-blue theme, high-impact.
// Hero + 3 benefit pills + single CTA. Social media icons in footer.
// Table-based layout, inline CSS, email-client safe.
// ─────────────────────────────────────────────────────────────────────────
export function buildTelegramInviteHtml(channelUrl = "https://t.me/qorixmarkets"): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<title>Join Qorix Markets on Telegram</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
  @media only screen and (max-width:480px){
    .tg-outer{padding:18px 10px !important;}
    .tg-card{border-radius:18px !important;}
    .tg-hero{padding:36px 20px 30px !important;}
    .tg-eyebrow{font-size:10px !important;padding:6px 14px !important;}
    .tg-headline{font-size:26px !important;}
    .tg-sub{font-size:14px !important;}
    .tg-pills{padding:20px 16px !important;}
    .tg-pill-td{display:block !important;width:100% !important;padding:5px 0 !important;}
    .tg-pill{padding:14px 10px !important;}
    .tg-pill-icon{font-size:22px !important;}
    .tg-pill-title{font-size:12px !important;}
    .tg-cta-wrap{padding:24px 20px 28px !important;}
    .tg-cta-btn{padding:17px 32px !important;font-size:15px !important;}
    .tg-soc-td{padding:4px 3px !important;}
    .tg-soc-ico{width:38px !important;height:38px !important;border-radius:10px !important;font-size:14px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#05070D;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#05070D;opacity:0;">Your Qorix community is live. Join for trade alerts, offers &amp; daily insights. Free. Instant access.</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tg-outer" style="background:#05070D;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tg-card" style="max-width:600px;background:#0A0F1C;border:1px solid rgba(14,165,233,0.22);border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.65);">

      <!-- LOGO BAR -->
      <tr>
        <td style="padding:18px 24px 0 28px;background-image:linear-gradient(135deg,#020B18 0%,#051525 50%,#091F38 100%);">
          <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="280" height="190" style="display:block;width:280px;max-width:80%;height:auto;border:0;" />
        </td>
      </tr>

      <!-- HERO -->
      <tr>
        <td align="center" class="tg-hero" style="padding:40px 36px 34px;background-image:linear-gradient(160deg,#020B18 0%,#051E3A 45%,#072440 75%,#041828 100%);">
          <div class="tg-eyebrow" style="display:inline-block;padding:7px 18px;border-radius:999px;background:rgba(14,165,233,0.14);border:1px solid rgba(14,165,233,0.4);font-size:11px;letter-spacing:2px;color:#38BDF8;font-weight:700;text-transform:uppercase;margin-bottom:22px;">
            Official Channel — Now Live
          </div>
          <div class="tg-headline" style="font-size:32px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.6px;margin:0 auto;max-width:420px;">
            Your edge starts<br/>inside the channel.
          </div>
          <div class="tg-sub" style="font-size:15px;color:#7DD3FC;margin-top:16px;letter-spacing:0.2px;font-weight:500;">
            Trade alerts · Exclusive offers · Daily insights
          </div>
          <div style="width:52px;height:3px;background:linear-gradient(90deg,#0EA5E9 0%,#38BDF8 50%,#7DD3FC 100%);margin:24px auto 0;border-radius:999px;"></div>
        </td>
      </tr>

      <!-- 3 BENEFIT PILLS -->
      <tr>
        <td class="tg-pills" style="padding:28px 24px 8px;background:#070E1C;border-top:1px solid rgba(14,165,233,0.1);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="33%" valign="top" class="tg-pill-td" style="padding:6px;">
                <div class="tg-pill" style="background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.18);border-radius:16px;padding:18px 12px;text-align:center;">
                  <div class="tg-pill-icon" style="font-size:26px;margin-bottom:8px;">📊</div>
                  <div class="tg-pill-title" style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Live Trade Alerts</div>
                  <div style="font-size:11px;color:#64748B;margin-top:4px;line-height:1.4;">First to know, every time</div>
                </div>
              </td>
              <td width="34%" valign="top" class="tg-pill-td" style="padding:6px;">
                <div class="tg-pill" style="background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.18);border-radius:16px;padding:18px 12px;text-align:center;">
                  <div class="tg-pill-icon" style="font-size:26px;margin-bottom:8px;">💎</div>
                  <div class="tg-pill-title" style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Member-Only Offers</div>
                  <div style="font-size:11px;color:#64748B;margin-top:4px;line-height:1.4;">Bonuses &amp; promotions</div>
                </div>
              </td>
              <td width="33%" valign="top" class="tg-pill-td" style="padding:6px;">
                <div class="tg-pill" style="background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.18);border-radius:16px;padding:18px 12px;text-align:center;">
                  <div class="tg-pill-icon" style="font-size:26px;margin-bottom:8px;">🔔</div>
                  <div class="tg-pill-title" style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Instant Updates</div>
                  <div style="font-size:11px;color:#64748B;margin-top:4px;line-height:1.4;">Payouts &amp; announcements</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td align="center" class="tg-cta-wrap" style="padding:30px 36px 36px;background:#070E1C;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#0284C7 0%,#0EA5E9 50%,#38BDF8 100%);box-shadow:0 14px 48px rgba(14,165,233,0.5);">
                <a href="${channelUrl}" target="_blank" class="tg-cta-btn" style="display:inline-block;padding:18px 52px;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:16px;letter-spacing:0.3px;border-radius:14px;white-space:nowrap;">
                  Join @qorixmarkets&nbsp;&nbsp;→
                </a>
              </td>
            </tr>
          </table>
          <div style="margin-top:14px;font-size:11.5px;color:#475569;letter-spacing:0.5px;">
            Free &nbsp;·&nbsp; 5 seconds &nbsp;·&nbsp; Instant access
          </div>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:22px 32px 28px;background:#06090F;border-top:1px solid rgba(255,255,255,0.05);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:12px;">
                <div style="font-size:13px;letter-spacing:5px;color:#94A3B8;font-weight:700;">QORIX&nbsp;MARKETS</div>
                <div style="font-size:11px;color:#475569;margin-top:4px;">AI-Powered Trading · Built for Performance</div>
              </td>
            </tr>

            <!-- SOCIAL MEDIA ICONS -->
            <tr>
              <td align="center" style="padding:14px 0 10px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <!-- Telegram -->
                    <td class="tg-soc-td" style="padding:4px 5px;">
                      <a href="https://t.me/qorixmarkets" target="_blank" style="display:block;text-decoration:none;">
                        <div class="tg-soc-ico" style="width:42px;height:42px;border-radius:12px;background:#131B2E;border:1px solid rgba(255,255,255,0.08);text-align:center;line-height:42px;font-size:16px;color:#CBD5E1;">✈</div>
                      </a>
                    </td>
                    <!-- X / Twitter -->
                    <td class="tg-soc-td" style="padding:4px 5px;">
                      <a href="https://x.com/qorixmarkets" target="_blank" style="display:block;text-decoration:none;">
                        <div class="tg-soc-ico" style="width:42px;height:42px;border-radius:12px;background:#131B2E;border:1px solid rgba(255,255,255,0.08);text-align:center;line-height:42px;font-size:14px;font-weight:800;color:#CBD5E1;font-family:Arial,sans-serif;">𝕏</div>
                      </a>
                    </td>
                    <!-- Instagram -->
                    <td class="tg-soc-td" style="padding:4px 5px;">
                      <a href="https://instagram.com/qorixmarkets" target="_blank" style="display:block;text-decoration:none;">
                        <div class="tg-soc-ico" style="width:42px;height:42px;border-radius:12px;background:#131B2E;border:1px solid rgba(255,255,255,0.08);text-align:center;line-height:42px;font-size:16px;color:#CBD5E1;">◎</div>
                      </a>
                    </td>
                    <!-- YouTube -->
                    <td class="tg-soc-td" style="padding:4px 5px;">
                      <a href="https://youtube.com/@qorixmarkets" target="_blank" style="display:block;text-decoration:none;">
                        <div class="tg-soc-ico" style="width:42px;height:42px;border-radius:12px;background:#131B2E;border:1px solid rgba(255,255,255,0.08);text-align:center;line-height:42px;font-size:16px;color:#CBD5E1;">▶</div>
                      </a>
                    </td>
                    <!-- Facebook -->
                    <td class="tg-soc-td" style="padding:4px 5px;">
                      <a href="https://facebook.com/qorixmarkets" target="_blank" style="display:block;text-decoration:none;">
                        <div class="tg-soc-ico" style="width:42px;height:42px;border-radius:12px;background:#131B2E;border:1px solid rgba(255,255,255,0.08);text-align:center;line-height:42px;font-size:15px;font-weight:700;color:#CBD5E1;font-family:Arial,sans-serif;">f</div>
                      </a>
                    </td>
                    <!-- LinkedIn -->
                    <td class="tg-soc-td" style="padding:4px 5px;">
                      <a href="https://linkedin.com/company/qorixmarkets" target="_blank" style="display:block;text-decoration:none;">
                        <div class="tg-soc-ico" style="width:42px;height:42px;border-radius:12px;background:#131B2E;border:1px solid rgba(255,255,255,0.08);text-align:center;line-height:42px;font-size:12px;font-weight:700;color:#CBD5E1;font-family:Arial,sans-serif;">in</div>
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 0;line-height:1.9;">
                <a href="https://qorixmarkets.com" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;">Website</a>
                <span style="color:#334155;">·</span>
                <a href="mailto:support@qorixmarkets.com" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;">Support</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:14px;border-top:1px solid rgba(255,255,255,0.04);">
                <div style="font-size:11px;color:#475569;line-height:1.7;padding-top:14px;">
                  © ${year} Qorix Markets. All rights reserved.<br/>
                  <span style="color:#334155;">You're receiving this because you have an account at Qorix Markets.</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="height:24px;"></div>
  </td></tr>
</table>
</body>
</html>`;
}

// High-end branded email — institutional dark theme, gradient hero,
// trust badges, stat grid, feature pills, premium CTA, footer.
// Email-client safe: table-based layout, inline CSS, web-safe fonts,
// mobile-responsive via @media query.
export function buildBrandedEmailHtml(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const year = new Date().getFullYear();

  // Body: escape → linkify → newline preservation.
  const escaped = escapeHtml(message);
  const linkified = escaped.replace(/(https?:\/\/[^\s<]+)/g, (full) => {
    const display = full.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `<a href="${full}" style="color:#7DD3FC;text-decoration:none;border-bottom:1px solid rgba(125,211,252,0.4);white-space:nowrap;">${display}</a>`;
  });
  const bodyHtml = linkified.replace(/\n/g, "<br/>");

  const preheader = escapeHtml(message.replace(/\s+/g, " ").slice(0, 110));

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>${safeTitle} — Qorix Markets</title>
<!--[if mso]><style type="text/css">body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:18px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:32px 18px 24px !important; }
    .qx-badge { font-size:9.5px !important; letter-spacing:1.5px !important; padding:6px 12px !important; margin-bottom:18px !important; }
    .qx-hero-title { font-size:22px !important; line-height:1.25 !important; max-width:100% !important; }
    .qx-stat-cell { padding:14px 4px !important; }
    .qx-stat-val { font-size:14px !important; white-space:nowrap !important; }
    .qx-stat-lbl { font-size:8.5px !important; letter-spacing:0.8px !important; }
    .qx-body { padding:24px 20px 4px !important; font-size:14.5px !important; line-height:1.7 !important; }
    .qx-cta-pad { padding:18px 18px 4px !important; }
    .qx-cta-btn { padding:14px 28px !important; font-size:14px !important; }
    .qx-feat-pad { padding:22px 14px 4px !important; }
    .qx-feat-cell { padding:5px !important; }
    .qx-feat-card { padding:12px 14px !important; }
    .qx-feat-title { font-size:12.5px !important; }
    .qx-feat-desc { font-size:11px !important; }
    .qx-trust-pad { padding:18px 18px 24px !important; }
    .qx-trust-pill { font-size:10px !important; letter-spacing:1.2px !important; margin:3px 6px !important; display:inline-block !important; }
    .qx-foot-pad { padding:20px 18px 24px !important; }
    .qx-foot-link { margin:0 7px !important; font-size:11.5px !important; }
    .qx-foot-tag { letter-spacing:3px !important; font-size:12px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#05070D;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#05070D;opacity:0;">${preheader}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#05070D;padding:32px 16px;">
  <tr>
    <td align="center">

      <!-- MAIN CARD -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:600px;background:#0A0F1C;border:1px solid rgba(99,102,241,0.18);border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6);">

        <!-- LOGO BAR — premium 3D Q wordmark on dark gradient -->
        <tr>
          <td align="left" class="qx-logo-pad" style="padding:18px 24px 0 28px;background:#0A0F1C;background-image:linear-gradient(135deg,#0A0F1C 0%,#111B36 40%,#1E1B4B 75%,#3B1763 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="280" height="190" style="display:block;width:280px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td style="padding:0;background:#0A0F1C;background-image:linear-gradient(135deg,#0A0F1C 0%,#111B36 40%,#1E1B4B 75%,#3B1763 100%);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" class="qx-hero-pad" style="padding:0 32px 30px;">
                  <div class="qx-badge" style="display:inline-block;padding:7px 16px;border-radius:999px;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.35);font-size:11px;letter-spacing:2px;color:#67E8F9;font-weight:700;text-transform:uppercase;margin-bottom:24px;">
                    ⚡ AI-Powered Trading System
                  </div>
                  <div class="qx-hero-title" style="font-size:30px;line-height:1.2;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
                    ${safeTitle}
                  </div>
                  <div style="width:56px;height:3px;background:linear-gradient(90deg,#22D3EE 0%,#A78BFA 50%,#F472B6 100%);margin:22px auto 0;border-radius:999px;"></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- STAT STRIP -->
        <tr>
          <td style="padding:0;background:#0A0F1C;border-bottom:1px solid rgba(255,255,255,0.05);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" width="33%" class="qx-stat-cell" style="padding:18px 6px;">
                  <div class="qx-stat-val" style="font-size:17px;font-weight:800;color:#FFFFFF;white-space:nowrap;">$8.4M+</div>
                  <div class="qx-stat-lbl" style="font-size:9.5px;letter-spacing:1.2px;color:#64748B;text-transform:uppercase;margin-top:3px;font-weight:600;white-space:nowrap;">Vol. Today</div>
                </td>
                <td align="center" width="34%" class="qx-stat-cell" style="padding:18px 6px;border-left:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);">
                  <div class="qx-stat-val" style="font-size:17px;font-weight:800;color:#34D399;white-space:nowrap;">+2.3%</div>
                  <div class="qx-stat-lbl" style="font-size:9.5px;letter-spacing:1.2px;color:#64748B;text-transform:uppercase;margin-top:3px;font-weight:600;white-space:nowrap;">Last Trade</div>
                </td>
                <td align="center" width="33%" class="qx-stat-cell" style="padding:18px 6px;">
                  <div class="qx-stat-val" style="font-size:17px;font-weight:800;color:#FFFFFF;white-space:nowrap;">12,400+</div>
                  <div class="qx-stat-lbl" style="font-size:9.5px;letter-spacing:1.2px;color:#64748B;text-transform:uppercase;margin-top:3px;font-weight:600;white-space:nowrap;">Active Traders</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="qx-body" style="padding:36px 36px 8px;color:#CBD5E1;font-size:15.5px;line-height:1.75;word-wrap:break-word;">
            <div style="color:#E2E8F0;">${bodyHtml}</div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" class="qx-cta-pad" style="padding:24px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#22D3EE 0%,#6366F1 50%,#A855F7 100%);box-shadow:0 12px 40px rgba(99,102,241,0.45);">
                  <a href="https://qorixmarkets.com/" target="_blank" class="qx-cta-btn" style="display:inline-block;padding:16px 42px;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;border-radius:14px;">
                    Activate Trading Now&nbsp;&nbsp;→
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:11.5px;color:#64748B;letter-spacing:0.5px;">
              Start from as low as <span style="color:#E2E8F0;font-weight:600;">$10</span> · Withdraw anytime
            </div>
          </td>
        </tr>

        <!-- FEATURE GRID -->
        <tr>
          <td class="qx-feat-pad" style="padding:32px 28px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" valign="top" class="qx-feat-cell" style="padding:8px;">
                  <div class="qx-feat-card" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px 18px;">
                    <div style="font-size:18px;line-height:1;margin-bottom:6px;">🤖</div>
                    <div class="qx-feat-title" style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:3px;">Fully Automated</div>
                    <div class="qx-feat-desc" style="font-size:11.5px;color:#94A3B8;line-height:1.5;">AI executes trades 24/7</div>
                  </div>
                </td>
                <td width="50%" valign="top" class="qx-feat-cell" style="padding:8px;">
                  <div class="qx-feat-card" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px 18px;">
                    <div style="font-size:18px;line-height:1;margin-bottom:6px;">🛡️</div>
                    <div class="qx-feat-title" style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:3px;">Risk-Managed</div>
                    <div class="qx-feat-desc" style="font-size:11.5px;color:#94A3B8;line-height:1.5;">Built-in stop-loss logic</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td width="50%" valign="top" class="qx-feat-cell" style="padding:8px;">
                  <div class="qx-feat-card" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px 18px;">
                    <div style="font-size:18px;line-height:1;margin-bottom:6px;">⚡</div>
                    <div class="qx-feat-title" style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:3px;">No Missed Entries</div>
                    <div class="qx-feat-desc" style="font-size:11.5px;color:#94A3B8;line-height:1.5;">Zero emotion, zero delay</div>
                  </div>
                </td>
                <td width="50%" valign="top" class="qx-feat-cell" style="padding:8px;">
                  <div class="qx-feat-card" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px 18px;">
                    <div style="font-size:18px;line-height:1;margin-bottom:6px;">💎</div>
                    <div class="qx-feat-title" style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:3px;">Withdraw Anytime</div>
                    <div class="qx-feat-desc" style="font-size:11.5px;color:#94A3B8;line-height:1.5;">Funds always in your control</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TRUST STRIP -->
        <tr>
          <td class="qx-trust-pad" style="padding:24px 36px 32px;">
            <div style="background:linear-gradient(90deg,rgba(34,211,238,0.06) 0%,rgba(168,85,247,0.06) 100%);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px 12px;text-align:center;line-height:1.9;">
              <span class="qx-trust-pill" style="display:inline-block;color:#67E8F9;font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin:0 10px;white-space:nowrap;">SSL · 256-bit</span>
              <span class="qx-trust-pill" style="display:inline-block;color:#A78BFA;font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin:0 10px;white-space:nowrap;">USDT · TRC20</span>
              <span class="qx-trust-pill" style="display:inline-block;color:#F472B6;font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin:0 10px;white-space:nowrap;">24/7 · Support</span>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" style="padding:24px 32px 32px;background:#06090F;border-top:1px solid rgba(255,255,255,0.05);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:14px;">
                  <div class="qx-foot-tag" style="font-size:13px;letter-spacing:5px;color:#94A3B8;font-weight:700;">QORIX&nbsp;MARKETS</div>
                  <div style="font-size:11px;color:#475569;margin-top:4px;letter-spacing:0.5px;">AI-Powered Trading · Built for Performance</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:8px 0;line-height:1.9;">
                  <a href="https://qorixmarkets.com" class="qx-foot-link" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;white-space:nowrap;">Website</a>
                  <span style="color:#334155;">·</span>
                  <a href="mailto:support@qorixmarkets.com" class="qx-foot-link" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;white-space:nowrap;">Support</a>
                  <span style="color:#334155;">·</span>
                  <a href="https://qorixmarkets.com/promotions" class="qx-foot-link" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;white-space:nowrap;">Promotions</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:14px;border-top:1px solid rgba(255,255,255,0.04);margin-top:14px;">
                  <div style="font-size:11px;color:#475569;line-height:1.7;padding-top:14px;">
                    © ${year} Qorix Markets. All rights reserved.<br/>
                    Trading involves risk. Past performance does not guarantee future results.<br/>
                    <span style="color:#334155;">You're receiving this because you have an account at Qorix Markets.</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}
