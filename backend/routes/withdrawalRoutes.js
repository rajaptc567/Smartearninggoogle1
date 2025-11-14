import express from 'express';
import {
    getWithdrawals,
    createWithdrawal,
    updateWithdrawal
} from '../controllers/withdrawalsController.js';

const router = express.Router();

router
    .route('/')
    .get(getWithdrawals)
    .post(createWithdrawal);

router
    .route('/:id')
    .put(updateWithdrawal);

export default router;