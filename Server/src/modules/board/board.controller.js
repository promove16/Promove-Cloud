const boardService = require('./board.service');

async function getBoardByProject(req, res) {
  const board = await boardService.getBoardByProject(req.params.projectId, req.user._id);
  res.json({ success: true, board });
}

async function updateColumns(req, res) {
  const board = await boardService.updateColumns(req.params.id, req.user._id, req.body.columns || []);
  res.json({ success: true, board });
}

module.exports = {
  getBoardByProject,
  updateColumns,
};
