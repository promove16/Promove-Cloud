const mongoose = require('mongoose');

const collegeProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  universityAffiliation: {
    type: String,
    default: '',
  },
  accreditation: {
    type: String,
    default: '',
  },
  departments: {
    type: [String],
    default: [],
  },
  hackathonIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  investorIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  hrIds: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
  address: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('CollegeProfile', collegeProfileSchema);
