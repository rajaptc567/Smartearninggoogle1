import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';

// Import backend logic
import connectDB from './backend/config/db.js';
import userRoutes from './backend/routes/userRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Connect to database
  // We'll lazy connect or check if URI exists to avoid crash on startup without env var
  if (process.env.MONGO_URI) {
    try {
      await connectDB();
    } catch (error) {
      console.error('Initial MongoDB connection failed:', error);
    }
  } else {
    console.warn('MONGO_URI not found. Backend will not work correctly.');
  }

  app.use(express.json());
  app.use(cors());

  // API Routes
  app.use('/api/v1/users', userRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SmartEarning API is running...' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
