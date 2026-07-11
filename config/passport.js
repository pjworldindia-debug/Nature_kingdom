const passport        = require('passport');
const LocalStrategy   = require('passport-local').Strategy;
const GoogleStrategy  = require('passport-google-oauth20').Strategy;
const GitHubStrategy  = require('passport-github2').Strategy;
const bcrypt          = require('bcrypt');
const pool            = require('./database');
const cryptoService   = require('../services/crypto.service');

// ─── SERIALIZE / DESERIALIZE ─────────────────────────────────────────────────
// Only the user ID is stored in the session. Full user is fetched on each request.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, avatar_url, is_active FROM users WHERE id = $1',
      [id]
    );
    if (!rows[0] || !rows[0].is_active) return done(null, false);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

// ─── LOCAL STRATEGY ──────────────────────────────────────────────────────────
passport.use('local', new LocalStrategy(
  { usernameField: 'email', passwordField: 'password', passReqToCallback: true },
  async (req, email, password, done) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      const user = rows[0];

      // Account lockout check
      if (user?.locked_until && new Date(user.locked_until) > new Date()) {
        return done(null, false, { message: 'Account temporarily locked. Try again later.' });
      }

      // Generic message — prevents user enumeration
      const FAIL_MSG = { message: 'Invalid credentials.' };

      if (!user || !user.password_hash) return done(null, false, FAIL_MSG);

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        // Increment failed attempts; lock after 10
        const attempts = (user.login_attempts || 0) + 1;
        const lockUntil = attempts >= 10
          ? new Date(Date.now() + 30 * 60 * 1000)  // 30 min lock
          : null;
        await pool.query(
          'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
          [attempts, lockUntil, user.id]
        );
        return done(null, false, FAIL_MSG);
      }

      // Successful login — reset counters
      await pool.query(
        'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
        [user.id]
      );

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// ─── SHARED OAUTH HANDLER ────────────────────────────────────────────────────
// Used by both Google and GitHub strategies — avoids duplication
async function handleOAuthCallback(provider, profile, accessToken, refreshToken, done) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const providerId = String(profile.id);
    const email      = profile.emails?.[0]?.value?.toLowerCase() || null;
    const name       = profile.displayName || profile.username || 'Nature Kingdom User';
    const avatarUrl  = profile.photos?.[0]?.value || null;
    
    const encAccessToken = cryptoService.encrypt(accessToken);
    const encRefreshToken = cryptoService.encrypt(refreshToken);

    // 1. Look for existing OAuth link
    const { rows: oauthRows } = await client.query(
      'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_id = $2',
      [provider, providerId]
    );

    let userId;

    if (oauthRows[0]) {
      // OAuth link exists — use that user
      userId = oauthRows[0].user_id;
      // Update tokens (encrypted before storage)
      await client.query(
        `UPDATE oauth_accounts
         SET access_token = $1, refresh_token = $2, profile_data = $3, updated_at = NOW()
         WHERE provider = $4 AND provider_id = $5`,
        [encAccessToken, encRefreshToken, JSON.stringify(profile._json), provider, providerId]
      );
    } else {
      // No OAuth link. Try to match by email (account linking).
      let existingUser = null;
      if (email) {
        const { rows } = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );
        existingUser = rows[0] || null;
      }

      if (existingUser) {
        // Link this provider to the existing email-based account
        userId = existingUser.id;
      } else {
        // Brand new user — create user record
        const { rows: newUser } = await client.query(
          `INSERT INTO users (name, email, avatar_url, email_verified, password_hash)
           VALUES ($1, $2, $3, TRUE, NULL) RETURNING id`,
          [name, email, avatarUrl]
        );
        userId = newUser[0].id;
      }

      // Create the OAuth link record
      await client.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_id, access_token, refresh_token, profile_data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, provider, providerId, encAccessToken, encRefreshToken, JSON.stringify(profile._json)]
      );
    }

    // Update last_login
    await client.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);

    await client.query('COMMIT');

    // Fetch full user for session serialization
    const { rows: userRows } = await pool.query(
      'SELECT id, name, email, role, avatar_url, is_active FROM users WHERE id = $1',
      [userId]
    );
    return done(null, userRows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    return done(err);
  } finally {
    client.release();
  }
}

// ─── GOOGLE STRATEGY ─────────────────────────────────────────────────────────
passport.use('google', new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL:  `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    scope:        ['profile', 'email'],
    state:        true     // CSRF protection for OAuth flow
  },
  (accessToken, refreshToken, profile, done) =>
    handleOAuthCallback('google', profile, accessToken, refreshToken, done)
));

// ─── GITHUB STRATEGY ─────────────────────────────────────────────────────────
passport.use('github', new GitHubStrategy(
  {
    clientID:     process.env.GITHUB_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'placeholder',
    callbackURL:  `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/github/callback`,
    scope:        ['user:email']
  },
  (accessToken, refreshToken, profile, done) =>
    handleOAuthCallback('github', profile, accessToken, refreshToken, done)
));

module.exports = passport;
