const mongoose = require('mongoose');

// Tenant-scoped record of every file uploaded through the /api/upload
// endpoint. The publicId is the Cloudinary asset id and is the source of
// truth for ownership checks on subsequent delete requests.
const uploadSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      default: null,
    },
    format: {
      type: String,
      default: null,
    },
    size: {
      type: Number,
      default: 0,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    context: {
      type: String,
      default: 'project',
      trim: true,
      maxlength: 64,
    },
  },
  { timestamps: true },
);

uploadSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('Upload', uploadSchema);
