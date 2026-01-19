import express from 'express';
import { getTransactions } from '../controllers/transactionsController.js';

const router = express.Router();

router.route('/').get(getTransactions);

export default router;