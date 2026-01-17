import express from 'express';
import { getPasswordResetRequests, deletePasswordResetRequest } from '../controllers/passwordResetRequestsController.js';

const router = express.Router();

router.route('/')
    .get(getPasswordResetRequests);

router.route('/:id')
    .delete(deletePasswordResetRequest);

export default router;