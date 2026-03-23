const mongoose = require('mongoose');
const ENUMS = require('../constants/enums');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ENUMS.TEAM_MEMBER_ROLE,
      default: 'developer',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  invitations: [{
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ENUMS.TEAM_MEMBER_ROLE,
      default: 'developer',
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ENUMS.INVITE_STATUS,
      default: 'pending',
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
