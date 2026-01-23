
import express from 'express';
import {
    getRules,
    createRule,
    updateRule,
    deleteRule
} from '../controllers/rulesController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public read
router.get('/', getRules);

// Admin management
router.use(protect);
router.use(authorizeAdmin);

router.post('/', createRule);
router.route('/:id')
    .put(updateRule)
    .delete(deleteRule);

export default router;
