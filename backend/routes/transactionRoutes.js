
import express from 'express';
import { getTransactions } from '../controllers/transactionsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getTransactions);

export default router;
