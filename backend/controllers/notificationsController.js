
import Notification from '../models/Notification.js';
import User from '../models/User.js';

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

// @desc    Create a notification (Admin message)
// @route   POST /api/v1/notifications
export const createNotification = async (req, res) => {
    try {
        const { userId, message, subject, isPopup } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const notification = await Notification.create({
            userId,
            message,
            subject,
            isPopup: isPopup || false,
            popupShown: false,
            read: false
        });

        res.status(201).json({ success: true, data: notification });
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
        const updatedNotifications = await Notification.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: updatedNotifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Mark a popup notification as shown (closed by user)
// @route   PUT /api/v1/notifications/popup-shown/:id
export const markPopupShown = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { popupShown: true },
            { new: true }
        );
        if(!notification) return res.status(404).json({ success: false, error: "Notification not found" });
        
        // Return updated list for frontend sync
        const notifications = await Notification.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: notifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};