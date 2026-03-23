const request = require('supertest');

jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const emailService = require('../utils/emailService');
const Team = require('../models/Team');
const {
  cleanupDatabase,
  registerAndLogin,
  createProject,
} = require('./helpers');

describe('Team module', () => {
  let lead;
  let invitee;
  let outsider;

  beforeEach(async () => {
    emailService.sendTeamInvitationEmail.mockClear();
    await cleanupDatabase();
    lead = await registerAndLogin(app, { name: 'Lead User', email: 'lead@example.com' });
    invitee = await registerAndLogin(app, { name: 'Invitee User', email: 'invitee@example.com' });
    outsider = await registerAndLogin(app, { name: 'Outsider User', email: 'outsider@example.com' });
  });

  describe('POST /api/v1/teams', () => {
    it('creates a team with the lead as the first member', async () => {
      const response = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ name: 'Alpha Team' });

      expect(response.status).toBe(201);
      expect(response.body.team.members).toHaveLength(1);
      expect(String(response.body.team.members[0].userId)).toBe(String(lead.loginResponse.body.user.id));
      expect(response.body.team.members[0].role).toBe('lead');
    });

    it('returns 422 when name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({});

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/v1/teams/:id/invite', () => {
    it('sends an invitation and stores it on the team', async () => {
      const createResponse = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ name: 'Alpha Team' });

      const response = await request(app)
        .post(`/api/v1/teams/${createResponse.body.team._id}/invite`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({
          email: 'invitee@example.com',
          role: 'developer',
        });

      const team = await Team.findById(createResponse.body.team._id);

      expect(response.status).toBe(200);
      expect(team.invitations).toHaveLength(1);
      expect(team.invitations[0].email).toBe('invitee@example.com');
      expect(team.invitations[0].status).toBe('pending');
      expect(emailService.sendTeamInvitationEmail).toHaveBeenCalled();
    });

    it('returns 403 when a non-lead tries to invite', async () => {
      const projectResponse = await createProject(app, lead.accessToken, { title: 'Project Team' });
      const teamResponse = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({
          name: 'Alpha Team',
          projectId: projectResponse.body.project._id,
        });

      const response = await request(app)
        .post(`/api/v1/teams/${teamResponse.body.team._id}/invite`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({
          email: 'invitee@example.com',
          role: 'developer',
        });

      expect(response.status).toBe(403);
    });

    it('returns 400 when the email already has a pending invite', async () => {
      const createResponse = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ name: 'Alpha Team' });

      await request(app)
        .post(`/api/v1/teams/${createResponse.body.team._id}/invite`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({
          email: 'invitee@example.com',
          role: 'developer',
        });

      const response = await request(app)
        .post(`/api/v1/teams/${createResponse.body.team._id}/invite`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({
          email: 'invitee@example.com',
          role: 'developer',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/teams/invite/:token', () => {
    async function createInvite() {
      const createResponse = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ name: 'Alpha Team' });

      await request(app)
        .post(`/api/v1/teams/${createResponse.body.team._id}/invite`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({
          email: 'invitee@example.com',
          role: 'developer',
        });

      const team = await Team.findById(createResponse.body.team._id);
      return {
        teamId: team._id,
        token: team.invitations[0].token,
      };
    }

    it('adds the invitee to team members', async () => {
      const invite = await createInvite();

      const response = await request(app)
        .get(`/api/v1/teams/invite/${invite.token}`);

      const team = await Team.findById(invite.teamId);

      expect(response.status).toBe(200);
      expect(team.members).toHaveLength(2);
      expect(team.invitations[0].status).toBe('accepted');
    });

    it('returns 400 for an invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/teams/invite/not-a-real-token');

      expect(response.status).toBe(400);
    });

    it('returns 400 for an already-used token', async () => {
      const invite = await createInvite();

      await request(app).get(`/api/v1/teams/invite/${invite.token}`);
      const response = await request(app).get(`/api/v1/teams/invite/${invite.token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/teams/:id/members/:uid', () => {
    async function createTeamWithAcceptedInvite() {
      const createResponse = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ name: 'Alpha Team' });

      await request(app)
        .post(`/api/v1/teams/${createResponse.body.team._id}/invite`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({
          email: 'invitee@example.com',
          role: 'developer',
        });

      const createdTeam = await Team.findById(createResponse.body.team._id);
      await request(app).get(`/api/v1/teams/invite/${createdTeam.invitations[0].token}`);

      return Team.findById(createResponse.body.team._id);
    }

    it('updates a member role', async () => {
      const team = await createTeamWithAcceptedInvite();
      const memberId = team.members.find((member) => String(member.userId) !== String(team.leadId)).userId;

      const response = await request(app)
        .put(`/api/v1/teams/${team._id}/members/${memberId}`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ role: 'designer' });

      expect(response.status).toBe(200);
      expect(response.body.team.members.find((member) => String(member.userId) === String(memberId)).role).toBe('designer');
    });

    it('returns 403 when a non-lead tries to update a role', async () => {
      const team = await createTeamWithAcceptedInvite();
      const memberId = team.members.find((member) => String(member.userId) !== String(team.leadId)).userId;

      const response = await request(app)
        .put(`/api/v1/teams/${team._id}/members/${memberId}`)
        .set('Authorization', `Bearer ${invitee.accessToken}`)
        .send({ role: 'designer' });

      expect(response.status).toBe(403);
    });

    it('returns 400 when trying to change the lead role', async () => {
      const createResponse = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ name: 'Alpha Team' });

      const response = await request(app)
        .put(`/api/v1/teams/${createResponse.body.team._id}/members/${lead.loginResponse.body.user.id}`)
        .set('Authorization', `Bearer ${lead.accessToken}`)
        .send({ role: 'developer' });

      expect(response.status).toBe(400);
    });
  });
});
