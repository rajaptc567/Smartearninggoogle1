
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { financeLimiter } from '../middleware/rateLimiter.js';
import {
    getWithdrawals,
    getWithdrawal,
    createWithdrawal,
    updateWithdrawal,
    deleteWithdrawal
} from '../controllers/withdrawalsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin', 'super_admin']), getWithdrawals)
    .post(authorize(['user', 'admin', 'super_admin']), financeLimiter, createWithdrawal);

router.route('/:id')
    .get(authorize(['user', 'admin', 'super_admin']), getWithdrawal)
    .put(authorize(['admin', 'super_admin']), updateWithdrawal)
    .delete(authorize(['admin', 'super_admin']), deleteWithdrawal);

export default router;
