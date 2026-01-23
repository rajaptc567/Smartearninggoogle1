
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import User from './models/User.js';

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

// Load env vars
dotenv.config();

// Enforce required environment variables
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined.');
    process.exit(1);
}

// Global version for sync
global.appDataVersion = Date.now();

// Connect to database
connectDB();

const app = express();

/**
 * COMPREHENSIVE CORS CONFIGURATION
 * Required for cross-origin HttpOnly cookies (Vercel -> Render)
 */
const allowedOrigins = [
    'http://localhost:3000', 
    'http://localhost:5173',
    'https://smartearning-admin.vercel.app',
    'https://smartearning-member.vercel.app' // Added member domain
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            // Strictly fail if origin is not recognized in production
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true // MUST be true for cookies
}));

// Middlewares
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Seed Admin User
const seedAdminUser = async () => {
    try {
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
                    phone: '0000000000',
                    country: 'Pakistan',
                    currency: 'PKR',
                    status: 'Active',
                    restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: true }
                });
            }
        } 
    } catch (error) {
        console.error('Admin Seeding Error:', error.message);
    }
};

app.get('/', (req, res) => res.send('SmartEarning API is running...'));

// Mount routers
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

// Custom Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error' });
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
