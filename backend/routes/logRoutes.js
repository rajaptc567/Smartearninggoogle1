
import express from 'express';
import { getLogs, clearLogs } from '../controllers/logsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin'), getLogs)
    .delete(protect, authorize('super_admin'), clearLogs);

export default router;
