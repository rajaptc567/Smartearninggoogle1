
import express from 'express';
import { getLogs, clearLogs } from '../controllers/logsController.js';

const router = express.Router();

router.route('/')
    .get(getLogs)
    .delete(clearLogs);

export default router;
