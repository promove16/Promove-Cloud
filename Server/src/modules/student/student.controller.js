const studentService = require('./student.service');

async function getDashboardStats(req, res) {
  const stats = await studentService.getDashboardStats(req.user.userId);
  res.json({ success: true, stats });
}

async function getPortfolio(req, res) {
  const portfolio = await studentService.getPortfolio(req.user.userId);
  res.json({ success: true, portfolio });
}

async function getPublicPortfolio(req, res) {
  const portfolio = await studentService.getPublicPortfolio(req.params.userId);
  res.json({ success: true, portfolio });
}

module.exports = {
  getDashboardStats,
  getPortfolio,
  getPublicPortfolio,
};
