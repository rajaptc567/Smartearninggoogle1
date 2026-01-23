
import express from 'express';
import { getPasswordResetRequests, deletePasswordResetRequest } from '../controllers/passwordResetRequestsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Entirely Admin restricted
router.use(protect);
router.use(authorizeAdmin);

router.route('/')
    .get(getPasswordResetRequests);

router.route('/:id')
    .delete(deletePasswordResetRequest);

export default router;
