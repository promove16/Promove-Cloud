const Sprint = require('../../models/Sprint');
const Ticket = require('../../models/Ticket');
const { ApiError } = require('../../utils/ApiError');
const { assertProjectAccess, assertProjectLead, getProjectByBoardId } = require('../../utils/projectAccess');

async function createSprint(boardId, userId, body) {
  const { project } = await getProjectByBoardId(boardId);
  await assertProjectLead(project, userId);

  const activeSprint = await Sprint.findOne({ boardId, status: 'active' });
  if (activeSprint) {
    throw ApiError.badRequest('Another sprint is active');
  }

  return Sprint.create({
    boardId,
    name: body.name,
    goal: body.goal || '',
    startDate: body.startDate || null,
    endDate: body.endDate || null,
    status: 'planned',
  });
}

async function getSprintsByBoard(boardId, userId) {
  const { project } = await getProjectByBoardId(boardId);
  await assertProjectAccess(project, userId);

  const sprints = await Sprint.find({ boardId }).sort({ createdAt: 1 }).lean();
  const enriched = await Promise.all(sprints.map(async (sprint) => {
    const tickets = await Ticket.find({ sprintId: sprint._id }).select('status');

    return {
      ...sprint,
      ticketCount: tickets.length,
      completedTicketCount: tickets.filter((ticket) => ticket.status === 'done').length,
    };
  }));

  return enriched;
}

async function getSprint(sprintId, userId) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectAccess(project, userId);

  return sprint;
}

async function updateSprint(sprintId, userId, updates) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectLead(project, userId);

  ['name', 'goal', 'startDate', 'endDate'].forEach((field) => {
    if (updates[field] !== undefined) {
      sprint[field] = updates[field];
    }
  });

  await sprint.save();
  return sprint;
}

async function startSprint(sprintId, userId) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectLead(project, userId);

  const activeSprint = await Sprint.findOne({
    boardId: sprint.boardId,
    status: 'active',
    _id: { $ne: sprint._id },
  });

  if (activeSprint) {
    throw ApiError.badRequest('Another sprint is active');
  }

  sprint.status = 'active';
  if (!sprint.startDate) {
    sprint.startDate = new Date();
  }

  await sprint.save();
  return sprint;
}

async function completeSprint(sprintId, userId) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectLead(project, userId);

  if (sprint.status !== 'active') {
    throw ApiError.badRequest('Sprint must be active');
  }

  const incompleteTickets = await Ticket.find({
    sprintId: sprint._id,
    status: { $ne: 'done' },
  });
  const incompleteIds = incompleteTickets.map((ticket) => ticket._id);

  if (incompleteIds.length > 0) {
    await Ticket.updateMany(
      { _id: { $in: incompleteIds } },
      { status: 'backlog', sprintId: null, order: 0 }
    );
  }

  sprint.ticketIds = sprint.ticketIds.filter((ticketId) => (
    !incompleteIds.some((incompleteId) => String(incompleteId) === String(ticketId))
  ));
  sprint.status = 'completed';
  sprint.endDate = new Date();
  await sprint.save();

  return { sprint, movedBackCount: incompleteIds.length };
}

async function addTicketToSprint(sprintId, userId, body) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectAccess(project, userId);

  const ticket = await Ticket.findById(body.ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  if (String(ticket.boardId) !== String(sprint.boardId)) {
    throw ApiError.badRequest('Ticket does not belong to this board');
  }

  if (ticket.sprintId) {
    throw ApiError.badRequest('Ticket already in a sprint');
  }

  sprint.ticketIds.push(ticket._id);
  await sprint.save();

  ticket.sprintId = sprint._id;
  await ticket.save();

  return sprint;
}

async function removeTicketFromSprint(sprintId, userId, ticketId) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectAccess(project, userId);

  sprint.ticketIds = sprint.ticketIds.filter((id) => String(id) !== String(ticketId));
  await sprint.save();

  await Ticket.findByIdAndUpdate(ticketId, { sprintId: null });
  return sprint;
}

function buildDateSeries(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function getBurndownData(sprintId, userId) {
  const sprint = await Sprint.findById(sprintId);

  if (!sprint) {
    throw ApiError.notFound('Sprint');
  }

  const { project } = await getProjectByBoardId(sprint.boardId);
  await assertProjectAccess(project, userId);

  if (!sprint.startDate || !sprint.endDate) {
    throw ApiError.badRequest('Sprint must have startDate and endDate');
  }

  const tickets = await Ticket.find({ _id: { $in: sprint.ticketIds } }).sort({ updatedAt: 1 });
  const totalPoints = tickets.reduce((sum, ticket) => sum + (ticket.storyPoints || 1), 0);
  const dateSeries = buildDateSeries(new Date(sprint.startDate), new Date(sprint.endDate));
  const today = new Date();
  const actualSeries = dateSeries.filter((date) => date <= today);
  const idealStep = dateSeries.length > 1 ? totalPoints / (dateSeries.length - 1) : totalPoints;

  return {
    sprintName: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    totalPoints,
    idealLine: dateSeries.map((date, index) => ({
      date: date.toISOString().slice(0, 10),
      points: Math.max(Math.round((totalPoints - idealStep * index) * 100) / 100, 0),
    })),
    actualLine: actualSeries.map((date) => ({
      date: date.toISOString().slice(0, 10),
      points: Math.max(totalPoints - tickets
        .filter((ticket) => ticket.status === 'done' && ticket.updatedAt <= date)
        .reduce((sum, ticket) => sum + (ticket.storyPoints || 1), 0), 0),
    })),
  };
}

module.exports = {
  createSprint,
  getSprintsByBoard,
  getSprint,
  updateSprint,
  startSprint,
  completeSprint,
  addTicketToSprint,
  removeTicketFromSprint,
  getBurndownData,
};
