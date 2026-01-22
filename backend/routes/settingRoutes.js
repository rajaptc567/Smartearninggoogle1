
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getSettings,
    updateSettings,
    getDataVersion
} from '../controllers/settingsController.js';

const router = express.Router();

// Version polling is public for real-time sync
router.get('/version', getDataVersion);

router.route('/')
    .get(getSettings) // PUBLIC: Needed for home page rendering
    .put(authorize(['super_admin']), updateSettings); // Only Super Admin can change settings

export default router;
