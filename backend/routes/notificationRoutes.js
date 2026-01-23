
import express from 'express';
import { getNotifications, markAsRead, createNotification, markPopupShown, updateNotification, deleteNotification } from '../controllers/notificationsController.js';
import { protect, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getNotifications)
    .post(authorizeAdmin, createNotification); // Admin-only broadcast

router.route('/:id')
    .put(updateNotification) 
    .delete(deleteNotification);

router.route('/read/:userId').put(markAsRead);
router.route('/popup-shown/:id').put(markPopupShown);

export default router;
