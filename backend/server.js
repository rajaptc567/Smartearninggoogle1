
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB, { bucket } from './config/db.js';
import User from './models/User.js';
import { secureHeaders, apiLimiter, csrfCheck } from './middleware/securityMiddleware.js';

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

dotenv.config();

// CRITICAL SECURITY CHECK: Enforce JWT_SECRET in production
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
}

global.appDataVersion = Date.now();

connectDB();

const app = express();

// Render/Proxy Support
app.set('trust proxy', true);

// SECURITY HARDENING - Restricted CORS
const allowedOrigins = [
    process.env.FRONTEND_URL, 
    'http://localhost:3000',
    'http://localhost:5173'
].filter(Boolean);

app.use(secureHeaders);
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use('/api', apiLimiter);
app.use(csrfCheck);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// GridFS File Serving Route (Persistent Storage)
app.get('/uploads/:filename', async (req, res) => {
    try {
        const files = await bucket.find({ filename: req.params.filename }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.set('Content-Type', files[0].contentType);
        const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
        downloadStream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: 'Error retrieving file' });
    }
});

// SECURE ADMIN SEEDING
const seedAdminUser = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'studio56.pk@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD; 
        
        if (!adminPassword) {
            console.warn('ADMIN_PASSWORD not set in environment. Seeding skipped.');
            return;
        }

        const existingUser = await User.findOne({ email: adminEmail });
        if (!existingUser) {
            const anyAdmin = await User.findOne({ username: 'admin' });
            if (!anyAdmin) {
                await User.create({
                    username: 'admin',
                    fullName: 'System Admin',
                    email: adminEmail,
                    password: adminPassword,
                    phone: '0000000000',
                    country: 'Pakistan',
                    currency: 'PKR',
                    status: 'Active',
                    restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: true }
                });
                console.log('Admin user seeded securely.');
            }
        } 
    } catch (error) {
        console.error('Admin Seeding Error:', error.message);
    }
};

app.get('/', (req, res) => {
    res.send('SmartEarning API is running securely...');
});

app.use('/api/v1/users', userRoutes);
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

app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    await seedAdminUser();
});

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});
