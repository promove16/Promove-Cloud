const mongoose = require('mongoose');
const ENUMS = require('../constants/enums');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    default: '',
  },
  slug: {
    type: String,
    trim: true,
    default: null,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
  },
  leadStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  investorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ENUMS.PROJECT_STATUS,
    default: 'planning',
  },
  files: {
    type: [String],
    default: [],
  },
  jiraBoard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    default: null,
  },
  tags: {
    type: [String],
    default: [],
  },
  techStack: {
    type: [String],
    default: [],
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  marketplaceListing: {
    price: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ENUMS.MARKETPLACE_STATUS,
      default: 'not_listed',
    },
    description: {
      type: String,
      default: '',
    },
  },
  pitchRequests: [{
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      default: 'pending',
    },
    feedback: {
      type: String,
      default: '',
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
