const express = require('express');
const passport = require('../lib/passport');
const { signToken } = require('../lib/jwt');

const router = express.Router();

const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || '';

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
  (req, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication failed' });
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: 'google',
    });

    if (FRONTEND_REDIRECT_URL) {
      const url = new URL(FRONTEND_REDIRECT_URL);
      url.searchParams.set('token', token);
      return res.redirect(url.toString());
    }

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
      },
    });
  }
);

router.get('/google/failure', (_req, res) => {
  res.status(401).json({ success: false, error: 'Google authentication failed' });
});

module.exports = router;
