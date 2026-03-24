"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromCloudinary = exports.uploadToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const stream_1 = require("stream");
const env_1 = require("../config/env");
cloudinary_1.v2.config({
    cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
    api_key: env_1.env.CLOUDINARY_API_KEY,
    api_secret: env_1.env.CLOUDINARY_API_SECRET,
});
const uploadToCloudinary = async (buffer, folder, resourceType) => new Promise((resolve, reject) => {
    const stream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
        if (error || !result) {
            reject(error ?? new Error('Upload failed'));
            return;
        }
        resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
        });
    });
    stream_1.Readable.from(buffer).pipe(stream);
});
exports.uploadToCloudinary = uploadToCloudinary;
const deleteFromCloudinary = async (publicId, resourceType) => {
    await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
};
exports.deleteFromCloudinary = deleteFromCloudinary;
