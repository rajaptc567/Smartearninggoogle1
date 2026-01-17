
import express from 'express';
import {
    getWithdrawals,
    getWithdrawal,
    createWithdrawal,
    updateWithdrawal,
    deleteWithdrawal
} from '../controllers/withdrawalsController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router
    .route('/')
    .get(protect, admin, getWithdrawals)
    .post(protect, createWithdrawal);

router
    .route('/:id')
    .get(protect, getWithdrawal)
    .put(protect, admin, updateWithdrawal)
    .delete(protect, admin, deleteWithdrawal);

export default router;
