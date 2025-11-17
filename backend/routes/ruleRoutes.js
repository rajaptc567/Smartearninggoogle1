
import express from 'express';
import {
    getRules,
    createRule,
    deleteRule
} from '../controllers/rulesController.js';

const router = express.Router();

router.route('/')
    .get(getRules)
    .post(createRule);

router.route('/:id')
    .delete(deleteRule);

export default router;
