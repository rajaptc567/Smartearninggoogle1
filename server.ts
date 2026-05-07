import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mongoose from 'mongoose';

// Backend imports - adjusting paths
import userRoutes from './backend/routes/userRoutes.js';
import depositRoutes from './backend/routes/depositRoutes.js';
import withdrawalRoutes from './backend/routes/withdrawalRoutes.js';
import transactionRoutes from './backend/routes/transactionRoutes.js';
import notificationRoutes from './backend/routes/notificationRoutes.js';
import paymentMethodRoutes from './backend/routes/paymentMethodRoutes.js';
import investmentPlanRoutes from './backend/routes/investmentPlanRoutes.js';
import transferRoutes from './backend/routes/transferRoutes.js';
import ruleRoutes from './backend/routes/ruleRoutes.js';
import settingRoutes from './backend/routes/settingRoutes.js';
import logRoutes from './backend/routes/logRoutes.js';
import passwordResetRequestRoutes from './backend/routes/passwordResetRequestRoutes.js';
import disputeRoutes from './backend/routes/disputeRoutes.js';
import taskRoutes from './backend/routes/taskRoutes.js'; 

// Middleware
import { authMiddleware } from './backend/middleware/authMiddleware.js';
import { globalLimiter } from './backend/middleware/rateLimiter.js';
import User from './backend/models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Infrastructure Settings
  app.set('trust proxy', 1);

  // Database Connection
  const seedAdminUser = async () => {
    try {
        const adminEmail = 'studio56.pk@gmail.com';
        const existingUser = await User.findOne({ email: adminEmail });
        if (!existingUser) {
            await User.create({
                username: 'admin',
                fullName: 'System Admin',
                email: adminEmail,
                password: 'raja5207901@', 
                role: 'super_admin',
                phone: '0000000000',
                country: 'Pakistan',
                status: 'Active',
                restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: true }
            });
            console.log('Admin account seeded.');
        }
    } catch (e) {
        console.error('Admin seeding error:', e.message);
    }
  };

  const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI is not defined. Backend will not work correctly.');
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected`);
        await seedAdminUser();
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
    }
  };

  connectDB();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      db: mongoose.connection.readyState === 1 ? 'connected' : 'connecting/disconnected',
      mongo_uri_exists: !!process.env.MONGO_URI,
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  // Simple request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
  
  // API Routes
  const apiRouter = express.Router();
  apiRouter.use('/users', userRoutes);
  apiRouter.use('/deposits', depositRoutes);
  apiRouter.use('/withdrawals', withdrawalRoutes);
  apiRouter.use('/transactions', transactionRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  apiRouter.use('/payment-methods', paymentMethodRoutes);
  apiRouter.use('/investment-plans', investmentPlanRoutes);
  apiRouter.use('/transfers', transferRoutes);
  apiRouter.use('/rules', ruleRoutes);
  apiRouter.use('/settings', settingRoutes);
  apiRouter.use('/logs', logRoutes);
  apiRouter.use('/password-reset-requests', passwordResetRequestRoutes);
  apiRouter.use('/disputes', disputeRoutes);
  apiRouter.use('/tasks', taskRoutes);

  // Apply Global Rate Limiting to all API routes
  app.use('/api', globalLimiter);
  
  // Passive Authentication Layer
  app.use(authMiddleware);

  // Mount the API Router
  app.use('/api/v1', apiRouter);

  // Catch-all for undefined API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `API route ${req.method} ${req.originalUrl} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          res.status(500).send("index.html not found. Please run 'npm run build'.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
