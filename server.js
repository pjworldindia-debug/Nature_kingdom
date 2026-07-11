require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default || require('connect-redis');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const passport = require('./config/passport');
const redisClient = require('./config/redis');
const path = require('path');
const csurf = require('csurf');
const { globalLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "https://mercury.phonepe.com", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "https://lh3.googleusercontent.com", "https://avatars.githubusercontent.com", "blob:", "https://images.unsplash.com", "https://via.placeholder.com"],
      connectSrc:  ["'self'", "https://api.phonepe.com", "https://api-preprod.phonepe.com"],
      frameSrc:    ["https://mercury.phonepe.com"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Observability Middleware: Request IDs
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  // Basic structured log entry for every request
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start
    }));
  });
  next();
});

// Basic middleware
app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(hpp()); // HTTP Parameter Pollution protection
app.use(globalLimiter);

// Serve static assets natively directly through Node if not behind Nginx locally
app.use(express.static(path.join(__dirname, 'public')));

// Raw body parser for webhooks before global express.json
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Session
app.use(session({
  name:   'nk.sid',
  secret: process.env.SESSION_SECRET || 'dev_fallback_secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store:  new RedisStore({ client: redisClient, prefix: 'nk:sess:' }),
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  }
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection (apply globally, exclude webhook and oauth GETs if needed)
const csrfProtection = csurf();
// We'll expose a route to get the CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  if (req.session) {
    req.session.save((err) => {
      if (err) console.error(JSON.stringify({ requestId: req.id, error: 'Error saving session', detail: err.toString() }));
      res.json({ csrfToken: token });
    });
  } else {
    res.json({ csrfToken: token });
  }
});

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
// const orderRoutes = require('./routes/orders'); // Skipping orders for brevity if not implemented fully yet
const paymentRoutes = require('./routes/payment');

// Webhook bypasses CSRF because it's a POST from PhonePe, which is handled earlier via express.raw
const { authLimiter } = require('./middleware/rateLimit.middleware');
app.use('/api/auth', csrfProtection, authLimiter, authRoutes);
app.use('/api/products', csrfProtection, productRoutes);
app.use('/api/cart', csrfProtection, cartRoutes);
// app.use('/api/orders', csrfProtection, orderRoutes);
app.use('/api/payment', paymentRoutes);

// Fallback to index.html for SPA-like behavior or specific pages if needed
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')); // Normally would be a 404 page
});

// Error handling
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Form tampered with (CSRF mismatch)' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
