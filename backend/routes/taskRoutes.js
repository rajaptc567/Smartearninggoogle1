
import express from 'express';
import multer from 'multer';
import {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    getPendingVerifications,
    verifyTaskSubmission
} from '../controllers/tasksController.js';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for proof images
});

const router = express.Router();

router.route('/')
    .get(getTasks)
    .post(createTask);

router.get('/pending-verifications', getPendingVerifications);
router.put('/verify/:userId/:taskId', verifyTaskSubmission);

router.route('/:id')
    .put(updateTask)
    .delete(deleteTask);

router.post('/:id/complete', upload.single('proof'), completeTask);

export default router;
