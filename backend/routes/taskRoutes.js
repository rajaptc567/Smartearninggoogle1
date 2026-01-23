
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
import { protect, authorizeAdmin } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getTasks)
    .post(authorizeAdmin, createTask);

router.get('/pending-verifications', authorizeAdmin, getPendingVerifications);
router.put('/verify/:userId/:taskId', authorizeAdmin, verifyTaskSubmission);

router.route('/:id')
    .put(authorizeAdmin, updateTask)
    .delete(authorizeAdmin, deleteTask);

router.post('/:id/complete', upload.single('proof'), completeTask);

export default router;
