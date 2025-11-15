import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';

// Route files
import userRoutes from './routes/userRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Models for seeding
import User from './models/User.js';
import Withdrawal from './models/Withdrawal.js';

// Mock Data for Seeding
const mockUsers = [
  { _id: '1', username: 'john.doe', fullName: 'John Doe', email: 'john.doe@example.com', phone: '123-456-7890', whatsapp: '1234567890', country: 'USA', walletBalance: 221.00, activePlan: 'Gold Plan', registrationDate: '2023-10-26', status: 'Active', sponsor: 'admin' },
  { _id: '2', username: 'jane.smith', fullName: 'Jane Smith', email: 'jane.smith@example.com', phone: '234-567-8901', whatsapp: '2345678901', country: 'Canada', walletBalance: 50.00, activePlan: 'Silver Plan', registrationDate: '2023-10-25', status: 'Active', sponsor: 'john.doe' },
  { _id: '3', username: 'sam.wilson', fullName: 'Sam Wilson', email: 'sam.wilson@example.com', phone: '345-678-9012', whatsapp: '3456789012', country: 'UK', walletBalance: 0, activePlan: 'None', registrationDate: '2023-10-24', status: 'Pending', sponsor: 'jane.smith' },
  { _id: '4', username: 'chris.green', fullName: 'Chris Green', email: 'chris.green@example.com', phone: '456-789-0123', whatsapp: '4567890123', country: 'Australia', walletBalance: 55.20, activePlan: 'Bronze Plan', registrationDate: '2023-10-23', status: 'Blocked', sponsor: 'john.doe' },
];

const mockWithdrawals = [
    { _id: 'WDR2001', userId: '1', userName: 'john.doe', method: 'Easypaisa', amount: 50, fee: 2.5, finalAmount: 47.5, status: 'Paid', date: '2023-10-26', accountTitle: 'John Doe', accountNumber: '03001234567' },
    { _id: 'WDR2002', userId: '2', userName: 'jane.smith', method: 'Bank Transfer', amount: 100, fee: 5, finalAmount: 95, status: 'Pending', date: '2023-10-27', accountTitle: 'Jane Smith', accountNumber: '1234-5678-9012-3456', userNotes: 'Please process this quickly, thanks!' },
    { _id: 'WDR2003', userId: '1', userName: 'john.doe', method: 'BTC', amount: 75, fee: 3.75, finalAmount: 71.25, status: 'Approved', date: '2023-10-25', accountTitle: 'John Doe BTC', accountNumber: 'bc1q...' },
    { _id: 'WDR2004', userId: '4', userName: 'chris.green', method: 'Easypaisa', amount: 50, fee: 2.5, finalAmount: 47.5, status: 'Matching', date: '2023-10-28', accountTitle: 'Chris Green', accountNumber: '03129876543', matchRemainingAmount: 50 },
];

// Load env vars
dotenv.config();

const startServer = async () => {
    // Connect to database
    await connectDB();

    // Seed database if empty
    try {
        if (await User.countDocuments() === 0) {
            console.log('No users found. Seeding database with mock users...');
            const usersWithPasswords = mockUsers.map(u => ({...u, password: 'password123'}));
            await User.insertMany(usersWithPasswords);
            console.log('Users seeded.');
        }
        if (await Withdrawal.countDocuments() === 0) {
            console.log('No withdrawals found. Seeding database with mock withdrawals...');
            await Withdrawal.insertMany(mockWithdrawals);
            console.log('Withdrawals seeded.');
        }
    } catch (error) {
        console.error('Error during database seeding:', error);
    }

    const app = express();

    // Body parser middleware
    app.use(express.json());

    // Handle ES Modules path resolution
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Enable CORS
    app.use(cors());

    // Set static folder for uploads
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    const PORT = process.env.PORT || 5000;

    const server = app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
        console.log(`Error: ${err.message}`);
        // Close server & exit process
        server.close(() => process.exit(1));
    });
};

startServer();
