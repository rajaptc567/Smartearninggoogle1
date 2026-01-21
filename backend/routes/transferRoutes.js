
import express from 'express';
import {
    getTransfers,
    createTransfer,
    updateTransfer
} from '../controllers/transfersController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'finance', 'support'), getTransfers)
    .post(protect, createTransfer);

router.route('/:id')
    .put(protect, authorize('super_admin', 'admin', 'finance'), updateTransfer);

export default router;
