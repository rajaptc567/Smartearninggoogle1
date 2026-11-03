
import express from 'express';
import multer from 'multer';
import { authorize } from '../middleware/authMiddleware.js';
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
    .get(authorize(['user', 'admin', 'super_admin']), getTasks)
    .post(authorize(['admin', 'super_admin']), createTask);

router.get('/pending-verifications', authorize(['admin', 'super_admin']), getPendingVerifications);
router.put('/verify/:userId/:taskId', authorize(['admin', 'super_admin']), verifyTaskSubmission);

router.route('/:id')
    .put(authorize(['admin', 'super_admin']), updateTask)
    .delete(authorize(['admin', 'super_admin']), deleteTask);

router.post('/:id/complete', upload.single('proof'), authorize(['user', 'admin', 'super_admin']), completeTask);

export default router;
