const mongoose = require('mongoose');

const mentorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  expertise: {
    type: [String],
    required: true,
    default: ['general'],
  },
  activeProjectIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  biddingHistory: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  sdlcBoardIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  hourlyRate: {
    type: Number,
    default: 0,
  },
  availability: {
    type: Boolean,
    default: true,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalRatings: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('MentorProfile', mentorProfileSchema);
