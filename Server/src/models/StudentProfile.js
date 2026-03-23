const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
  },
  projectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  }],
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  leaderboardScore: {
    type: Number,
    default: 0,
  },
  edtechCourses: {
    type: [String],
    default: [],
  },
  hackathonIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },
  skills: {
    type: [String],
    default: [],
  },
  githubUrl: {
    type: String,
    default: null,
  },
  linkedinUrl: {
    type: String,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
