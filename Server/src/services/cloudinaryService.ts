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
  resourceType: 'image' | 'raw' | 'auto',
  options?: {
    format?: string;
  },
) => {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        timeout: 60000,
        ...(options?.format ? { format: options.format } : {}),
      },
      (error, result) => {
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

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

export const generateSignedCloudinaryUrl = (publicId: string, resourceType: 'image' | 'raw' = 'image'): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      public_id: publicId,
      timestamp,
    },
    env.CLOUDINARY_API_SECRET!,
  );

  const resourcePrefix = resourceType === 'raw' ? 'raw' : 'image';
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourcePrefix}/upload/v${timestamp}/${publicId}?api_key=${env.CLOUDINARY_API_KEY}&signature=${signature}&timestamp=${timestamp}`;
};

export const deleteFromCloudinary = async (publicId: string, resourceType: 'image' | 'raw') => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
