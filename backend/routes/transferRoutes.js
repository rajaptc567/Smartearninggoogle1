
import express from 'express';
import { financeLimiter } from '../middleware/rateLimiter.js';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getTransfers,
    createTransfer,
    updateTransfer
} from '../controllers/transfersController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin']), getTransfers)
    .post(authorize(['user', 'admin']), financeLimiter, createTransfer);

router.route('/:id')
    .put(authorize(['admin']), updateTransfer);

export default router;
