
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { getLogs, clearLogs } from '../controllers/logsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin', 'super_admin']), getLogs)
    .delete(authorize(['admin', 'super_admin']), clearLogs);

export default router;
