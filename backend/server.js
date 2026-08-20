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

// Import password reset actions directly for backward compatibility
import {
    userRequestPasswordReset,
    verifyAndStartResetTimer,
    resetPasswordWithToken
} from './controllers/usersController.js'; 

// Load env vars
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with robust CORS and transports for Render/Vercel environments
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Secure and flexible for dynamic Vercel deployments
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: true
    },
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
app.use(cors());

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

// Custom Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Environment-aware Port Strategy
// In production (Render, etc.), use platform-assigned process.env.PORT.
// In development, use BACKEND_PORT (defaulting to 5000) so it never conflicts with Vite on port 3000.
const isProduction = process.env.NODE_ENV === 'production' && !process.env.APPLET_ID;
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
    } catch (error) {
        console.warn('Database initialization warning:', error.message);
    } finally {
        httpServer.listen(PORT, () => {
            console.log(`SmartExn Backend server running on port ${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
        });
    }
};

startServer();