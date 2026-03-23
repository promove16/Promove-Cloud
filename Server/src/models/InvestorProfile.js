const mongoose = require('mongoose');

const investorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  firm: {
    type: String,
    default: '',
  },
  investmentAreas: {
    type: [String],
    default: [],
  },
  scheduledMeetingIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  reviewedProjectIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  watchlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  }],
}, { timestamps: true });

module.exports = mongoose.model('InvestorProfile', investorProfileSchema);
