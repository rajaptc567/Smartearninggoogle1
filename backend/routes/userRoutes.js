
import express from 'express';
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
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'support'), getUsers)
    .post(createUser);

router.post('/login', loginUser);
router.post('/request-password-reset', userRequestPasswordReset);
router.post('/verify-reset-token/:token', verifyAndStartResetTimer);
router.put('/reset-password/:token', resetPasswordWithToken);

// Protected Routes
router.put('/bulk-restrictions', protect, authorize('super_admin', 'admin'), bulkUpdateRestrictions);
router.post('/bulk-dummy', protect, authorize('super_admin', 'admin'), createBulkDummyUsers);
router.delete('/bulk', protect, authorize('super_admin'), bulkDeleteUsers);

router.route('/:id')
    .get(protect, getUser)
    .put(protect, updateUser)
    .delete(protect, authorize('super_admin'), deleteUser);

router.post('/:id/adjust-wallet', protect, authorize('super_admin', 'admin', 'finance'), adjustWallet);
router.post('/:id/purchase-plan', protect, purchasePlan);
router.post('/:id/activate-plan', protect, authorize('super_admin', 'admin'), adminActivatePlan);
router.post('/:id/admin-reset-password', protect, authorize('super_admin', 'admin'), adminInitiatePasswordReset);

export default router;
