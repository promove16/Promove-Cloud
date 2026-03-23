const mongoose = require('mongoose');
const ENUMS = require('../constants/enums');

const ticketSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
    index: true,
  },
  sprintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null,
  },
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
  status: {
    type: String,
    enum: ENUMS.TICKET_STATUS,
    default: 'backlog',
  },
  priority: {
    type: String,
    enum: ENUMS.TICKET_PRIORITY,
    default: 'P2',
  },
  assigneeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  labels: {
    type: [String],
    default: [],
  },
  storyPoints: {
    type: Number,
    min: 1,
    max: 13,
    default: null,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  attachments: {
    type: [String],
    default: [],
  },
  order: {
    type: Number,
    default: 0,
  },
  comments: [{
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
