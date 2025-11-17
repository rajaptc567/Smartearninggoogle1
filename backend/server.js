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
import paymentMethodRoutes from './routes/paymentMethodRoutes.js';
import investmentPlanRoutes from './routes/investmentPlanRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import logRoutes from './routes/logRoutes.js';

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
app.use('/api/v1/payment-methods', paymentMethodRoutes);
app.use('/api/v1/investment-plans', investmentPlanRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/rules', ruleRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/logs', logRoutes);

// Custom Error Handler
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
};
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});