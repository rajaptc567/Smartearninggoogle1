import express from 'express';
import { getTransactions } from '../controllers/transactionsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, getTransactions);

export default router;