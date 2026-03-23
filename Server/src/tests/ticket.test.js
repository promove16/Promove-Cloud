const request = require('supertest');

jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const Ticket = require('../models/Ticket');
const {
  cleanupDatabase,
  registerAndLogin,
  createProject,
  createTicket,
} = require('./helpers');

describe('Ticket module', () => {
  let student;
  let secondStudent;
  let boardId;
  let ticketId;

  beforeEach(async () => {
    await cleanupDatabase();
    student = await registerAndLogin(app, { name: 'Board Owner', email: 'board-owner@example.com' });
    secondStudent = await registerAndLogin(app, { name: 'Board Member', email: 'board-member@example.com' });

    const projectResponse = await createProject(app, student.accessToken, { title: 'Board Project' });
    boardId = projectResponse.body.project.jiraBoard._id || projectResponse.body.project.jiraBoard;
  });

  describe('POST /api/v1/tickets/board/:boardId', () => {
    it('creates a ticket in backlog', async () => {
      const response = await createTicket(app, student.accessToken, boardId);

      expect(response.status).toBe(201);
      expect(response.body.ticket.status).toBe('backlog');
      expect(response.body.ticket.order).toBe(0);
    });

    it('returns 422 when title is missing', async () => {
      const response = await request(app)
        .post(`/api/v1/tickets/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ description: 'Missing title' });

      expect(response.status).toBe(422);
    });

    it('returns 422 when storyPoints is out of range', async () => {
      const response = await request(app)
        .post(`/api/v1/tickets/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({
          title: 'Bad ticket',
          storyPoints: 14,
        });

      expect(response.status).toBe(422);
    });
  });

  describe('GET /api/v1/tickets/board/:boardId', () => {
    it('returns tickets grouped by status', async () => {
      await createTicket(app, student.accessToken, boardId, { title: 'Backlog ticket' });
      await createTicket(app, student.accessToken, boardId, { title: 'Todo ticket', status: 'todo' });

      const response = await request(app)
        .get(`/api/v1/tickets/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tickets.backlog).toHaveLength(1);
      expect(response.body.tickets.todo).toHaveLength(1);
      expect(response.body.tickets.done).toEqual([]);
    });
  });

  describe('PATCH /api/v1/tickets/:id/status', () => {
    beforeEach(async () => {
      const ticketResponse = await createTicket(app, student.accessToken, boardId);
      ticketId = ticketResponse.body.ticket._id;
    });

    it('updates the ticket status', async () => {
      const response = await request(app)
        .patch(`/api/v1/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ status: 'review' });

      expect(response.status).toBe(200);
      expect(response.body.ticket.status).toBe('review');
    });

    it('returns 422 when the status value is invalid', async () => {
      const response = await request(app)
        .patch(`/api/v1/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ status: 'blocked' });

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/v1/tickets/:id/comments', () => {
    beforeEach(async () => {
      const ticketResponse = await createTicket(app, student.accessToken, boardId);
      ticketId = ticketResponse.body.ticket._id;
    });

    it('adds a comment with the author populated', async () => {
      const response = await request(app)
        .post(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ body: 'This is my first comment.' });

      expect(response.status).toBe(201);
      expect(response.body.comment.body).toBe('This is my first comment.');
      expect(response.body.comment.authorId.name).toBe('Board Owner');
    });

    it('returns 422 when comment body is empty', async () => {
      const response = await request(app)
        .post(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ body: '' });

      expect(response.status).toBe(422);
    });
  });

  describe('DELETE /api/v1/tickets/:id/comments/:commentId', () => {
    let commentId;

    beforeEach(async () => {
      const ticketResponse = await createTicket(app, student.accessToken, boardId);
      ticketId = ticketResponse.body.ticket._id;

      const commentResponse = await request(app)
        .post(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ body: 'Owner comment' });

      commentId = commentResponse.body.comment._id;
    });

    it('deletes the user’s own comment', async () => {
      const response = await request(app)
        .delete(`/api/v1/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      expect(response.status).toBe(200);

      const ticket = await Ticket.findById(ticketId);
      expect(ticket.comments).toHaveLength(0);
    });

    it('returns 403 when deleting another user’s comment', async () => {
      const response = await request(app)
        .delete(`/api/v1/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${secondStudent.accessToken}`);

      expect(response.status).toBe(403);
    });
  });
});
