
import express from 'express';
import { getLogs } from '../controllers/logsController.js';

const router = express.Router();

router.route('/').get(getLogs);

export default router;
