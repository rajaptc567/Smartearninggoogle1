
import express from 'express';
import {
    getRules,
    createRule,
    updateRule,
    deleteRule
} from '../controllers/rulesController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getRules)
    .post(protect, authorize('super_admin', 'admin'), createRule);

router.route('/:id')
    .put(protect, authorize('super_admin', 'admin'), updateRule)
    .delete(protect, authorize('super_admin', 'admin'), deleteRule);

export default router;
