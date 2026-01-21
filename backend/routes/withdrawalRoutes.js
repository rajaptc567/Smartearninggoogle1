
import express from 'express';
import {
    getWithdrawals,
    getWithdrawal,
    createWithdrawal,
    updateWithdrawal,
    deleteWithdrawal
} from '../controllers/withdrawalsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'finance', 'support'), getWithdrawals)
    .post(protect, createWithdrawal);

router.route('/:id')
    .get(protect, getWithdrawal)
    .put(protect, authorize('super_admin', 'admin', 'finance'), updateWithdrawal)
    .delete(protect, authorize('super_admin'), deleteWithdrawal);

export default router;
