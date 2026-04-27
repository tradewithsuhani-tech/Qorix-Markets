import { logger } from "./logger";
import { sendEmail } from "./email-service";

// ─── Voice call service ────────────────────────────────────────────────────
// Drives the 10-min/15-min escalation calls for unapproved INR deposits and
// withdrawals. Provider-agnostic: reads TWILIO_* (or EXOTEL_*) env vars at
// call time so swapping providers later is a config change, not a code
// change. Until the credentials are added on Fly, this falls back to an
// urgent-flagged email to the same recipient so the operator still gets
// notified — the cron logic that decides _when_ to call doesn't change.
//
// Provider envs (set on Fly when ready):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//     → uses Twilio Voice TwiML <Say> with the message text.
//   EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_FROM_NUMBER
//     → uses Exotel Connect-Applet endpoint (preferred for India numbers).
// If both are configured, Exotel wins (cheaper for IN→IN routes).

interface CallTarget {
  phone: string | null;
  email: string | null;
  label: string;
}

export interface CallResult {
  ok: boolean;
  provider: "twilio" | "exotel" | "email-fallback" | "skipped";
  reason?: string;
}

export async function placeEscalationCall(
  target: CallTarget,
  message: string,
): Promise<CallResult> {
  if (!target.phone) {
    return await fallbackToEmail(target, message, "no_phone_on_file");
  }
  const exotelSid = process.env["EXOTEL_SID"];
  const exotelKey = process.env["EXOTEL_API_KEY"];
  const exotelToken = process.env["EXOTEL_API_TOKEN"];
  const exotelFrom = process.env["EXOTEL_FROM_NUMBER"];
  if (exotelSid && exotelKey && exotelToken && exotelFrom) {
    return await callViaExotel({
      sid: exotelSid,
      key: exotelKey,
      token: exotelToken,
      from: exotelFrom,
      to: target.phone,
      message,
    });
  }
  const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
  const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
  const twilioFrom = process.env["TWILIO_FROM_NUMBER"];
  if (twilioSid && twilioToken && twilioFrom) {
    return await callViaTwilio({
      sid: twilioSid,
      token: twilioToken,
      from: twilioFrom,
      to: target.phone,
      message,
    });
  }
  return await fallbackToEmail(target, message, "no_provider_configured");
}

async function fallbackToEmail(
  target: CallTarget,
  message: string,
  reason: string,
): Promise<CallResult> {
  if (!target.email) {
    logger.warn(
      { target: target.label, reason },
      "[voice-call] no email fallback available — escalation dropped",
    );
    return { ok: false, provider: "skipped", reason };
  }
  const subject = `[URGENT] Qorix INR escalation — action required`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #f59e0b;border-radius:8px;background:#fffbeb">
    <h2 style="color:#b45309;margin:0 0 12px">URGENT — voice call could not be placed</h2>
    <p style="color:#374151;font-size:14px;line-height:1.55">${escapeHtml(message)}</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Voice provider not configured (${reason}). Email sent in lieu of a phone call.</p>
  </div>`;
  try {
    await sendEmail(target.email, subject, message, html);
    logger.info(
      { target: target.label, reason },
      "[voice-call] email fallback sent",
    );
    return { ok: true, provider: "email-fallback", reason };
  } catch (err) {
    logger.warn(
      { target: target.label, err: (err as Error).message },
      "[voice-call] email fallback failed",
    );
    return { ok: false, provider: "email-fallback", reason: (err as Error).message };
  }
}

async function callViaTwilio(opts: {
  sid: string;
  token: string;
  from: string;
  to: string;
  message: string;
}): Promise<CallResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${opts.sid}/Calls.json`;
  const auth = Buffer.from(`${opts.sid}:${opts.token}`).toString("base64");
  const twiml = `<Response><Say voice="alice">${escapeXml(opts.message)}</Say></Response>`;
  const body = new URLSearchParams({
    From: opts.from,
    To: opts.to,
    Twiml: twiml,
  });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!r.ok) {
      const text = await r.text();
      logger.warn(
        { status: r.status, body: text.slice(0, 300) },
        "[voice-call] twilio call failed",
      );
      return { ok: false, provider: "twilio", reason: `${r.status}` };
    }
    return { ok: true, provider: "twilio" };
  } catch (err) {
    return { ok: false, provider: "twilio", reason: (err as Error).message };
  }
}

async function callViaExotel(opts: {
  sid: string;
  key: string;
  token: string;
  from: string;
  to: string;
  message: string;
}): Promise<CallResult> {
  // Exotel Connect-Applet style: place a call from a virtual number to the
  // recipient. The CallerId is your Exotel virtual number; the recipient
  // hears the message via TTS (configured in the flow). For pure-TTS without
  // a flow, swap to the "Calls/connect" endpoint below.
  const url = `https://api.exotel.com/v1/Accounts/${opts.sid}/Calls/connect.json`;
  const auth = Buffer.from(`${opts.key}:${opts.token}`).toString("base64");
  const body = new URLSearchParams({
    From: opts.from,
    To: opts.to,
    CallerId: opts.from,
    StatusCallback: "",
    CustomField: opts.message.slice(0, 250),
  });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!r.ok) {
      const text = await r.text();
      logger.warn(
        { status: r.status, body: text.slice(0, 300) },
        "[voice-call] exotel call failed",
      );
      return { ok: false, provider: "exotel", reason: `${r.status}` };
    }
    return { ok: true, provider: "exotel" };
  } catch (err) {
    return { ok: false, provider: "exotel", reason: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
