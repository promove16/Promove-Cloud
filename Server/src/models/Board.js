const mongoose = require('mongoose');

const defaultColumns = [
  { id: 'backlog', title: 'Backlog', order: 0 },
  { id: 'todo', title: 'To Do', order: 1 },
  { id: 'in_progress', title: 'In Progress', order: 2 },
  { id: 'review', title: 'Review', order: 3 },
  { id: 'done', title: 'Done', order: 4 },
];

const boardSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    default: 'Project Board',
  },
  columns: [{
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  }],
}, { timestamps: true });

boardSchema.pre('save', function populateDefaultColumns(next) {
  if (this.isNew && (!this.columns || this.columns.length === 0)) {
    this.columns = defaultColumns;
  }

  next();
});

module.exports = mongoose.model('Board', boardSchema);
