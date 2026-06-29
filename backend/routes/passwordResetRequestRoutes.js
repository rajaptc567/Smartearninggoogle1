import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { getPasswordResetRequests, deletePasswordResetRequest } from '../controllers/passwordResetRequestsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin']), getPasswordResetRequests);

router.route('/:id')
    .delete(authorize(['admin']), deletePasswordResetRequest);

export default router;