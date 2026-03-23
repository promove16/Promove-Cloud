const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const shouldSkip = () => config.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many attempts. Try again in 15 minutes.',
  },
  skip: shouldSkip,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many requests.',
  },
  skip: shouldSkip,
});

module.exports = {
  authLimiter,
  apiLimiter,
};
