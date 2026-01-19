import express from 'express';
import {
    getSettings,
    updateSettings,
    getDataVersion
} from '../controllers/settingsController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getSettings)
    .put(protect, admin, updateSettings);

router.get('/version', getDataVersion);

export default router;