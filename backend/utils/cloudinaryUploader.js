
import cloudinary from '../config/cloudinary.js';

/**
 * Uploads a buffer to Cloudinary using a stream
 * @param {Buffer} fileBuffer - The file buffer from req.file
 * @param {String} folder - Cloudinary folder name (e.g., 'deposits')
 */
export const uploadStream = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const upload_stream = cloudinary.uploader.upload_stream(
            { 
                folder: `smartearning/${folder}`,
                resource_type: 'auto', // Automatically detects image type
                allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        upload_stream.end(fileBuffer);
    });
};
