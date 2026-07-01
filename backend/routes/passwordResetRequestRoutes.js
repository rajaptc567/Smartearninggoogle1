import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { 
    getPasswordResetRequests, 
    updatePasswordResetRequest, 
    deletePasswordResetRequest 
} from '../controllers/passwordResetRequestsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin']), getPasswordResetRequests);

router.route('/:id')
    .put(authorize(['admin']), updatePasswordResetRequest)
    .delete(authorize(['admin']), deletePasswordResetRequest);

export default router;