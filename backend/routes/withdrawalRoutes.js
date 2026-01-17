import express from 'express';
import {
    getWithdrawals,
    getWithdrawal,
    createWithdrawal,
    updateWithdrawal,
    deleteWithdrawal
} from '../controllers/withdrawalsController.js';

const router = express.Router();

router
    .route('/')
    .get(getWithdrawals)
    .post(createWithdrawal);

router
    .route('/:id')
    .get(getWithdrawal)
    .put(updateWithdrawal)
    .delete(deleteWithdrawal);

export default router;
