
import express from 'express';
import {
    getRules,
    createRule,
    updateRule,
    deleteRule
} from '../controllers/rulesController.js';

const router = express.Router();

router.route('/')
    .get(getRules)
    .post(authorize(['admin']), createRule);

router.route('/:id')
    .put(authorize(['admin']), updateRule)
    .delete(authorize(['admin']), deleteRule);

export default router;
