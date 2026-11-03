
import express from 'express';
import { authorize } from '../middleware/authMiddleware.js';
import { getNotifications, markAsRead, createNotification, markPopupShown, updateNotification, deleteNotification, bulkDeleteNotifications } from '../controllers/notificationsController.js';

const router = express.Router();

router.route('/')
    .get(authorize(['user', 'admin', 'super_admin']), getNotifications)
    .post(authorize(['admin', 'super_admin']), createNotification); // Admin send message

router.route('/bulk-delete')
    .post(authorize(['admin', 'super_admin']), bulkDeleteNotifications);

router.route('/:id')
    .put(authorize(['user', 'admin', 'super_admin']), updateNotification) // For marking single as read
    .delete(authorize(['user', 'admin', 'super_admin']), deleteNotification); // Allow user to delete

router.route('/read/:userId').put(authorize(['user', 'admin', 'super_admin']), markAsRead);
router.route('/popup-shown/:id').put(authorize(['user', 'admin', 'super_admin']), markPopupShown);

export default router;
