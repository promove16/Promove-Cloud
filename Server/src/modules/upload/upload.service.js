const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md'];

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: `promove/${req.user.userId}/${req.query.context || 'project'}`,
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
      return callback(ApiError.badRequest('Unsupported file format'));
    }

    return callback(null, true);
  },
}).array('files', 5);

async function deleteFile(publicId) {
  const decodedPublicId = decodeURIComponent(publicId);
  const imageResult = await cloudinary.uploader.destroy(decodedPublicId, { resource_type: 'image' });

  if (imageResult.result === 'not found') {
    return cloudinary.uploader.destroy(decodedPublicId, { resource_type: 'raw' });
  }

  return imageResult;
}

module.exports = {
  uploadMiddleware,
  deleteFile,
};
