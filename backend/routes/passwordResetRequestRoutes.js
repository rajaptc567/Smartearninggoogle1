import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { 
    getPasswordResetRequests, 
    updatePasswordResetRequest, 
    deletePasswordResetRequest 
} from '../controllers/passwordResetRequestsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['admin', 'super_admin']), getPasswordResetRequests);

router.route('/:id')
    .put(authorize(['admin', 'super_admin']), updatePasswordResetRequest)
    .delete(authorize(['admin', 'super_admin']), deletePasswordResetRequest);

export default router;