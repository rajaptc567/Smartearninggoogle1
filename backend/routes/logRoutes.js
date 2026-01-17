
import express from 'express';
import { getLogs, clearLogs } from '../controllers/logsController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, admin, getLogs)
    .delete(protect, admin, clearLogs);

export default router;
