
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getInvestmentPlans,
    getInvestmentPlan,
    createInvestmentPlan,
    updateInvestmentPlan,
    deleteInvestmentPlan,
} from '../controllers/investmentPlansController.js';

const router = express.Router();

router
    .route('/')
    .get(getInvestmentPlans) // Public view for homepage
    .post(authorize(['admin']), createInvestmentPlan);

router
    .route('/:id')
    .get(getInvestmentPlan)
    .put(authorize(['admin']), updateInvestmentPlan)
    .delete(authorize(['admin']), deleteInvestmentPlan);

export default router;
