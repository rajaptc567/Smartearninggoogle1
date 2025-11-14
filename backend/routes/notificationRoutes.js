import express from 'express';
import { getNotifications, markAsRead } from '../controllers/notificationsController.js';

const router = express.Router();

router.route('/').get(getNotifications);
router.route('/read/:userId').put(markAsRead);

export default router;