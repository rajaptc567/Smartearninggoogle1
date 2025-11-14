import Notification from '../models/Notification.js';

// @desc    Get all notifications
// @route   GET /api/v1/notifications
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ date: -1 });
        res.status(200).json({ success: true, count: notifications.length, data: notifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Mark notifications as read for a user
// @route   PUT /api/v1/notifications/read/:userId
export const markAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.params.userId, read: false },
            { $set: { read: true } }
        );
        const updatedNotifications = await Notification.find();
        res.status(200).json({ success: true, data: updatedNotifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
