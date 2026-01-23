
import express from 'express';
import {
    getWithdrawals,
    getWithdrawal,
    createWithdrawal,
    updateWithdrawal,
    deleteWithdrawal
} from '../controllers/withdrawalsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(authorizeAdmin, getWithdrawals)
    .post(createWithdrawal);

router.route('/:id')
    .get(getWithdrawal)
    .put(authorizeAdmin, updateWithdrawal)
    .delete(authorizeAdmin, deleteWithdrawal);

export default router;
