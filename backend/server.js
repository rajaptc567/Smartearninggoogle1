import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import validateEnvironment from './config/envValidator.js';
import User from './models/User.js'; 

// Middleware
import { authMiddleware } from './middleware/authMiddleware.js';
import { globalLimiter } from './middleware/rateLimiter.js';

// Route files
import userRoutes from './routes/userRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import paymentMethodRoutes from './routes/paymentMethodRoutes.js';
import investmentPlanRoutes from './routes/investmentPlanRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import logRoutes from './routes/logRoutes.js';
import passwordResetRequestRoutes from './routes/passwordResetRequestRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import taskRoutes from './routes/taskRoutes.js'; 
import templateRoutes from './routes/templateRoutes.js';
import userTaskRoutes from './routes/userTaskRoutes.js';
import bulkPopupRoutes from './routes/bulkPopupRoutes.js';
import postbackRoutes from './routes/postbackRoutes.js';
import { seedVerifiedNetworks } from './controllers/postbackController.js';

// Import password reset actions directly for backward compatibility
import {
    userRequestPasswordReset,
    verifyAndStartResetTimer,
    resetPasswordWithToken
} from './controllers/usersController.js'; 

// Load env vars
dotenv.config();

// Validate Environment & Enforce Production Security Policies
try {
    validateEnvironment();
} catch (envError) {
    if (process.env.NODE_ENV === 'production' && !process.env.APPLET_ID) {
        console.error('Fatal initialization error:', envError.message);
        process.exit(1);
    }
}

const app = express();
const httpServer = createServer(app);

// Dynamic CORS configuration supporting environment-configured origins, production domains, and local dev
const isProduction = process.env.NODE_ENV === 'production' && !process.env.APPLET_ID;

const defaultOrigins = [
    'https://smartexn.com',
    'https://www.smartexn.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
];

const rawOrigins = [
    ...defaultOrigins,
    ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];
const allowedOriginsList = Array.from(
    new Set(rawOrigins.map(o => o.trim().replace(/\/+$/, '')).filter(Boolean))
);

const isOriginPermitted = (origin) => {
    if (!origin) return true;
    const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();
    
    // Check exact whitelist match
    if (allowedOriginsList.some(o => o.toLowerCase() === normalized)) {
        return true;
    }
    
    // Check known domain matches (e.g. smartexn.com, www.smartexn.com, subdomains, google dev domains)
    try {
        const parsed = new URL(normalized);
        const hostname = parsed.hostname.toLowerCase();
        
        if (
            hostname === 'smartexn.com' ||
            hostname.endsWith('.smartexn.com') ||
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.endsWith('.run.app') ||
            hostname.endsWith('.googleusercontent.com') ||
            hostname.endsWith('.aistudio.google.com')
        ) {
            return true;
        }
    } catch {
        // Fall through
    }
    
    return false;
};

const corsOptions = {
    origin: (origin, callback) => {
        // 1. Allow requests with no origin (e.g. mobile apps, curl, server-to-server, health checks)
        if (!origin) {
            return callback(null, true);
        }

        if (isOriginPermitted(origin)) {
            return callback(null, true);
        }

        // 2. In non-production environments (development / AI Studio preview), allow dev origins
        if (!isProduction) {
            return callback(null, true);
        }

        // 3. In production when an unknown origin is detected
        const corsError = new Error(`CORS blocked: Origin ${origin} not permitted by policy`);
        corsError.status = 403;
        return callback(corsError, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
};

// Initialize Socket.io with matching robust CORS
const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'] // WebSocket native with polling fallback for stability
});

// Expose Socket.io instance on Express app
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`Socket connection established: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`Socket connection closed: ${socket.id}`);
    });
});

/**
 * INFRASTRUCTURE SETTINGS
 * Enable trust proxy to allow express-rate-limit to see real user IPs
 * behind the Render/Cloudflare load balancers.
 */
app.set('trust proxy', 1);

// Apply Global Rate Limiting
app.use('/api', globalLimiter);

// Enable CORS
app.use(cors(corsOptions));

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Passive Authentication Layer
app.use(authMiddleware);

// Handle ES Modules path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set static folder for uploads
app.use('/uploads', express.static(uploadsDir));

// Seed Admin User Function
const seedAdminUser = async () => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            console.log('MongoDB is not connected; skipping admin user seeding.');
            return;
        }

        const adminEmail = 'studio56.pk@gmail.com';
        const adminPassword = 'raja5207901@'; 
        
        const existingUser = await User.findOne({ email: adminEmail });
        
        if (!existingUser) {
            const anyAdmin = await User.findOne({ username: 'admin' });
            if (!anyAdmin) {
                await User.create({
                    username: 'admin',
                    fullName: 'System Admin',
                    email: adminEmail,
                    password: adminPassword,
                    role: 'super_admin',
                    phone: '0000000000',
                    country: 'Pakistan',
                    status: 'Active',
                    restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: true }
                });
                console.log('Admin account seeded successfully.');
            }
        } 
    } catch (error) {
        console.error('Admin Seeding Error:', error.message);
    }
};

// Mount routers
app.use('/api/v1/users', userRoutes);

// Direct password reset routes for backward-compatibility with older frontends
app.post('/api/v1/request-password-reset', globalLimiter, userRequestPasswordReset);
app.post('/api/v1/verify-reset-token/:token', globalLimiter, verifyAndStartResetTimer);
app.put('/api/v1/reset-password/:token', globalLimiter, resetPasswordWithToken);

app.use('/api/v1/deposits', depositRoutes);
app.use('/api/v1/withdrawals', withdrawalRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payment-methods', paymentMethodRoutes);
app.use('/api/v1/investment-plans', investmentPlanRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/rules', ruleRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/logs', logRoutes);
app.use('/api/v1/password-reset-requests', passwordResetRequestRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/tasks', taskRoutes); 
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/user-tasks', userTaskRoutes);
app.use('/api/v1/bulk-popups', bulkPopupRoutes);
app.use('/api/v1/postbacks', postbackRoutes);

// Explicit 404 handler for unmatched API routes (Named wildcard compatible with Express 5 / path-to-regexp)
app.all('/api/*path', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
});
app.all('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Serve static assets from public (sitemap.xml, robots.txt, icons)
const publicPath = path.resolve(__dirname, '../public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Serve production static assets from dist
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// Production SPA Fallback: Serves index.html for all valid frontend paths (Googlebot / direct URL access)
app.get('*path', (req, res, next) => {
    // 1. Never catch API or uploads routes in SPA fallback
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
    }

    // 2. Missing static asset files with extensions should return a proper 404
    const ext = path.extname(req.path);
    if (ext) {
        return res.status(404).send('Resource not found');
    }

    // 3. Serve production compiled index.html
    const indexPath = path.resolve(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }

    // 4. Fallback for local development environments
    const devIndexPath = path.resolve(__dirname, '../index.html');
    if (fs.existsSync(devIndexPath)) {
        return res.sendFile(devIndexPath);
    }

    res.status(200).send('SmartExn is operational. Run build to compile the web frontend.');
});

// Custom Production-Safe Error Handler
app.use((err, req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production' && !process.env.APPLET_ID;
    if (isProd) {
        console.error(`[Server Error] ${err.name || 'Error'}: ${err.message}`);
    } else {
        console.error(err.stack);
    }
    
    const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
    const clientMessage = (isProd && status === 500)
        ? 'An unexpected internal error occurred. Please try again later.'
        : (err.message || 'Internal Server Error');

    res.status(status).json({ success: false, error: clientMessage });
});

// Environment-aware Port Strategy
// In production (Render, etc.), use platform-assigned process.env.PORT.
// In development, use BACKEND_PORT (defaulting to 5000) so it never conflicts with Vite on port 3000.
const PORT = isProduction 
    ? Number(process.env.PORT || 5000) 
    : Number(process.env.BACKEND_PORT || 5000);

// Gracefully handle EADDRINUSE if another development process is already running on the port
httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already bound. Backend server is actively listening on ${PORT}.`);
    } else {
        console.error('HTTP server error:', err);
    }
});

/**
 * ASYNC STARTUP
 */
const startServer = async () => {
    try {
        await connectDB();
        await seedAdminUser();
        await seedVerifiedNetworks();
    } catch (error) {
        console.warn('Database initialization warning:', error.message);
    } finally {
        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log(`SmartExn Backend server running on port ${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
        });
    }
};

startServer();