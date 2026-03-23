const Board = require('../../models/Board');
const Project = require('../../models/Project');
const ApiError = require('../../utils/ApiError');
const { assertProjectAccess, assertProjectLead } = require('../../utils/projectAccess');

async function getBoardByProject(projectId, userId) {
  const board = await Board.findOne({ projectId });

  if (!board) {
    throw ApiError.notFound('Board');
  }

  const project = await Project.findById(projectId);
  await assertProjectAccess(project, userId);

  return board;
}

async function updateColumns(boardId, userId, columns) {
  const board = await Board.findById(boardId);

  if (!board) {
    throw ApiError.notFound('Board');
  }

  const project = await Project.findById(board.projectId);
  await assertProjectLead(project, userId);

  if (!columns.some((column) => column.id === 'done')) {
    throw ApiError.badRequest('The done column is required');
  }

  board.columns = columns;
  await board.save();
  return board;
}

module.exports = {
  getBoardByProject,
  updateColumns,
};
