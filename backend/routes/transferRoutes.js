
import express from 'express';
import { financeLimiter } from '../middleware/rateLimiter.js';
import {
    getTransfers,
    createTransfer,
    updateTransfer
} from '../controllers/transfersController.js';

const router = express.Router();

router.route('/')
    .get(getTransfers)
    .post(financeLimiter, createTransfer);

router.route('/:id')
    .put(updateTransfer);

export default router;
