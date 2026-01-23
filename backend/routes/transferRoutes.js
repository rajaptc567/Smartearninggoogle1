
import express from 'express';
import {
    getTransfers,
    createTransfer,
    updateTransfer
} from '../controllers/transfersController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(authorizeAdmin, getTransfers)
    .post(createTransfer);

router.route('/:id')
    .put(authorizeAdmin, updateTransfer);

export default router;
