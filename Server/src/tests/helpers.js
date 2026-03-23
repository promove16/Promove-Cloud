const request = require('supertest');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const SchoolProfile = require('../models/SchoolProfile');
const CollegeProfile = require('../models/CollegeProfile');
const InvestorProfile = require('../models/InvestorProfile');
const MentorProfile = require('../models/MentorProfile');
const HrProfile = require('../models/HrProfile');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Board = require('../models/Board');
const Ticket = require('../models/Ticket');
const Sprint = require('../models/Sprint');
const RefreshToken = require('../models/RefreshToken');
const ActionToken = require('../models/ActionToken');

const DEFAULT_PASSWORD = 'StrongPass1!';

async function cleanupDatabase() {
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    SchoolProfile.deleteMany({}),
    CollegeProfile.deleteMany({}),
    InvestorProfile.deleteMany({}),
    MentorProfile.deleteMany({}),
    HrProfile.deleteMany({}),
    Project.deleteMany({}),
    Team.deleteMany({}),
    Board.deleteMany({}),
    Ticket.deleteMany({}),
    Sprint.deleteMany({}),
    RefreshToken.deleteMany({}),
    ActionToken.deleteMany({}),
  ]);
}

async function registerUser(app, {
  name = 'Test User',
  email = `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
  password = DEFAULT_PASSWORD,
  role = 'student',
} = {}) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, role });

  return {
    response,
    name,
    email,
    password,
    role,
  };
}

async function markVerified(email) {
  await User.updateOne({ email }, { isVerified: true });
}

async function loginUser(app, { email, password = DEFAULT_PASSWORD }) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return response;
}

async function registerAndLogin(app, {
  name = 'Test User',
  email,
  password = DEFAULT_PASSWORD,
  role = 'student',
} = {}) {
  const registration = await registerUser(app, { name, email, password, role });
  await markVerified(registration.email);
  const loginResponse = await loginUser(app, {
    email: registration.email,
    password,
  });

  return {
    ...registration,
    loginResponse,
    accessToken: loginResponse.body.accessToken,
    cookie: loginResponse.headers['set-cookie'],
  };
}

async function createProject(app, accessToken, payload = {}) {
  const response = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: 'Project Alpha',
      description: 'Initial project description',
      tags: ['node', 'react'],
      techStack: ['Express', 'MongoDB'],
      ...payload,
    });

  return response;
}

async function createTicket(app, accessToken, boardId, payload = {}) {
  const response = await request(app)
    .post(`/api/v1/tickets/board/${boardId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: 'Implement feature',
      description: 'Feature details',
      priority: 'P2',
      ...payload,
    });

  return response;
}

module.exports = {
  DEFAULT_PASSWORD,
  cleanupDatabase,
  registerUser,
  markVerified,
  loginUser,
  registerAndLogin,
  createProject,
  createTicket,
};
