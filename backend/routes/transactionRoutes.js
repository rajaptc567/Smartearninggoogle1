
import express from 'express';
import { getTransactions } from '../controllers/transactionsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'finance', 'support'), getTransactions);

export default router;
