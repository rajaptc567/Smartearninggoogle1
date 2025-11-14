import express from 'express';
import {
    getDeposits,
    createDeposit,
    updateDeposit
} from '../controllers/depositsController.js';

const router = express.Router();

router
    .route('/')
    .get(getDeposits)
    .post(createDeposit);

router
    .route('/:id')
    .put(updateDeposit);

export default router;