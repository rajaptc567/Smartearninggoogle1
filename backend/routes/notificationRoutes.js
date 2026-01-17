
import express from 'express';
import { getNotifications, markAsRead, createNotification, markPopupShown, updateNotification, deleteNotification } from '../controllers/notificationsController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getNotifications)
    .post(protect, admin, createNotification); // Admin send message

router.route('/:id')
    .put(protect, updateNotification) // For marking single as read
    .delete(protect, deleteNotification); // Allow user to delete

router.route('/read/:userId').put(protect, markAsRead);
router.route('/popup-shown/:id').put(protect, markPopupShown);

export default router;
