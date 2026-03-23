const request = require('supertest');

jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const User = require('../models/User');
const Project = require('../models/Project');
const Board = require('../models/Board');
const {
  cleanupDatabase,
  registerAndLogin,
  createProject,
} = require('./helpers');

describe('Project module', () => {
  let owner;
  let otherStudent;

  beforeEach(async () => {
    await cleanupDatabase();
    owner = await registerAndLogin(app, { name: 'Owner User' });
    otherStudent = await registerAndLogin(app, {
      name: 'Other User',
      email: 'other-student@example.com',
    });
  });

  describe('POST /api/v1/projects', () => {
    it('creates a project and auto-creates a board', async () => {
      const response = await createProject(app, owner.accessToken);

      expect(response.status).toBe(201);
      expect(response.body.project.title).toBe('Project Alpha');
      expect(response.body.project.jiraBoard).toBeTruthy();

      const board = await Board.findOne({ projectId: response.body.project._id });
      expect(board).toBeTruthy();
      expect(board.columns).toHaveLength(5);
    });

    it('returns 422 when title is missing', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          description: 'Missing title',
        });

      expect(response.status).toBe(422);
    });

    it('returns 422 when title is too short', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          title: 'Hi',
        });

      expect(response.status).toBe(422);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ title: 'Unauthed Project' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/projects/my', () => {
    it('returns an empty array initially', async () => {
      const response = await request(app)
        .get('/api/v1/projects/my')
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('returns created projects after creation', async () => {
      await createProject(app, owner.accessToken, { title: 'Created Project' });

      const response = await request(app)
        .get('/api/v1/projects/my')
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Created Project');
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('returns the project for the owner', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .get(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.project._id).toBe(createResponse.body.project._id);
    });

    it('returns 403 for a different student when the project is private', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .get(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${otherStudent.accessToken}`);

      expect(response.status).toBe(403);
    });

    it('returns 200 for a different user when the project is public', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      await request(app)
        .put(`/api/v1/projects/${createResponse.body.project._id}/visibility`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ isPublic: true });

      const response = await request(app)
        .get(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${otherStudent.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.project.isPublic).toBe(true);
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('updates allowed fields', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .put(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          title: 'Updated Project',
          description: 'Updated description',
          tags: ['updated'],
          status: 'active',
        });

      expect(response.status).toBe(200);
      expect(response.body.project.title).toBe('Updated Project');
      expect(response.body.project.status).toBe('active');
      expect(response.body.project.tags).toEqual(['updated']);
    });

    it('returns 403 when a non-owner tries to update', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .put(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${otherStudent.accessToken}`)
        .send({ title: 'Hacked' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('deletes a project in planning status', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .delete(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(response.status).toBe(200);
      expect(await Project.findById(createResponse.body.project._id)).toBeNull();
    });

    it('returns 400 when project status is not planning', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      await Project.findByIdAndUpdate(createResponse.body.project._id, { status: 'active' });

      const response = await request(app)
        .delete(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(response.status).toBe(400);
    });

    it('returns 403 when a non-owner tries to delete', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .delete(`/api/v1/projects/${createResponse.body.project._id}`)
        .set('Authorization', `Bearer ${otherStudent.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v1/projects/:id/marketplace', () => {
    it('returns 400 when the project is not completed', async () => {
      const createResponse = await createProject(app, owner.accessToken);

      const response = await request(app)
        .put(`/api/v1/projects/${createResponse.body.project._id}/marketplace`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          price: 1000,
          description: 'Marketplace listing',
          status: 'listed',
        });

      expect(response.status).toBe(400);
    });

    it('updates the listing when the project is completed', async () => {
      const createResponse = await createProject(app, owner.accessToken);
      await Project.findByIdAndUpdate(createResponse.body.project._id, { status: 'completed' });

      const response = await request(app)
        .put(`/api/v1/projects/${createResponse.body.project._id}/marketplace`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          price: 2500,
          description: 'Ready for sale',
          status: 'listed',
        });

      expect(response.status).toBe(200);
      expect(response.body.project.marketplaceListing.price).toBe(2500);
      expect(response.body.project.marketplaceListing.status).toBe('listed');
    });
  });
});
