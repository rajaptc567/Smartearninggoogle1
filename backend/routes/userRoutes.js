
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
import { protect, admin } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, admin, getUsers)
    .post(validate('register'), createUser);

router.post('/login', validate('login'), loginUser);
router.post('/request-password-reset', userRequestPasswordReset);
router.post('/verify-reset-token/:token', verifyAndStartResetTimer);
router.put('/reset-password/:token', resetPasswordWithToken);

router.put('/bulk-restrictions', protect, admin, bulkUpdateRestrictions);
router.post('/bulk-dummy', protect, admin, createBulkDummyUsers);
router.delete('/bulk', protect, admin, bulkDeleteUsers);

router.route('/:id')
    .get(protect, getUser)
    .put(protect, updateUser)
    .delete(protect, admin, deleteUser);

router.post('/:id/adjust-wallet', protect, admin, adjustWallet);
router.post('/:id/purchase-plan', protect, purchasePlan);
router.post('/:id/activate-plan', protect, admin, adminActivatePlan);
router.post('/:id/admin-reset-password', protect, admin, adminInitiatePasswordReset);

export default router;
