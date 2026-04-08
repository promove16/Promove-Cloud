const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');
const config = require('../../config/env');
const { ApiError } = require('../../utils/ApiError');
const Upload = require('./upload.model');

const allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md'];

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

// Build a tenant-scoped folder path so files are partitioned by institution
// and owner. Falls back to a `_global` segment for users without a tenant
// (e.g. recruiters, investors) so we never write to a literal "null" folder.
const buildUploadFolder = (req) => {
  const owner = req.user && req.user._id ? String(req.user._id) : 'anonymous';
  const tenant = req.user && req.user.institutionId
    ? String(req.user.institutionId)
    : '_global';
  const context = (req.query && req.query.context) || 'project';
  return `promove/${tenant}/${owner}/${context}`;
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, _file) => ({
    folder: buildUploadFolder(req),
    resource_type: 'auto',
    allowed_formats: allowedFormats,
  }),
});

const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).replace('.', '').toLowerCase();

    if (!allowedFormats.includes(extension)) {
      return callback(new ApiError(400, 'UNSUPPORTED_FILE_FORMAT', 'Unsupported file format'));
    }

    return callback(null, true);
  },
}).array('files', 5);

// Persist a tenant-scoped record for an uploaded asset. Called by the
// upload controller after multer has streamed the file to Cloudinary.
async function recordUpload({ file, ownerId, institutionId, context }) {
  return Upload.create({
    publicId: file.filename,
    url: file.path,
    originalName: file.originalname,
    format: file.format || file.mimetype,
    size: file.size,
    ownerId,
    institutionId: institutionId || null,
    context: context || 'project',
  });
}

// Look up an upload record by its Cloudinary public id. Returns null when
// the record does not exist (typically a legacy file uploaded before this
// model was introduced).
async function findUploadByPublicId(publicId) {
  const decodedPublicId = decodeURIComponent(publicId);
  return Upload.findOne({ publicId: decodedPublicId });
}

// Throws ApiError when the given user is not the owner of the upload.
// Resolves with the upload document on success so the caller can reuse it.
async function assertUploadOwner(publicId, userId) {
  const record = await findUploadByPublicId(publicId);

  if (!record) {
    throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
  }

  if (String(record.ownerId) !== String(userId)) {
    throw new ApiError(
      403,
      'UPLOAD_FORBIDDEN',
      'You do not have permission to delete this file',
    );
  }

  return record;
}

async function deleteFile(publicId) {
  const decodedPublicId = decodeURIComponent(publicId);
  const imageResult = await cloudinary.uploader.destroy(decodedPublicId, { resource_type: 'image' });

  if (imageResult.result === 'not found') {
    return cloudinary.uploader.destroy(decodedPublicId, { resource_type: 'raw' });
  }

  return imageResult;
}

// Delete the persisted upload record for a given publicId, if any. Used by
// the controller after a successful Cloudinary deletion. Safe to call even
// when no record exists.
async function deleteUploadRecord(publicId) {
  const decodedPublicId = decodeURIComponent(publicId);
  await Upload.deleteOne({ publicId: decodedPublicId });
}

module.exports = {
  uploadMiddleware,
  recordUpload,
  findUploadByPublicId,
  assertUploadOwner,
  deleteFile,
  deleteUploadRecord,
};
