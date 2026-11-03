import express from 'express';
import { getTransactions, getReconciliationReport } from '../controllers/transactionsController.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(authorize(['user', 'admin', 'super_admin']), getTransactions);
router.route('/reconciliation-audit').get(authorize(['admin', 'super_admin']), getReconciliationReport);

export default router;
