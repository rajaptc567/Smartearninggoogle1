
import express from 'express';
import {
    getTransfers,
    createTransfer,
    updateTransfer
} from '../controllers/transfersController.js';

const router = express.Router();

router.route('/')
    .get(getTransfers)
    .post(createTransfer);

router.route('/:id')
    .put(updateTransfer);

export default router;
