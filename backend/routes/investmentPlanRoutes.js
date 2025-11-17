
import express from 'express';
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
    .get(getInvestmentPlans)
    .post(createInvestmentPlan);

router
    .route('/:id')
    .get(getInvestmentPlan)
    .put(updateInvestmentPlan)
    .delete(deleteInvestmentPlan);

export default router;