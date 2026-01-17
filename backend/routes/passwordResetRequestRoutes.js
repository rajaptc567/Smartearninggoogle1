
import express from 'express';
import { getPasswordResetRequests, deletePasswordResetRequest } from '../controllers/passwordResetRequestsController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, admin, getPasswordResetRequests);

router.route('/:id')
    .delete(protect, admin, deletePasswordResetRequest);

export default router;
