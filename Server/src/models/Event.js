const mongoose = require('mongoose');
const ROLES = require('../constants/roles');
const ENUMS = require('../constants/enums');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  organiserRole: {
    type: String,
    enum: Object.values(ROLES),
    required: true,
  },
  organiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ENUMS.EVENT_TYPE,
    required: true,
  },
  capacity: {
    type: Number,
    default: null,
  },
  registrationDeadline: {
    type: Date,
    default: null,
  },
  prerequisites: {
    type: [String],
    default: [],
  },
  certificateTemplate: {
    type: String,
    default: null,
  },
  registrations: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    attended: {
      type: Boolean,
      default: false,
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
