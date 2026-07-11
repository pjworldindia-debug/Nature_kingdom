const express  = require('express');
const passport = require('../config/passport');
const bcrypt   = require('bcrypt');
const { body, validationResult } = require('express-validator');
const pool     = require('../config/database');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { isAuthenticated } = require('../middleware/auth.middleware');

const router = express.Router();

// ── LOCAL REGISTER ────────────────────────────────────────────────────────────
router.post('/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows[0]) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }
      const hash = await bcrypt.hash(password, 12);
      const { rows: [user] } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role`,
        [name, email, hash]
      );
      req.login(user, err => {
        if (err) return res.status(500).json({ message: 'Session error.' });
        res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      });
    } catch (err) {
      res.status(500).json({ message: 'Registration failed.' });
    }
  }
);

// ── LOCAL LOGIN ───────────────────────────────────────────────────────────────
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Invalid credentials.' });
    req.login(user, err => {
      if (err) return next(err);
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    });
  })(req, res, next);
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ message: 'Logout failed.' });
    req.session.destroy(() => {
      res.clearCookie('nk.sid');
      res.json({ message: 'Logged out.' });
    });
  });
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google'));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/account/login.html?error=oauth_failed' }),
  (req, res) => res.redirect('/account/dashboard.html')
);

// ── GITHUB OAUTH ──────────────────────────────────────────────────────────────
router.get('/github', passport.authenticate('github'));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/account/login.html?error=oauth_failed' }),
  (req, res) => res.redirect('/account/dashboard.html')
);

// ── SESSION CHECK (for client-side auth state) ────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ authenticated: false });
  const { id, name, email, role, avatar_url } = req.user;
  res.json({ authenticated: true, user: { id, name, email, role, avatar_url } });
});

// ── LINKED PROVIDERS ──────────────────────────────────────────────────────────
router.get('/linked-providers', isAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT provider FROM oauth_accounts WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ providers: rows.map(r => r.provider) });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
