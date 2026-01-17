
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
import { protect, admin } from '../middleware/authMiddleware.js';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for proof images
});

const router = express.Router();

router.route('/')
    .get(getTasks)
    .post(protect, admin, createTask);

router.get('/pending-verifications', protect, admin, getPendingVerifications);
router.put('/verify/:userId/:taskId', protect, admin, verifyTaskSubmission);

router.route('/:id')
    .put(protect, admin, updateTask)
    .delete(protect, admin, deleteTask);

router.post('/:id/complete', protect, upload.single('proof'), completeTask);

export default router;
