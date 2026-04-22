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
const renderQorixEmail = ({ purposeLabel, intro, otp, expiryMinutes }) => {
  const otpSpaced = otp.split('').join(' ');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<title>${purposeLabel} — Qorix Markets</title>
</head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F1A;padding:20px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0F172A;border-radius:18px;overflow:hidden;border:1px solid #1F2937;">
        <tr>
          <td align="center" style="padding:30px 20px;background:linear-gradient(135deg,#0B0F1A,#1E293B);">
            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#38BDF8 0%,#7C3AED 100%);text-align:center;line-height:64px;font-size:30px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;display:inline-block;">Q</div>
            <p style="margin:10px 0 0;color:#38BDF8;letter-spacing:3px;font-size:12px;font-weight:600;">QORIX MARKETS</p>
          </td>
        </tr>
        <tr>
          <td style="padding:30px;color:#ffffff;">
            <h2 style="margin:0;font-size:24px;color:#ffffff;">${purposeLabel}</h2>
            <div style="width:40px;height:3px;background:linear-gradient(90deg,#38BDF8,#7C3AED);margin:10px 0 20px;"></div>
            <p style="color:#9CA3AF;font-size:14px;line-height:1.6;margin:0;">${intro}</p>
            <div style="margin-top:25px;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:14px;padding:22px;text-align:center;box-shadow:0 0 25px rgba(124,58,237,0.4);">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:#E0F2FE;">YOUR VERIFICATION CODE</p>
              <p style="margin:12px 0;font-size:36px;letter-spacing:10px;font-weight:bold;color:#ffffff;font-family:Arial,sans-serif;">${otpSpaced}</p>
              <p style="margin:0;font-size:12px;color:#E0E7FF;">Expires in ${expiryMinutes} minutes</p>
            </div>
            <div style="margin-top:25px;">
              <p style="color:#9CA3AF;font-size:13px;margin:0;line-height:1.6;"><b style="color:#ffffff;">Never share this code</b> with anyone — Qorix staff will never ask for it.</p>
              <p style="color:#9CA3AF;font-size:13px;margin:10px 0 0;line-height:1.6;">If you did not initiate this request, please secure your account and contact support immediately.</p>
            </div>
            <div style="margin-top:20px;border-top:1px solid #1F2937;padding-top:20px;">
              <p style="color:#9CA3AF;font-size:13px;margin:0;line-height:1.6;">This is an automated message from Qorix Markets. If you did not request this code, you can safely ignore this email.</p>
              <p style="margin:8px 0 0;font-size:13px;"><a href="mailto:support@qorixmarkets.com" style="color:#38BDF8;text-decoration:none;">support@qorixmarkets.com</a></p>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px;border-top:1px solid #1F2937;color:#6B7280;font-size:12px;">
            <p style="margin:5px 0;">© ${new Date().getFullYear()} Qorix Markets. All rights reserved.</p>
            <p style="margin:5px 0;"><a href="https://qorixmarkets.com" style="color:#38BDF8;text-decoration:none;">qorixmarkets.com</a></p>
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
