import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

// Route files
import userRoutes from './routes/userRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import authRoutes from './routes/authRoutes.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser middleware - increase limit to handle base64 images
app.use(express.json({ limit: '10mb' }));

// Enable CORS
// For production, you should restrict the origin to your Vercel frontend URL
/*
const corsOptions = {
  origin: 'https://your-vercel-app-name.vercel.app',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
*/
// For development, allowing all origins is fine.
app.use(cors());


// A simple test route
app.get('/', (req, res) => {
    res.send('SmartEarning API is running...');
});

// Mount routers
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/deposits', depositRoutes);
app.use('/api/v1/withdrawals', withdrawalRoutes);
app.use('/api/v1/auth', authRoutes);


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