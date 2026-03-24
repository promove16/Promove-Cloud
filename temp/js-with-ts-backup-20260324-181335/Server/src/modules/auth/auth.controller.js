const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const authService = require('./auth.service');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function register(req, res) {
  const { name, email, password, role } = req.body;
  const result = await authService.registerUser(name, email, password, role);

  res.status(201).json({ success: true, message: result.message });
}

async function verifyEmail(req, res) {
  const { token } = req.query;
  if (!token) {
    throw ApiError.badRequest('Token is required');
  }

  const result = await authService.verifyEmail(token);
  res.json({ success: true, message: result.message });
}

async function login(req, res) {
  const { email, password } = req.body;
  const result = await authService.loginUser(email, password);

  res.cookie('rft', result.refreshTokenRaw, COOKIE_OPTIONS);
  res.json({ success: true, accessToken: result.accessToken, user: result.user });
}

async function refresh(req, res) {
  const rawToken = req.cookies.rft;
  const result = await authService.refreshTokens(rawToken);

  res.cookie('rft', result.refreshTokenRaw, COOKIE_OPTIONS);
  res.json({ success: true, accessToken: result.accessToken, user: result.user });
}

async function logout(req, res) {
  const rawToken = req.cookies.rft;

  await authService.logoutUser(rawToken);
  res.clearCookie('rft', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true, message: 'Logged out' });
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);

  res.json({ success: true, message: result.message });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);

  res.json({ success: true, message: result.message });
}

module.exports = {
  COOKIE_OPTIONS,
  register,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
