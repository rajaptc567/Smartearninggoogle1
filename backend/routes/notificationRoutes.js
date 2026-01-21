
import express from 'express';
import { getNotifications, markAsRead, createNotification, markPopupShown, updateNotification, deleteNotification } from '../controllers/notificationsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('super_admin', 'admin', 'support'), getNotifications)
    .post(protect, authorize('super_admin', 'admin'), createNotification); 

router.route('/:id')
    .put(protect, updateNotification) 
    .delete(protect, deleteNotification); 

router.route('/read/:userId').put(protect, markAsRead);
router.route('/popup-shown/:id').put(protect, markPopupShown);

export default router;
