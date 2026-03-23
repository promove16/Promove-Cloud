const request = require('supertest');

jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const Ticket = require('../models/Ticket');
const Sprint = require('../models/Sprint');
const {
  cleanupDatabase,
  registerAndLogin,
  createProject,
  createTicket,
} = require('./helpers');

describe('Sprint module', () => {
  let student;
  let boardId;
  let ticketIds;

  beforeEach(async () => {
    await cleanupDatabase();
    student = await registerAndLogin(app, { name: 'Sprint Lead', email: 'sprint-lead@example.com' });

    const projectResponse = await createProject(app, student.accessToken, { title: 'Sprint Project' });
    boardId = projectResponse.body.project.jiraBoard._id || projectResponse.body.project.jiraBoard;

    const ticketOne = await createTicket(app, student.accessToken, boardId, { title: 'Ticket One', storyPoints: 3 });
    const ticketTwo = await createTicket(app, student.accessToken, boardId, { title: 'Ticket Two', storyPoints: 5 });
    const ticketThree = await createTicket(app, student.accessToken, boardId, { title: 'Ticket Three', storyPoints: 2 });

    ticketIds = [
      ticketOne.body.ticket._id,
      ticketTwo.body.ticket._id,
      ticketThree.body.ticket._id,
    ];
  });

  describe('POST /api/v1/sprints/board/:boardId', () => {
    it('creates a sprint in planned status', async () => {
      const response = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({
          name: 'Sprint 1',
          goal: 'Ship the first increment',
        });

      expect(response.status).toBe(201);
      expect(response.body.sprint.status).toBe('planned');
    });
  });

  describe('POST /api/v1/sprints/:id/start', () => {
    it('sets the sprint status to active', async () => {
      const createResponse = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 1' });

      const response = await request(app)
        .post(`/api/v1/sprints/${createResponse.body.sprint._id}/start`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sprint.status).toBe('active');
    });

    it('returns 400 when another sprint is already active', async () => {
      const sprintOne = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 1' });
      const sprintTwo = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 2' });

      await request(app)
        .post(`/api/v1/sprints/${sprintOne.body.sprint._id}/start`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprintTwo.body.sprint._id}/start`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/sprints/:id/tickets', () => {
    it('adds a ticket to the sprint', async () => {
      const sprintResponse = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 1' });

      const response = await request(app)
        .post(`/api/v1/sprints/${sprintResponse.body.sprint._id}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[0] });

      expect(response.status).toBe(200);
      expect(response.body.sprint.ticketIds).toContain(ticketIds[0]);
    });

    it('returns 400 when the ticket is already in a sprint', async () => {
      const sprintResponse = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 1' });

      await request(app)
        .post(`/api/v1/sprints/${sprintResponse.body.sprint._id}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[0] });

      const response = await request(app)
        .post(`/api/v1/sprints/${sprintResponse.body.sprint._id}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[0] });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/sprints/:id/complete', () => {
    it('completes the sprint, moves unfinished tickets back to backlog, and returns movedBackCount', async () => {
      const sprintResponse = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 1' });

      const sprintId = sprintResponse.body.sprint._id;

      await request(app)
        .post(`/api/v1/sprints/${sprintId}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[0] });
      await request(app)
        .post(`/api/v1/sprints/${sprintId}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[1] });

      await Ticket.findByIdAndUpdate(ticketIds[1], { status: 'done' });

      await request(app)
        .post(`/api/v1/sprints/${sprintId}/start`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprintId}/complete`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      const backlogTicket = await Ticket.findById(ticketIds[0]);
      const doneTicket = await Ticket.findById(ticketIds[1]);

      expect(response.status).toBe(200);
      expect(response.body.sprint.status).toBe('completed');
      expect(response.body.movedBackCount).toBe(1);
      expect(backlogTicket.status).toBe('backlog');
      expect(backlogTicket.sprintId).toBeNull();
      expect(doneTicket.status).toBe('done');
    });
  });

  describe('GET /api/v1/sprints/:id/burndown', () => {
    it('returns idealLine and actualLine arrays', async () => {
      const sprintResponse = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({
          name: 'Sprint 1',
          startDate: '2026-03-20',
          endDate: '2026-03-25',
        });

      const sprintId = sprintResponse.body.sprint._id;

      await request(app)
        .post(`/api/v1/sprints/${sprintId}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[0] });
      await request(app)
        .post(`/api/v1/sprints/${sprintId}/tickets`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ ticketId: ticketIds[1] });

      await Ticket.findByIdAndUpdate(ticketIds[1], {
        status: 'done',
        updatedAt: new Date('2026-03-22T10:00:00.000Z'),
      });

      const response = await request(app)
        .get(`/api/v1/sprints/${sprintId}/burndown`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.burndown.idealLine)).toBe(true);
      expect(Array.isArray(response.body.burndown.actualLine)).toBe(true);
      expect(response.body.burndown.totalPoints).toBe(8);
    });

    it('returns 400 when the sprint has no startDate or endDate', async () => {
      const sprintResponse = await request(app)
        .post(`/api/v1/sprints/board/${boardId}`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ name: 'Sprint 1' });

      const response = await request(app)
        .get(`/api/v1/sprints/${sprintResponse.body.sprint._id}/burndown`)
        .set('Authorization', `Bearer ${student.accessToken}`);

      expect(response.status).toBe(400);
    });
  });
});
