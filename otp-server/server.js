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

const buildOtpEmail = (otp) => ({
  subject: 'Your OTP Code',
  text: `Your OTP is: ${otp}\n\nThis code is valid for 5 minutes.\nDo not share it with anyone.`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:12px">
      <h2 style="color:#1a73e8;margin:0 0 16px">Your OTP Code</h2>
      <p style="font-size:14px;color:#444;margin:0 0 20px">Use the code below to verify your email address.</p>
      <div style="font-size:36px;letter-spacing:8px;font-weight:700;color:#111;background:#fff;padding:18px;border-radius:8px;text-align:center;border:1px solid #e0e4ea">
        ${otp}
      </div>
      <p style="font-size:13px;color:#666;margin:20px 0 0">This code expires in <strong>5 minutes</strong>.</p>
      <p style="font-size:12px;color:#999;margin:8px 0 0">If you didn't request this, please ignore this email.</p>
    </div>
  `,
});

const buildResetEmail = (otp) => ({
  subject: 'Password Reset Request',
  text: `Your password reset code is: ${otp}\n\nThis code is valid for 5 minutes.\nIf you didn't request a password reset, please ignore this email and your password will remain unchanged.`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:12px">
      <h2 style="color:#d93025;margin:0 0 16px">🔐 Password Reset Request</h2>
      <p style="font-size:14px;color:#444;margin:0 0 20px">Use the code below to reset your password.</p>
      <div style="font-size:36px;letter-spacing:8px;font-weight:700;color:#111;background:#fff;padding:18px;border-radius:8px;text-align:center;border:1px solid #e0e4ea">
        ${otp}
      </div>
      <p style="font-size:13px;color:#666;margin:20px 0 0">This code expires in <strong>5 minutes</strong>.</p>
      <p style="font-size:12px;color:#d93025;margin:12px 0 0;font-weight:600">⚠️ If you didn't request a password reset, please ignore this email — your password will remain unchanged.</p>
    </div>
  `,
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
