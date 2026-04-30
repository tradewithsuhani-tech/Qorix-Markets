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
