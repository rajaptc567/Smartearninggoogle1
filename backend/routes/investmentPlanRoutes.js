
import express from 'express';
import {
    getInvestmentPlans,
    getInvestmentPlan,
    createInvestmentPlan,
    updateInvestmentPlan,
    deleteInvestmentPlan,
} from '../controllers/investmentPlansController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getInvestmentPlans)
    .post(protect, authorize('super_admin', 'admin'), createInvestmentPlan);

router.route('/:id')
    .get(getInvestmentPlan)
    .put(protect, authorize('super_admin', 'admin'), updateInvestmentPlan)
    .delete(protect, authorize('super_admin', 'admin'), deleteInvestmentPlan);

export default router;
