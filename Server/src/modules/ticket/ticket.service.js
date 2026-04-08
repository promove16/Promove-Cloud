const Ticket = require('../../models/Ticket');
const Sprint = require('../../models/Sprint');
const { ApiError } = require('../../utils/ApiError');
const ENUMS = require('../../constants/enums');
const { assertProjectAccess, getProjectByBoardId } = require('../../utils/projectAccess');
const { deleteFile } = require('../upload/upload.service');

function emptyGroupedTickets() {
  return ENUMS.TICKET_STATUS.reduce((accumulator, status) => {
    accumulator[status] = [];
    return accumulator;
  }, {});
}

async function getTicketsByBoard(boardId, userId) {
  const { project } = await getProjectByBoardId(boardId);
  await assertProjectAccess(project, userId);

  const tickets = await Ticket.find({ boardId })
    .sort({ order: 1, createdAt: 1 })
    .populate({ path: 'assigneeId', select: 'name profilePicture' })
    .populate({ path: 'reporterId', select: 'name profilePicture' });

  return tickets.reduce((accumulator, ticket) => {
    accumulator[ticket.status].push(ticket);
    return accumulator;
  }, emptyGroupedTickets());
}

async function createTicket(boardId, userId, body) {
  const { project } = await getProjectByBoardId(boardId);
  await assertProjectAccess(project, userId);

  const status = body.status || 'backlog';
  const order = await Ticket.countDocuments({ boardId, status });

  return Ticket.create({
    boardId,
    reporterId: userId,
    title: body.title,
    description: body.description || '',
    status,
    priority: body.priority || 'P2',
    assigneeId: body.assigneeId || null,
    labels: body.labels || [],
    storyPoints: body.storyPoints ?? null,
    dueDate: body.dueDate || null,
    order,
  });
}

async function getTicket(ticketId, userId) {
  const ticket = await Ticket.findById(ticketId)
    .populate({ path: 'assigneeId', select: 'name profilePicture email' })
    .populate({ path: 'reporterId', select: 'name profilePicture email' })
    .populate({ path: 'comments.authorId', select: 'name profilePicture' });

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  return ticket;
}

async function updateTicket(ticketId, userId, updates) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  ['title', 'description', 'priority', 'assigneeId', 'labels', 'storyPoints', 'dueDate'].forEach((field) => {
    if (updates[field] !== undefined) {
      ticket[field] = updates[field];
    }
  });

  await ticket.save();
  return ticket;
}

async function deleteTicket(ticketId, userId) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  const canDelete = String(ticket.reporterId) === String(userId)
    || String(project.leadStudentId) === String(userId);

  if (!canDelete) {
    throw ApiError.forbidden('You cannot delete this ticket');
  }

  if (ticket.status === 'done') {
    throw ApiError.badRequest('Completed tickets cannot be deleted');
  }

  if (ticket.sprintId) {
    await Sprint.findByIdAndUpdate(ticket.sprintId, { $pull: { ticketIds: ticket._id } });
  }

  await Ticket.deleteOne({ _id: ticket._id });
  return { message: 'Ticket deleted' };
}

async function updateTicketStatus(ticketId, userId, status) {
  if (!ENUMS.TICKET_STATUS.includes(status)) {
    throw ApiError.badRequest('Invalid ticket status');
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  ticket.status = status;
  await ticket.save();

  return { _id: ticket._id, status: ticket.status };
}

async function reorderStatus(boardId, status) {
  const tickets = await Ticket.find({ boardId, status }).sort({ order: 1, updatedAt: 1 });

  await Promise.all(tickets.map((ticket, index) => Ticket.updateOne(
    { _id: ticket._id },
    { order: index }
  )));
}

async function updateTicketOrder(ticketId, userId, body) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  const fromStatus = ticket.status;
  const toStatus = body.status || ticket.status;
  const targetOrder = Math.max(body.order ?? ticket.order, 0);
  const nextSprintId = body.sprintId === undefined ? ticket.sprintId : body.sprintId;

  const siblings = await Ticket.find({
    boardId: ticket.boardId,
    status: toStatus,
    _id: { $ne: ticket._id },
  }).sort({ order: 1, createdAt: 1 });

  const orderedIds = siblings.map((item) => item._id.toString());
  orderedIds.splice(Math.min(targetOrder, orderedIds.length), 0, ticket._id.toString());

  await Promise.all(orderedIds.map((id, index) => Ticket.updateOne({ _id: id }, {
    status: toStatus,
    order: index,
    sprintId: String(id) === String(ticket._id) ? (nextSprintId || null) : undefined,
  })));

  if (fromStatus !== toStatus) {
    await reorderStatus(ticket.boardId, fromStatus);
  }

  const updatedTicket = await Ticket.findById(ticket._id);

  return {
    _id: updatedTicket._id,
    status: updatedTicket.status,
    order: updatedTicket.order,
  };
}

async function addComment(ticketId, userId, body) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  ticket.comments.push({
    authorId: userId,
    body: body.body,
    createdAt: new Date(),
  });
  await ticket.save();

  const populatedTicket = await Ticket.findById(ticket._id)
    .populate({ path: 'comments.authorId', select: 'name profilePicture' });

  return populatedTicket.comments[populatedTicket.comments.length - 1];
}

async function removeComment(ticketId, userId, commentId) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const comment = ticket.comments.id(commentId);
  if (!comment) {
    throw ApiError.notFound('Comment');
  }

  if (String(comment.authorId) !== String(userId)) {
    throw ApiError.forbidden('You can only delete your own comment');
  }

  ticket.comments.pull({ _id: commentId });
  await ticket.save();

  return { message: 'Comment deleted' };
}

async function addAttachment(ticketId, userId, files) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  const urls = files.map((file) => file.url);
  ticket.attachments.push(...urls);
  await ticket.save();

  return ticket;
}

async function removeAttachment(ticketId, userId, publicId) {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw ApiError.notFound('Ticket');
  }

  const { project } = await getProjectByBoardId(ticket.boardId);
  await assertProjectAccess(project, userId);

  ticket.attachments = ticket.attachments.filter((fileUrl) => !fileUrl.includes(publicId));
  await ticket.save();
  await deleteFile(publicId);

  return ticket;
}

module.exports = {
  getTicketsByBoard,
  createTicket,
  getTicket,
  updateTicket,
  deleteTicket,
  updateTicketStatus,
  updateTicketOrder,
  addComment,
  removeComment,
  addAttachment,
  removeAttachment,
};
