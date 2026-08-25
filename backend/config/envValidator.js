/**
 * ENVIRONMENT & STARTUP CONFIGURATION VALIDATOR
 * Verifies critical environment variables, sanitizes connection logs,
 * and enforces production security policies without breaking development.
 */

export const sanitizeMongoUri = (uri) => {
    if (!uri || typeof uri !== 'string') return '';
    try {
        // Mask username:password in standard mongodb:// or mongodb+srv:// URIs
        return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/i, '$1****:****@');
    } catch {
        return '[PROTECTED_URI]';
    }
};

export const validateEnvironment = () => {
    const isProduction = process.env.NODE_ENV === 'production' && !process.env.APPLET_ID;
    const errors = [];
    const warnings = [];

    // 1. Validate MONGO_URI
    if (!process.env.MONGO_URI) {
        if (isProduction) {
            errors.push('MONGO_URI is required in production.');
        } else {
            warnings.push('MONGO_URI is not set. Database connections will fail.');
        }
    }

    // 2. Validate JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
        if (isProduction) {
            errors.push('JWT_SECRET is required and must not be empty in production.');
        } else {
            // Provide a predictable, safe development fallback
            process.env.JWT_SECRET = 'smartexn_dev_jwt_secret_key_2026_local_fallback';
            warnings.push('JWT_SECRET not set. Using local development fallback secret.');
        }
    } else if (isProduction && jwtSecret.length < 16) {
        errors.push('JWT_SECRET must be at least 16 characters long in production.');
    }

    // 3. Upload Durability Audit (Production only)
    if (isProduction) {
        const hasCloudStorage = Boolean(
            process.env.CLOUDINARY_URL ||
            process.env.AWS_S3_BUCKET ||
            process.env.GCS_BUCKET ||
            process.env.PERSISTENT_STORAGE_PATH
        );

        if (!hasCloudStorage) {
            console.warn(
                '\x1b[33m[STORAGE NOTICE]\x1b[0m Ephemeral local disk (/uploads) in use in production. ' +
                'For permanent asset durability across container redeployments, configure external cloud storage (e.g. S3 / Cloudinary).'
            );
        }
    }

    // Print Warnings
    if (warnings.length > 0) {
        warnings.forEach(w => console.warn(`\x1b[33m[CONFIG WARNING]\x1b[0m ${w}`));
    }

    // If critical production errors exist, fail fast
    if (errors.length > 0) {
        console.error('\x1b[31m====================================================\x1b[0m');
        console.error('\x1b[31m[FATAL CONFIGURATION ERROR] Cannot start in production:\x1b[0m');
        errors.forEach(e => console.error(` - ${e}`));
        console.error('\x1b[31m====================================================\x1b[0m');
        throw new Error(`Production environment validation failed: ${errors.join('; ')}`);
    }

    return {
        isValid: true,
        isProduction,
        port: process.env.PORT || process.env.BACKEND_PORT || 5000
    };
};

export default validateEnvironment;
