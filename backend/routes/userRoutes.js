
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
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
    createBulkDummyUsers
} from '../controllers/usersController.js';

const router = express.Router();

// Public/Auth routes
router.post('/login', loginUser);
router.post('/request-password-reset', userRequestPasswordReset);
router.post('/verify-reset-token/:token', verifyAndStartResetTimer);
router.put('/reset-password/:token', resetPasswordWithToken);

// User Directory
// Removed authorize middleware from GET / to allow DataProvider initial handshake.
// Privacy is handled inside the getUsers controller function via data masking.
router.route('/')
    .get(getUsers) 
    .post(createUser);

// User-Specific actions
router.post('/:id/purchase-plan', authorize(['user', 'admin']), purchasePlan);

// Admin-Only actions
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
