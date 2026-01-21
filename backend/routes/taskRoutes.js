
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
import { protect, authorize } from '../middleware/authMiddleware.js';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.route('/')
    .get(getTasks)
    .post(protect, authorize('super_admin', 'admin'), createTask);

router.get('/pending-verifications', protect, authorize('super_admin', 'admin', 'support'), getPendingVerifications);
router.put('/verify/:userId/:taskId', protect, authorize('super_admin', 'admin', 'support'), verifyTaskSubmission);

router.route('/:id')
    .put(protect, authorize('super_admin', 'admin'), updateTask)
    .delete(protect, authorize('super_admin', 'admin'), deleteTask);

router.post('/:id/complete', protect, upload.single('proof'), completeTask);

export default router;
