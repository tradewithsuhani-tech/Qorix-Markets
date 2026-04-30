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

// ---------------------------------------------------------------------------
// PREMIUM INSTITUTIONAL email wrapper — "private banking" aesthetic.
//
// Design philosophy (B18, redesigned 2026-04-30):
//   • Restrained dark slate palette (#070A12 / #0D1424) — no rainbow
//     gradients, no neon eye-punches.
//   • Single cyan accent (#22D3EE / #67E8F9) used sparingly for the
//     official-comm badge, the title's left rail and link underlines.
//   • Hero is a quiet "letter from the desk" — small uppercase eyebrow,
//     bold serif-weight title, thin divider — NOT a marketing splash.
//   • REMOVED from the previous design, because they made every email
//     feel like a promo blast and were inappropriate for serious
//     communications like KYC, security alerts and maintenance:
//       - the always-on "Activate Trading Now" gradient CTA
//       - the always-on $8.4M / +2.3% / 12,400+ stat strip (fake stats)
//       - the always-on 4-card feature grid (Fully Automated / Risk-
//         Managed / No Missed Entries / Withdraw Anytime)
//     Promotional templates that genuinely need a CTA already include
//     it inline in their `defaultMessage` body, so they still work.
//   • Compliance strip kept (SSL · Compliance · 24/7 Support) but
//     re-styled as quiet pills, not a rainbow banner.
//   • Signature block ("Best regards, The Qorix Markets Team") auto-
//     appended after the body so every email reads like real corporate
//     correspondence, not an automated blast.
//   • Mobile-responsive via @media query, MSO-safe table layout, inline
//     CSS, web-safe fonts. Same `buildBrandedEmailHtml(title, message)`
//     signature so existing call sites (admin broadcasts, direct
//     /admin/users/:id/send-email, OTPs, alerts) continue to work
//     unchanged.
// ---------------------------------------------------------------------------
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
<!--[if mso]><style type="text/css">body,table,td,a{font-family:Georgia,'Times New Roman',serif !important;}.qx-body,.qx-foot-pad,.qx-comp{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:14px 8px !important; }
    .qx-card { border-radius:16px !important; }
    .qx-head-pad { padding:18px 22px !important; }
    .qx-head-logo { width:96px !important; }
    .qx-head-tag { font-size:9px !important; letter-spacing:1.5px !important; }
    .qx-hero-pad { padding:30px 22px 4px !important; }
    .qx-hero-rail { padding-left:14px !important; }
    .qx-hero-eye { font-size:9.5px !important; letter-spacing:1.8px !important; margin-bottom:10px !important; }
    .qx-hero-title { font-size:20px !important; line-height:1.3 !important; }
    .qx-divider-pad { padding:18px 22px 0 !important; }
    .qx-body { padding:18px 24px 4px !important; font-size:14.5px !important; line-height:1.78 !important; }
    .qx-sig-pad { padding:8px 24px 26px !important; }
    .qx-sig-name { font-size:13.5px !important; }
    .qx-comp-pad { padding:0 22px 22px !important; }
    .qx-comp-cell { padding:12px 6px !important; }
    .qx-comp-pill { font-size:9.5px !important; letter-spacing:1.2px !important; margin:2px 4px !important; display:inline-block !important; }
    .qx-foot-pad { padding:22px 22px 26px !important; }
    .qx-foot-tag { font-size:11.5px !important; letter-spacing:3.5px !important; }
    .qx-foot-link { margin:0 7px !important; font-size:11.5px !important; }
    .qx-foot-legal { font-size:10px !important; line-height:1.7 !important; }
    .qx-help { font-size:10px !important; padding:14px 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#070A12;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#070A12;opacity:0;">${preheader}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#070A12;padding:32px 16px;">
  <tr>
    <td align="center">

      <!-- MAIN CARD -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:620px;background:#0D1424;border:1px solid rgba(148,163,184,0.10);border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.55);">

        <!-- HEADER BAR — restrained logo + secure-comm chip -->
        <tr>
          <td class="qx-head-pad" style="padding:22px 30px;background:#0A0F1C;border-bottom:1px solid rgba(255,255,255,0.05);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" valign="middle">
                  <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" class="qx-head-logo" width="120" height="auto" style="display:block;width:120px;max-width:140px;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
                </td>
                <td align="right" valign="middle">
                  <span class="qx-head-tag" style="display:inline-block;font-size:10px;letter-spacing:2px;color:#94A3B8;font-weight:700;text-transform:uppercase;white-space:nowrap;">
                    🔒 Secure Communication
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HERO — left accent rail + small eyebrow + bold title -->
        <tr>
          <td class="qx-hero-pad" style="padding:42px 36px 8px;background:#0D1424;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" width="3" style="background:linear-gradient(180deg,#22D3EE 0%,#0EA5E9 100%);width:3px;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</td>
                <td valign="top" class="qx-hero-rail" style="padding-left:20px;">
                  <div class="qx-hero-eye" style="font-size:10.5px;letter-spacing:2.4px;color:#67E8F9;font-weight:700;text-transform:uppercase;margin-bottom:14px;">
                    Qorix Markets · Official Communication
                  </div>
                  <div class="qx-hero-title" style="font-size:24px;line-height:1.3;font-weight:700;color:#F8FAFC;letter-spacing:-0.3px;margin:0;">
                    ${safeTitle}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- THIN DIVIDER -->
        <tr>
          <td class="qx-divider-pad" style="padding:26px 36px 0;">
            <div style="height:1px;background:linear-gradient(90deg,transparent 0%,rgba(148,163,184,0.20) 50%,transparent 100%);font-size:1px;line-height:1px;">&nbsp;</div>
          </td>
        </tr>

        <!-- BODY — letter-grade typography, generous line-height -->
        <tr>
          <td class="qx-body" style="padding:26px 36px 4px;color:#CBD5E1;font-size:15.5px;line-height:1.8;word-wrap:break-word;">
            <div style="color:#E2E8F0;">${bodyHtml}</div>
          </td>
        </tr>

        <!-- SIGNATURE BLOCK — closes the letter -->
        <tr>
          <td class="qx-sig-pad" style="padding:14px 36px 32px;">
            <div style="margin-top:18px;">
              <div style="font-size:14.5px;color:#CBD5E1;font-weight:400;line-height:1.6;">Best regards,</div>
              <div class="qx-sig-name" style="font-size:14.5px;color:#FFFFFF;font-weight:700;margin-top:4px;letter-spacing:0.1px;">The Qorix Markets Team</div>
              <div style="font-size:11px;color:#64748B;margin-top:6px;letter-spacing:0.3px;">AI-Powered Trading · Built for Performance</div>
            </div>
          </td>
        </tr>

        <!-- COMPLIANCE STRIP — quiet pills, institutional reassurance -->
        <tr>
          <td class="qx-comp-pad" style="padding:0 36px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0F1C;border:1px solid rgba(255,255,255,0.05);border-radius:12px;">
              <tr>
                <td align="center" class="qx-comp-cell qx-comp" style="padding:14px 8px;line-height:1.85;">
                  <span class="qx-comp-pill" style="display:inline-block;color:#67E8F9;font-size:10.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;margin:0 12px;white-space:nowrap;">🔒 256-bit Encrypted</span>
                  <span style="color:#334155;">·</span>
                  <span class="qx-comp-pill" style="display:inline-block;color:#A78BFA;font-size:10.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;margin:0 12px;white-space:nowrap;">⚖ Compliance Grade</span>
                  <span style="color:#334155;">·</span>
                  <span class="qx-comp-pill" style="display:inline-block;color:#F472B6;font-size:10.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;margin:0 12px;white-space:nowrap;">📞 24/7 Support</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER — wordmark + links + legal -->
        <tr>
          <td class="qx-foot-pad" style="padding:30px 36px 34px;background:#070A12;border-top:1px solid rgba(255,255,255,0.05);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:16px;">
                  <div class="qx-foot-tag" style="font-size:13px;letter-spacing:5px;color:#CBD5E1;font-weight:700;">QORIX&nbsp;·&nbsp;MARKETS</div>
                  <div style="font-size:10.5px;color:#475569;margin-top:6px;letter-spacing:0.5px;">AI-Powered Trading System</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:6px 0;line-height:1.9;">
                  <a href="https://qorixmarkets.com" class="qx-foot-link" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 12px;white-space:nowrap;">Website</a>
                  <span style="color:#334155;">·</span>
                  <a href="mailto:support@qorixmarkets.com" class="qx-foot-link" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 12px;white-space:nowrap;">Support</a>
                  <span style="color:#334155;">·</span>
                  <a href="https://qorixmarkets.com/promotions" class="qx-foot-link" style="color:#7DD3FC;text-decoration:none;font-size:12px;font-weight:600;margin:0 12px;white-space:nowrap;">Promotions</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:18px;">
                  <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:18px;">
                    <div class="qx-foot-legal" style="font-size:10.5px;color:#475569;line-height:1.75;">
                      © ${year} Qorix Markets. All rights reserved.<br/>
                      This is an account-related communication sent to you because you have an active account at Qorix Markets.<br/>
                      Trading involves risk. Past performance does not guarantee future results.
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- HELP LINE OUTSIDE CARD — gives breathing room -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;">
        <tr>
          <td align="center" class="qx-help" style="padding:18px 24px 8px;font-size:11px;color:#64748B;letter-spacing:0.3px;">
            Need help? Reply to this email or write to
            <a href="mailto:support@qorixmarkets.com" style="color:#7DD3FC;text-decoration:none;border-bottom:1px solid rgba(125,211,252,0.35);">support@qorixmarkets.com</a>
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
