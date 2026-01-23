
import express from 'express';
import {
    getInvestmentPlans,
    getInvestmentPlan,
    createInvestmentPlan,
    updateInvestmentPlan,
    deleteInvestmentPlan,
} from '../controllers/investmentPlansController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET public for landing page/catalog
router.get('/', getInvestmentPlans);
router.get('/:id', getInvestmentPlan);

// Management requires Admin
router.use(protect);
router.use(authorizeAdmin);

router.post('/', createInvestmentPlan);
router.route('/:id')
    .put(updateInvestmentPlan)
    .delete(deleteInvestmentPlan);

export default router;
