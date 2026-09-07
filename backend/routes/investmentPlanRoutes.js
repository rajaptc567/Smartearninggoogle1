
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { requireInvestmentAccess } from '../utils/investmentAccess.js';
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
    .get(getInvestmentPlans) // Handled inside controller to gracefully return empty array when disabled
    .post(authorize(['admin']), createInvestmentPlan);

router
    .route('/:id')
    .get(requireInvestmentAccess, getInvestmentPlan)
    .put(authorize(['admin']), updateInvestmentPlan)
    .delete(authorize(['admin']), deleteInvestmentPlan);

export default router;
