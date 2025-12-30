
import express from 'express';
import {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask
} from '../controllers/tasksController.js';

const router = express.Router();

router.route('/')
    .get(getTasks)
    .post(createTask);

router.route('/:id')
    .put(updateTask)
    .delete(deleteTask);

router.post('/:id/complete', completeTask);

export default router;
