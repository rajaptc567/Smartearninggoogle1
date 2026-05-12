import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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

// Load env vars
dotenv.config();

const app = express();

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

app.get('/', (req, res) => {
    res.send('SmartEarning API is operational.');
});

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
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

/**
 * ASYNC STARTUP
 */
const startServer = async () => {
    try {
        await connectDB();
        await seedAdminUser();
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('SERVER FATAL ERROR:', error.message);
        process.exit(1);
    }
};

startServer();