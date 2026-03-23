const ticketService = require('./ticket.service');

async function getTicketsByBoard(req, res) {
  const tickets = await ticketService.getTicketsByBoard(req.params.boardId, req.user.userId);
  res.json({ success: true, tickets });
}

async function createTicket(req, res) {
  const ticket = await ticketService.createTicket(req.params.boardId, req.user.userId, req.body);
  res.status(201).json({ success: true, ticket });
}

async function getTicket(req, res) {
  const ticket = await ticketService.getTicket(req.params.id, req.user.userId);
  res.json({ success: true, ticket });
}

async function updateTicket(req, res) {
  const ticket = await ticketService.updateTicket(req.params.id, req.user.userId, req.body);
  res.json({ success: true, ticket });
}

async function deleteTicket(req, res) {
  const result = await ticketService.deleteTicket(req.params.id, req.user.userId);
  res.json({ success: true, message: result.message });
}

async function updateTicketStatus(req, res) {
  const ticket = await ticketService.updateTicketStatus(req.params.id, req.user.userId, req.body.status);
  res.json({ success: true, ticket });
}

async function updateTicketOrder(req, res) {
  const ticket = await ticketService.updateTicketOrder(req.params.id, req.user.userId, req.body);
  res.json({ success: true, ticket });
}

async function addComment(req, res) {
  const comment = await ticketService.addComment(req.params.id, req.user.userId, req.body);
  res.status(201).json({ success: true, comment });
}

async function removeComment(req, res) {
  const result = await ticketService.removeComment(req.params.id, req.user.userId, req.params.commentId);
  res.json({ success: true, message: result.message });
}

async function addAttachment(req, res) {
  const ticket = await ticketService.addAttachment(req.params.id, req.user.userId, req.body.files || []);
  res.json({ success: true, ticket });
}

async function removeAttachment(req, res) {
  const ticket = await ticketService.removeAttachment(req.params.id, req.user.userId, decodeURIComponent(req.params.publicId));
  res.json({ success: true, ticket });
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
