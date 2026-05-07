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
  const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.warn('MONGO_URI is not defined. Backend will not work correctly.');
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
    }
  };

  await connectDB();

  // Seed Admin
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
  await seedAdminUser();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Apply Global Rate Limiting
  app.use('/api', globalLimiter);
  
  // Passive Authentication Layer
  app.use(authMiddleware);

  // API Routes
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
