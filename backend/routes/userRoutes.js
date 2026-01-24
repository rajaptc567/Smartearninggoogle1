
import express from 'express';
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    bulkDeleteUsers,
    loginUser,
    logout,
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
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public
router.post('/login', loginUser);
router.post('/request-password-reset', userRequestPasswordReset);
router.post('/verify-reset-token/:token', verifyAndStartResetTimer);
router.put('/reset-password/:token', resetPasswordWithToken);
router.post('/', createUser); // Registration

// Protected - All
router.use(protect);
router.get('/logout', logout);
router.route('/:id').get(getUser).put(updateUser);
router.post('/:id/purchase-plan', purchasePlan);

// Admin Only
router.use(authorizeAdmin);
router.route('/').get(getUsers);
router.put('/bulk-restrictions', bulkUpdateRestrictions);
router.post('/bulk-dummy', createBulkDummyUsers);
router.delete('/bulk', bulkDeleteUsers);
router.delete('/:id', deleteUser);
router.post('/:id/adjust-wallet', adjustWallet);
router.post('/:id/activate-plan', adminActivatePlan);
router.post('/:id/admin-reset-password', adminInitiatePasswordReset);

export default router;
