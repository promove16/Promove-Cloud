const sprintService = require('./sprint.service');

async function getSprintsByBoard(req, res) {
  const sprints = await sprintService.getSprintsByBoard(req.params.boardId, req.user.userId);
  res.json({ success: true, sprints });
}

async function createSprint(req, res) {
  const sprint = await sprintService.createSprint(req.params.boardId, req.user.userId, req.body);
  res.status(201).json({ success: true, sprint });
}

async function getSprint(req, res) {
  const sprint = await sprintService.getSprint(req.params.id, req.user.userId);
  res.json({ success: true, sprint });
}

async function updateSprint(req, res) {
  const sprint = await sprintService.updateSprint(req.params.id, req.user.userId, req.body);
  res.json({ success: true, sprint });
}

async function startSprint(req, res) {
  const sprint = await sprintService.startSprint(req.params.id, req.user.userId);
  res.json({ success: true, sprint });
}

async function completeSprint(req, res) {
  const result = await sprintService.completeSprint(req.params.id, req.user.userId);
  res.json({ success: true, ...result });
}

async function addTicketToSprint(req, res) {
  const sprint = await sprintService.addTicketToSprint(req.params.id, req.user.userId, req.body);
  res.json({ success: true, sprint });
}

async function removeTicketFromSprint(req, res) {
  const sprint = await sprintService.removeTicketFromSprint(req.params.id, req.user.userId, req.params.ticketId);
  res.json({ success: true, sprint });
}

async function getBurndownData(req, res) {
  const burndown = await sprintService.getBurndownData(req.params.id, req.user.userId);
  res.json({ success: true, burndown });
}

module.exports = {
  getSprintsByBoard,
  createSprint,
  getSprint,
  updateSprint,
  startSprint,
  completeSprint,
  addTicketToSprint,
  removeTicketFromSprint,
  getBurndownData,
};
