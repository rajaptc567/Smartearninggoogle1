
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
    .post(createRule);

router.route('/:id')
    .put(updateRule)
    .delete(deleteRule);

export default router;
