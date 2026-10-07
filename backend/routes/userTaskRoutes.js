import express from 'express';
import multer from 'multer';
import { authorize } from '../middleware/authMiddleware.js';
import { taskActionLimiter } from '../middleware/rateLimiter.js';
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
    resetWorkAndEarnData,
    getSurveyCampaignAnalytics,
    addAdminCampaignFunds,
    resumeAdminCampaign,
    pauseAdminCampaign
} from '../controllers/userTasksController.js';

// Multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin']), getUserTasks)
    .post(taskActionLimiter, authorize(['user', 'admin']), createUserTask);

router.route('/submissions')
    .get(authorize(['user', 'admin']), getUserTaskSubmissions);

router.route('/submissions/:subId')
    .put(authorize(['user', 'admin']), updateSubmissionStatus)
    .delete(authorize(['user', 'admin']), deleteSubmission);

router.route('/submissions/:subId/dispute')
    .post(taskActionLimiter, upload.single('proof'), authorize(['user', 'admin']), openTaskDispute);

router.route('/:id/submit-proof')
    .post(taskActionLimiter, authorize(['user', 'admin']), submitUserTaskProof);

router.route('/convert')
    .post(taskActionLimiter, authorize(['user', 'admin']), convertUserCurrency);

router.route('/convert-task-wallet')
    .post(taskActionLimiter, authorize(['user', 'admin']), convertTaskWalletBalance);

router.route('/transfer-investment-to-task')
    .post(taskActionLimiter, authorize(['user', 'admin']), transferInvestmentToTaskWallet);

router.route('/transfer-task-earnings-to-campaign')
    .post(taskActionLimiter, authorize(['user', 'admin']), transferTaskEarningsToCampaignWallet);

router.route('/transfer-wallet-to-campaign')
    .post(taskActionLimiter, authorize(['user', 'admin']), transferWalletToCampaign);

router.route('/admin-reset-data')
    .post(authorize(['admin', 'super_admin']), resetWorkAndEarnData);

router.route('/simulate-reward')
    .post(authorize(['admin', 'super_admin']), simulateTaskReward);

router.route('/:id/survey-analytics')
    .get(authorize(['user', 'admin']), getSurveyCampaignAnalytics);

router.route('/:id/add-funds')
    .post(taskActionLimiter, authorize(['admin', 'super_admin']), addAdminCampaignFunds);

router.route('/:id/resume-campaign')
    .post(taskActionLimiter, authorize(['admin', 'super_admin']), resumeAdminCampaign);

router.route('/:id/pause-campaign')
    .post(taskActionLimiter, authorize(['admin', 'super_admin']), pauseAdminCampaign);

router.route('/:id')
    .put(authorize(['user', 'admin']), updateUserTaskStatus)
    .delete(authorize(['user', 'admin']), deleteUserTask);

router.route('/:id/renew')
    .post(taskActionLimiter, authorize(['user', 'admin']), renewUserTask);

export default router;
