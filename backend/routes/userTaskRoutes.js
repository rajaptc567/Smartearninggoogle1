import express from 'express';
import {
    getUserTasks,
    createUserTask,
    updateUserTaskStatus,
    deleteUserTask,
    getUserTaskSubmissions,
    submitUserTaskProof,
    updateSubmissionStatus,
    deleteSubmission,
    convertUserCurrency
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

router.route('/:id/submit-proof')
    .post(submitUserTaskProof);

router.route('/convert')
    .post(convertUserCurrency);

router.route('/:id')
    .put(updateUserTaskStatus)
    .delete(deleteUserTask);

export default router;
