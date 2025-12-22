
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
    adminRemoveUserPlan,
    adminInitiatePasswordReset,
    resetPasswordWithToken,
    userRequestPasswordReset,
    verifyAndStartResetTimer,
    bulkUpdateRestrictions
} from '../controllers/usersController.js';

const router = express.Router();

router.route('/').get(getUsers).post(createUser);
router.post('/login', loginUser);
router.post('/request-password-reset', userRequestPasswordReset);
router.post('/verify-reset-token/:token', verifyAndStartResetTimer);
router.put('/reset-password/:token', resetPasswordWithToken);
router.put('/bulk-restrictions', bulkUpdateRestrictions);
router.delete('/bulk', bulkDeleteUsers);

router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

router.post('/:id/adjust-wallet', adjustWallet);
router.post('/:id/purchase-plan', purchasePlan);
router.post('/:id/activate-plan', adminActivatePlan);
router.delete('/:id/plans/:planInstanceId', adminRemoveUserPlan);
router.post('/:id/admin-reset-password', adminInitiatePasswordReset);

export default router;
