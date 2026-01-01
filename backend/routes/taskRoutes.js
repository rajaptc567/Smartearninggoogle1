
import express from 'express';
import multer from 'multer';
import {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask
} from '../controllers/tasksController.js';

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.route('/')
    .get(getTasks)
    .post(createTask);

router.route('/:id')
    .put(updateTask)
    .delete(deleteTask);

router.post('/:id/complete', upload.single('proof'), completeTask);

export default router;
