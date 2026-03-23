const mongoose = require('mongoose');
const ENUMS = require('../constants/enums');

const sprintSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  goal: {
    type: String,
    default: '',
  },
  startDate: {
    type: Date,
    default: null,
  },
  endDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ENUMS.SPRINT_STATUS,
    default: 'planned',
  },
  ticketIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
  }],
}, { timestamps: true });

module.exports = mongoose.model('Sprint', sprintSchema);
