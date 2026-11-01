
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { authLimiter, verificationLimiter } from '../middleware/rateLimiter.js';
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    bulkDeleteUsers,
    loginUser,
    adjustWallet,
    purchasePlan,
    adminActivatePlan,
    adminInitiatePasswordReset,
    resetPasswordWithToken,
    userRequestPasswordReset,
    verifyAndStartResetTimer,
    bulkUpdateRestrictions,
    createBulkDummyUsers,
    sendCustomAdminMessage,
    verifyEmailCode,
    verifyWhatsappCode,
    resendEmailCode,
    resendWhatsappCode
} from '../controllers/usersController.js';

const router = express.Router();

// Verification routes (Publicly accessible, controller enforces security)
router.post('/verify-email', verificationLimiter, verifyEmailCode);
router.post('/verify-whatsapp', verificationLimiter, verifyWhatsappCode);
router.post('/resend-email', authorize(['user', 'admin']), verificationLimiter, resendEmailCode);
router.post('/resend-whatsapp', authorize(['user', 'admin']), verificationLimiter, resendWhatsappCode);

// Public/Auth routes with rate limiting
router.post('/login', authLimiter, loginUser);
router.post('/request-password-reset', authLimiter, userRequestPasswordReset);
router.post('/verify-reset-token/:token', authLimiter, verifyAndStartResetTimer);
router.put('/reset-password/:token', authLimiter, resetPasswordWithToken);

// User Directory
router.route('/')
    .get(authorize(['admin', 'super_admin']), getUsers) 
    .post(authLimiter, createUser); // Registration protection

// User-Specific actions
router.post('/:id/purchase-plan', authorize(['user', 'admin']), purchasePlan);

// Admin-Only actions
router.post('/send-custom-message', authorize(['admin']), sendCustomAdminMessage);
router.put('/bulk-restrictions', authorize(['admin']), bulkUpdateRestrictions);
router.post('/bulk-dummy', authorize(['admin']), createBulkDummyUsers);
router.delete('/bulk', authorize(['admin']), bulkDeleteUsers);

router.route('/:id')
    .get(authorize(['user', 'admin']), getUser)
    .put(authorize(['user', 'admin']), updateUser)
    .delete(authorize(['admin']), deleteUser);

router.post('/:id/adjust-wallet', authorize(['admin']), adjustWallet);
router.post('/:id/activate-plan', authorize(['admin']), adminActivatePlan);
router.post('/:id/admin-reset-password', authorize(['admin']), adminInitiatePasswordReset);

export default router;
