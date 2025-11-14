import express from 'express';
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser
} from '../controllers/usersController.js';

const router = express.Router();

// Route for getting all users and creating a new user
router
    .route('/')
    .get(getUsers)
    .post(createUser);

// Route for getting, updating, and deleting a single user by ID
router
    .route('/:id')
    .get(getUser)
    .put(updateUser)
    .delete(deleteUser);

export default router;
