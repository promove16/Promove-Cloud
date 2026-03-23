const { deleteFile: deleteCloudinaryFile } = require('./upload.service');

async function uploadFiles(req, res) {
  const files = (req.files || []).map((file) => ({
    url: file.path,
    publicId: file.filename,
    originalName: file.originalname,
    format: file.format || file.mimetype,
    size: file.size,
    uploadedBy: req.user.userId,
  }));

  res.json({ success: true, files });
}

async function deleteFile(req, res) {
  await deleteCloudinaryFile(req.params.publicId);
  res.json({ success: true, message: 'File deleted' });
}

module.exports = {
  uploadFiles,
  deleteFile,
};
