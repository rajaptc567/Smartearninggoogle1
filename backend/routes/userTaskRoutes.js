import express from 'express';
import multer from 'multer';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getUserTasks,
    createUserTask,
    updateUserTaskStatus,
    deleteUserTask,
    getUserTaskSubmissions,
    submitUserTaskProof,
    updateSubmissionStatus,
    deleteSubmission,
    convertUserCurrency,
    openTaskDispute,
    convertTaskWalletBalance,
    renewUserTask,
    simulateTaskReward,
    transferInvestmentToTaskWallet,
    transferTaskEarningsToCampaignWallet,
    transferWalletToCampaign,
    resetWorkAndEarnData
} from '../controllers/userTasksController.js';

// Multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(getUserTasks)
    .post(createUserTask);

router.route('/submissions')
    .get(getUserTaskSubmissions);

router.route('/submissions/:subId')
    .put(updateSubmissionStatus)
    .delete(deleteSubmission);

router.route('/submissions/:subId/dispute')
    .post(upload.single('proof'), authorize(['user', 'admin']), openTaskDispute);

router.route('/:id/submit-proof')
    .post(submitUserTaskProof);

router.route('/convert')
    .post(convertUserCurrency);

router.route('/convert-task-wallet')
    .post(convertTaskWalletBalance);

router.route('/transfer-investment-to-task')
    .post(transferInvestmentToTaskWallet);

router.route('/transfer-task-earnings-to-campaign')
    .post(transferTaskEarningsToCampaignWallet);

router.route('/transfer-wallet-to-campaign')
    .post(transferWalletToCampaign);

router.route('/admin-reset-data')
    .post(authorize(['admin', 'super_admin']), resetWorkAndEarnData);

router.route('/simulate-reward')
    .post(simulateTaskReward);

router.route('/:id')
    .put(updateUserTaskStatus)
    .delete(deleteUserTask);

router.route('/:id/renew')
    .post(renewUserTask);

export default router;
