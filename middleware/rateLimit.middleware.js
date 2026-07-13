const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default || require('rate-limit-redis');
const redisClient = require('../config/redis');

// Factory for consistent config
const limiter = (max, windowMinutes, opts = {}) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders:   false,
  store: new RedisStore({ 
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'nk:rl:' 
  }),
  message: { error: 'Too many requests. Please slow down.' },
  ...opts
});

module.exports = {
  globalLimiter:  limiter(300, 15),     // All routes
  authLimiter:    limiter(50, 15),      // /api/auth/login + /register
  paymentLimiter: limiter(100,  1),      // /api/payment/*
  apiLimiter:     limiter(60,  1),      // General API
  searchLimiter:  limiter(120, 1),      // Search
  adminLimiter:   limiter(30,  1),      // Admin panel
};
