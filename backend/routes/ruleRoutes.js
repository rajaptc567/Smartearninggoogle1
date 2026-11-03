
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getRules,
    createRule,
    updateRule,
    deleteRule
} from '../controllers/rulesController.js';

const router = express.Router();

router.route('/')
    .get(getRules)
    .post(authorize(['admin', 'super_admin']), createRule);

router.route('/:id')
    .put(authorize(['admin', 'super_admin']), updateRule)
    .delete(authorize(['admin', 'super_admin']), deleteRule);

export default router;
