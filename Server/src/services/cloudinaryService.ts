import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'raw',
) =>
  new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (
        error: Error | undefined,
        result: { secure_url: string; public_id: string } | undefined,
      ) => {
        if (error || !result) {
          reject(error ?? new Error('Upload failed'));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    Readable.from(buffer).pipe(stream);
  });

export const deleteFromCloudinary = async (publicId: string, resourceType: 'image' | 'raw') => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
