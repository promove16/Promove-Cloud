const {
  deleteFile: deleteCloudinaryFile,
  deleteUploadRecord,
  assertUploadOwner,
  recordUpload,
} = require('./upload.service');

async function uploadFiles(req, res) {
  const ownerId = req.user._id;
  const institutionId = req.user.institutionId || null;
  const context = (req.query && req.query.context) || 'project';

  // Persist a tenant-scoped record for every uploaded asset so that future
  // delete requests can verify ownership and we have an audit trail of which
  // user uploaded which file.
  const stored = await Promise.all(
    (req.files || []).map((file) =>
      recordUpload({ file, ownerId, institutionId, context }).then((record) => ({
        url: file.path,
        publicId: file.filename,
        originalName: file.originalname,
        format: file.format || file.mimetype,
        size: file.size,
        uploadedBy: String(ownerId),
        uploadId: String(record._id),
      })),
    ),
  );

  res.json({ success: true, files: stored });
}

async function deleteFile(req, res) {
  // Verify the authenticated user owns this upload before destroying it.
  // This is the fix for the previous IDOR where any authenticated user
  // could delete any file by guessing the Cloudinary publicId.
  await assertUploadOwner(req.params.publicId, req.user._id);
  await deleteCloudinaryFile(req.params.publicId);
  await deleteUploadRecord(req.params.publicId);

  res.json({ success: true, message: 'File deleted' });
}

module.exports = {
  uploadFiles,
  deleteFile,
};
