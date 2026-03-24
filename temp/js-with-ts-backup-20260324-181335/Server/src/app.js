const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const config = require('./config/env');
const { version } = require('../package.json');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const ApiError = require('./utils/ApiError');
const authRoutes = require('./modules/auth/auth.routes');
const projectRoutes = require('./modules/project/project.routes');
const teamRoutes = require('./modules/team/team.routes');
const boardRoutes = require('./modules/board/board.routes');
const ticketRoutes = require('./modules/ticket/ticket.routes');
const sprintRoutes = require('./modules/sprint/sprint.routes');
const uploadRoutes = require('./modules/upload/upload.routes');
const studentRoutes = require('./modules/student/student.routes');

require('./models/User');
require('./models/StudentProfile');
require('./models/SchoolProfile');
require('./models/CollegeProfile');
require('./models/InvestorProfile');
require('./models/MentorProfile');
require('./models/HrProfile');
require('./models/Project');
require('./models/Team');
require('./models/Board');
require('./models/Ticket');
require('./models/Sprint');
require('./models/Event');
require('./models/Notification');
require('./models/RefreshToken');
require('./models/ActionToken');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/api/', apiLimiter);
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/boards', boardRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/sprints', sprintRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/students', studentRoutes);

if (config.NODE_ENV === 'test') {
  app.use('/api/v1/test', require('./tests/testRoutes'));
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    version,
  });
});

app.use((req, res, next) => {
  next(ApiError.notFound('Route'));
});

app.use((err, req, res, next) => {
  if (err instanceof ApiError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: Object.values(err.errors).map((validationError) => ({
        field: validationError.path,
        message: validationError.message,
      })),
    });
  }

  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      code: 'CONFLICT',
      message: `${field} already exists`,
    });
  }

  if (config.NODE_ENV !== 'production') {
    console.error(err);
  }

  return res.status(500).json({
    success: false,
    code: 'INTERNAL',
    message: 'Internal server error',
  });
});

module.exports = app;
