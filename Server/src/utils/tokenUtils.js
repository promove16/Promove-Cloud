const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateAccessToken(payload) {
  return jwt.sign(
    { userId: payload.userId, role: payload.role, email: payload.email },
    config.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshTokenData() {
  const raw = crypto.randomBytes(40).toString('hex');

  return {
    raw,
    hash: hashToken(raw),
    family: uuidv4(),
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshTokenData,
  hashToken,
};
