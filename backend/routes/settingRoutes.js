
import express from 'express';
import {
    getSettings,
    updateSettings,
    getDataVersion
} from '../controllers/settingsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public read / version check
router.get('/', getSettings);
router.get('/version', getDataVersion);

// Protected update
router.put('/', protect, authorizeAdmin, updateSettings);

export default router;
