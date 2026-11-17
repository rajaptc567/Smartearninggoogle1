import express from 'express';
import { 
    getTransactions, 
    getReconciliationReport,
    getPendingOfferwallRiskReviews,
    approveOfferwallRiskReview,
    rejectOfferwallRiskReview
} from '../controllers/transactionsController.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(authorize(['user', 'admin', 'super_admin']), getTransactions);
router.route('/reconciliation-audit').get(authorize(['admin', 'super_admin']), getReconciliationReport);
router.route('/risk-review').get(authorize(['admin', 'super_admin']), getPendingOfferwallRiskReviews);
router.route('/:id/approve-offerwall-review').post(authorize(['admin', 'super_admin']), approveOfferwallRiskReview);
router.route('/:id/reject-offerwall-review').post(authorize(['admin', 'super_admin']), rejectOfferwallRiskReview);

export default router;

