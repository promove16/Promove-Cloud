const mongoose = require('mongoose');

const schoolProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  registrationNumber: {
    type: String,
    required: true,
    default: 'PENDING_REGISTRATION',
  },
  district: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  address: {
    type: String,
    default: '',
  },
  verifiedStudentIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  organisedEventIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  mentorIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
}, { timestamps: true });

module.exports = mongoose.model('SchoolProfile', schoolProfileSchema);
