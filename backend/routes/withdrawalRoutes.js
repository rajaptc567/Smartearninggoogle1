
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getWithdrawals,
    getWithdrawal,
    createWithdrawal,
    updateWithdrawal,
    deleteWithdrawal
} from '../controllers/withdrawalsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin']), getWithdrawals)
    .post(authorize(['user', 'admin']), createWithdrawal);

router.route('/:id')
    .get(authorize(['user', 'admin']), getWithdrawal)
    .put(authorize(['admin']), updateWithdrawal)
    .delete(authorize(['admin']), deleteWithdrawal);

export default router;
