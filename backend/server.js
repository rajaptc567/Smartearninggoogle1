
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import connectDB from './config/db.js';
import User from './models/User.js'; // Import User model for seeding

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

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        // Password provided by user
        const adminPassword = 'raja5207901@'; 
        
        const existingUser = await User.findOne({ email: adminEmail });
        
        if (!existingUser) {
            console.log('Seeding Admin User...');
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
            console.log('Admin User Created Successfully');
        } else {
            // Check if we need to sync credentials (force update password to ensure login works)
            // We set the password field. The pre-save hook in User model handles hashing.
            console.log('Syncing Admin Credentials...');
            existingUser.password = adminPassword;
            existingUser.status = 'Active'; // Ensure not blocked
            if(existingUser.username !== 'admin') existingUser.username = 'admin'; // Enforce username
            await existingUser.save();
            console.log('Admin User Credentials Synced');
        }
    } catch (error) {
        console.error('Admin Seeding Error:', error.message);
    }
};

// A simple test route
app.get('/', (req, res) => {
    res.send('SmartEarning API is running...');
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

// Custom Error Handler
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
};
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    // Run seeder after server starts
    await seedAdminUser();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});
