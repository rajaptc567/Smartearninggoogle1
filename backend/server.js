import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

// Route files
import userRoutes from './routes/userRoutes.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser middleware
app.use(express.json());

// Enable CORS
app.use(cors());

// A simple test route
app.get('/', (req, res) => {
    res.send('SmartEarning API is running...');
});

// Mount routers
app.use('/api/v1/users', userRoutes);
// TODO: Add other routes here, e.g.,
// import depositRoutes from './routes/depositRoutes.js';
// app.use('/api/v1/deposits', depositRoutes);


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
