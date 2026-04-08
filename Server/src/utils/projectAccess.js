const { ApiError } = require('./ApiError');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Board = require('../models/Board');

async function isTeamMember(teamId, userId) {
  if (!teamId) {
    return false;
  }

  const team = await Team.findOne({
    _id: teamId,
    'members.userId': userId,
  }).select('_id');

  return Boolean(team);
}

async function canAccessProject(project, userId) {
  if (!project) {
    return false;
  }

  if (String(project.leadStudentId) === String(userId)) {
    return true;
  }

  if (await isTeamMember(project.teamId, userId)) {
    return true;
  }

  if (project.mentorId && String(project.mentorId) === String(userId)) {
    return true;
  }

  return project.pitchRequests.some((request) => (
    request.investorId
    && String(request.investorId) === String(userId)
    && request.status === 'accepted'
  ));
}

async function assertProjectAccess(project, userId) {
  const allowed = await canAccessProject(project, userId);

  if (!allowed) {
    throw ApiError.forbidden('You do not have access to this project');
  }
}

async function getProjectByBoardId(boardId) {
  const board = await Board.findById(boardId);

  if (!board) {
    throw ApiError.notFound('Board');
  }

  const project = await Project.findById(board.projectId);

  if (!project) {
    throw ApiError.notFound('Project');
  }

  return { board, project };
}

async function assertProjectLead(project, userId) {
  if (String(project.leadStudentId) !== String(userId)) {
    throw ApiError.forbidden('Only the project lead can perform this action');
  }
}

module.exports = {
  isTeamMember,
  canAccessProject,
  assertProjectAccess,
  assertProjectLead,
  getProjectByBoardId,
};
