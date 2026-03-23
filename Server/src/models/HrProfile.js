const mongoose = require('mongoose');
const ENUMS = require('../constants/enums');

const hrProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  company: {
    type: String,
    required: true,
    default: 'Pending Company',
  },
  designation: {
    type: String,
    default: '',
  },
  hiringMode: {
    type: String,
    enum: ENUMS.HIRING_MODE,
    default: 'both',
  },
  scheduledInterviewIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  visitedCollegeIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  linkedinUrl: {
    type: String,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('HrProfile', hrProfileSchema);
