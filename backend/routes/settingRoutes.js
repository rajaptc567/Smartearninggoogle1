
import express from 'express';
import {
    getSettings,
    updateSettings,
    getDataVersion
} from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getSettings)
    .put(protect, authorize('super_admin', 'admin'), updateSettings);

router.get('/version', getDataVersion);

export default router;
