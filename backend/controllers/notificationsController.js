
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

// @desc    Create a notification (Admin message, single or bulk)
// @route   POST /api/v1/notifications
export const createNotification = async (req, res) => {
    try {
        const { userId, message, subject, isPopup, targetType, targetIds } = req.body;
        
        let notificationsToCreate = [];

        // CASE 1: Single User (Legacy or specific selection)
        if (userId) {
             const user = await User.findById(userId);
             if (!user) return res.status(404).json({ success: false, error: 'User not found' });
             notificationsToCreate.push({ userId, message, subject, isPopup, popupShown: false, read: false });
        } 
        // CASE 2: Bulk Messaging
        else if (targetType) {
            let query = {};
            
            if (targetType === 'all') {
                query = {}; // Select all users
            } else if (targetType === 'plan' && targetIds && targetIds.length > 0) {
                // Select users who have ANY of the selected plans in their activePlans array
                query = { 'activePlans.planId': { $in: targetIds } };
            } else if (targetType === 'single' && targetIds && targetIds.length > 0) {
                query = { _id: { $in: targetIds } };
            } else {
                return res.status(400).json({ success: false, error: 'Invalid target configuration' });
            }

            const users = await User.find(query).select('_id');
            
            notificationsToCreate = users.map(u => ({
                userId: u._id,
                message,
                subject,
                isPopup: isPopup || false,
                popupShown: false,
                read: false
            }));
        } else {
             return res.status(400).json({ success: false, error: 'Missing recipient information' });
        }

        if (notificationsToCreate.length > 0) {
            await Notification.insertMany(notificationsToCreate);
        }

        // Return a generic success response or the first created one for compatibility
        res.status(201).json({ success: true, count: notificationsToCreate.length, message: `Sent to ${notificationsToCreate.length} users.` });
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
