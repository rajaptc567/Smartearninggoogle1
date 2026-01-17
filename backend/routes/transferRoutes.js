
import express from 'express';
import {
    getTransfers,
    createTransfer,
    updateTransfer
} from '../controllers/transfersController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, admin, getTransfers)
    .post(protect, createTransfer);

router.route('/:id')
    .put(protect, admin, updateTransfer);

export default router;
