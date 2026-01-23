
import express from 'express';
import { getLogs, clearLogs } from '../controllers/logsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin only
router.use(protect);
router.use(authorizeAdmin);

router.route('/')
    .get(getLogs)
    .delete(clearLogs);

export default router;
