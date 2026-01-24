
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Removed process.exit(1) to prevent global API outage if environment variables are missing.
// The server should still function for non-image related routes.
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('WARNING: Cloudinary credentials are missing in .env. Image uploads will fail.');
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'placeholder',
    api_key: process.env.CLOUDINARY_API_KEY || 'placeholder',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'placeholder',
    secure: true
});

export default cloudinary;
