import express from 'express';
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    loginUser,
    adjustWallet,
    purchasePlan,
} from '../controllers/usersController.js';

const router = express.Router();

router.route('/').get(getUsers).post(createUser);
router.post('/login', loginUser);

router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

router.post('/:id/adjust-wallet', adjustWallet);
router.post('/:id/purchase-plan', purchasePlan);

export default router;