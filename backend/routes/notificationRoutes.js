
import express from 'express';
import { getNotifications, markAsRead, createNotification, markPopupShown } from '../controllers/notificationsController.js';

const router = express.Router();

router.route('/')
    .get(getNotifications)
    .post(createNotification); // Admin send message

router.route('/read/:userId').put(markAsRead);
router.route('/popup-shown/:id').put(markPopupShown);

export default router;