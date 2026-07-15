import express from 'express';
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
    renewUserTask
} from '../controllers/userTasksController.js';

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
    .post(authorize(['user', 'admin']), openTaskDispute);

router.route('/:id/submit-proof')
    .post(submitUserTaskProof);

router.route('/convert')
    .post(convertUserCurrency);

router.route('/convert-task-wallet')
    .post(convertTaskWalletBalance);

router.route('/:id')
    .put(updateUserTaskStatus)
    .delete(deleteUserTask);

router.route('/:id/renew')
    .post(renewUserTask);

export default router;
