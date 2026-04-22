require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const passport = require('./lib/passport');
const googleAuthRouter = require('./routes/google-auth');
const { authMiddleware } = require('./lib/jwt');
const users = require('./lib/users');

const app = express();
const PORT = process.env.PORT || 3001;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const OTP_EXPIRY_MS = 5 * 60 * 1000;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('FATAL: SMTP_USER and SMTP_PASS environment variables are required');
  process.exit(1);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 10 * 60 * 1000 },
  })
);
app.use(passport.initialize());

const otpStore = new Map();
const resetStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now) otpStore.delete(email);
  }
  for (const [email, record] of resetStore.entries()) {
    if (record.expiresAt < now) resetStore.delete(email);
  }
}, 60 * 1000);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

transporter.verify((err) => {
  if (err) console.error('SMTP verification failed:', err.message);
  else console.log(`SMTP ready: ${SMTP_HOST}:${SMTP_PORT}`);
});

const isValidEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  email.length <= 254;

const generateOTP = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests. Try again later.' },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Try again later.' },
});

// Premium branded HTML template — matches Qorix Markets dark theme.
// Uses table layout + inline styles for maximum email-client compatibility.
const renderQorixEmail = ({ purposeLabel, intro, otp, expiryMinutes }) => {
  const otpCells = otp
    .split('')
    .map(
      (d, i) =>
        `<td align="center" style="padding:6px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#ffffff;line-height:1;${
          i > 0 ? 'border-left:1px solid rgba(148,163,184,0.25);' : ''
        }">${d}</td>`,
    )
    .join('');

  const iconRow = (svg, body) => `
    <tr>
      <td style="padding:10px 0;" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="44" valign="top" style="padding-right:14px;">
              <div style="width:36px;height:36px;border-radius:50%;background:rgba(56,189,248,0.10);border:1px solid rgba(56,189,248,0.30);text-align:center;line-height:34px;">${svg}</div>
            </td>
            <td valign="middle" style="font-size:13px;line-height:1.6;color:#cbd5e1;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>`;

  const shieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const lockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const mailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${purposeLabel} — Qorix Markets</title>
  </head>
  <body style="margin:0;padding:0;background:#05070d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05070d;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
            <tr>
              <td valign="middle" style="padding-right:12px;">
                <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#38bdf8 0%,#a78bfa 100%);text-align:center;line-height:44px;font-size:22px;font-weight:800;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Q</div>
              </td>
              <td valign="middle" style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;line-height:1;">
                QORIX
                <div style="font-size:11px;letter-spacing:5px;color:#7dd3fc;font-weight:600;margin-top:4px;">— M A R K E T S —</div>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#0a1020;border:1px solid rgba(56,189,248,0.15);border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.25;color:#ffffff;font-weight:700;">${purposeLabel}</h1>
                <div style="height:3px;width:70px;background:linear-gradient(90deg,#38bdf8 0%,#a78bfa 100%);border-radius:2px;margin-bottom:18px;"></div>
                <p style="margin:0 0 26px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(59,130,246,0.14) 0%,rgba(139,92,246,0.14) 100%);border:1px solid rgba(99,102,241,0.30);border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:18px 12px 6px 12px;font-size:11px;letter-spacing:3px;color:#7dd3fc;text-transform:uppercase;font-weight:600;">Your verification code</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:6px 12px 4px 12px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${otpCells}</tr></table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:4px 12px 18px 12px;font-size:12px;color:#94a3b8;">Expires in ${expiryMinutes} minutes</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 4px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${iconRow(shieldSvg, `<strong style="color:#ffffff;">Never share this code</strong> with anyone — Qorix staff will never ask for it.`)}
                  ${iconRow(lockSvg, `If you did not initiate this request, please secure your account and contact support immediately.`)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px;"><div style="height:1px;background:rgba(148,163,184,0.14);"></div></td>
            </tr>
            <tr>
              <td style="padding:4px 40px 28px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${iconRow(mailSvg, `This is an automated message from Qorix Markets. If you did not request this code, you can safely ignore this email — no action is needed.<br/><br/>Need help? Reach us at <a href="mailto:support@qorixmarkets.com" style="color:#7dd3fc;text-decoration:none;">support@qorixmarkets.com</a>`)}
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 26px 40px;font-size:12px;color:#64748b;line-height:1.6;">
                © ${new Date().getFullYear()} Qorix Markets. All rights reserved.<br/>
                <a href="https://qorixmarkets.com" style="color:#7dd3fc;text-decoration:none;">qorixmarkets.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildOtpEmail = (otp) => ({
  subject: 'Qorix Markets — Email Verification Code',
  text: `Your Qorix Markets verification code is: ${otp}\n\nThis code expires in 5 minutes. Do not share it with anyone.\n\nIf you did not request this, you can safely ignore this email.\n\n— Qorix Markets\nhttps://qorixmarkets.com`,
  html: renderQorixEmail({
    purposeLabel: 'Email Verification',
    intro: 'Welcome to Qorix Markets. Use the code below to verify your email and finish creating your account.',
    otp,
    expiryMinutes: 5,
  }),
});

const buildResetEmail = (otp) => ({
  subject: 'Qorix Markets — Password Reset Code',
  text: `Your Qorix Markets password reset code is: ${otp}\n\nThis code expires in 5 minutes. Do not share it with anyone.\n\nIf you didn't request a password reset, please ignore this email — your password will remain unchanged.\n\n— Qorix Markets\nhttps://qorixmarkets.com`,
  html: renderQorixEmail({
    purposeLabel: 'Password Reset Request',
    intro: 'You requested to reset your Qorix Markets password. Use the code below to set a new password and regain access to your account.',
    otp,
    expiryMinutes: 5,
  }),
});

const isStrongPassword = (pw) =>
  typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

app.use('/auth', googleAuthRouter);

app.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get('/users', authMiddleware, (_req, res) => {
  res.json({
    success: true,
    count: users.listUsers().length,
    users: users.listUsers().map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      picture: u.picture,
      provider: u.provider,
      createdAt: u.createdAt,
    })),
  });
});

app.post('/send-otp', sendOtpLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    otpStore.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    const { subject, text, html } = buildOtpEmail(otp);

    await transporter.sendMail({
      from: `"Qorix Markets" <${SMTP_USER}>`,
      to: normalizedEmail,
      subject,
      text,
      html,
    });

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
    });
  } catch (err) {
    console.error('send-otp error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

app.post('/verify-otp', verifyOtpLimiter, (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'OTP must be a 6-digit code' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ success: false, error: 'OTP not found. Please request a new one.' });
    }
    if (record.expiresAt < Date.now()) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }
    if (record.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({ success: false, error: 'Too many failed attempts. Please request a new OTP.' });
    }
    if (record.otp !== otp) {
      record.attempts += 1;
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP',
        attemptsRemaining: 5 - record.attempts,
      });
    }

    otpStore.delete(normalizedEmail);
    return res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verify-otp error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
});

app.post('/forgot-password', sendOtpLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    resetStore.set(normalizedEmail, { otp, expiresAt, attempts: 0, verified: false });

    const { subject, text, html } = buildResetEmail(otp);

    await transporter.sendMail({
      from: `"Qorix Markets" <${SMTP_USER}>`,
      to: normalizedEmail,
      subject,
      text,
      html,
    });

    return res.json({
      success: true,
      message: 'Password reset code sent to your email',
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
    });
  } catch (err) {
    console.error('forgot-password error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send reset code' });
  }
});

app.post('/verify-reset-otp', verifyOtpLimiter, (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'OTP must be a 6-digit code' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = resetStore.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Reset code not found. Please request a new one.' });
    }
    if (record.expiresAt < Date.now()) {
      resetStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, error: 'Reset code has expired. Please request a new one.' });
    }
    if (record.attempts >= 5) {
      resetStore.delete(normalizedEmail);
      return res.status(429).json({ success: false, error: 'Too many failed attempts. Please request a new reset code.' });
    }
    if (record.otp !== otp) {
      record.attempts += 1;
      return res.status(400).json({
        success: false,
        error: 'Invalid reset code',
        attemptsRemaining: 5 - record.attempts,
      });
    }

    record.verified = true;
    record.expiresAt = Date.now() + OTP_EXPIRY_MS;
    return res.json({
      success: true,
      message: 'Reset code verified. You can now set a new password.',
    });
  } catch (err) {
    console.error('verify-reset-otp error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to verify reset code' });
  }
});

app.post('/reset-password', verifyOtpLimiter, (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'OTP must be a 6-digit code' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be 8-128 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = resetStore.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Reset code not found. Please request a new one.' });
    }
    if (record.expiresAt < Date.now()) {
      resetStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, error: 'Reset code has expired. Please request a new one.' });
    }
    if (record.otp !== otp) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        resetStore.delete(normalizedEmail);
        return res.status(429).json({ success: false, error: 'Too many failed attempts. Please request a new reset code.' });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid reset code',
        attemptsRemaining: 5 - record.attempts,
      });
    }

    resetStore.delete(normalizedEmail);

    return res.json({
      success: true,
      message: 'Password reset successfully',
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('reset-password error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth server running on port ${PORT}`);
});
