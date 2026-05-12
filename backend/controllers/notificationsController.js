
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';

// @desc    Get notifications scoped by user role
// @route   GET /api/v1/notifications
export const getNotifications = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin ? {} : { userId: req.user?.id };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const notifications = await Notification.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: notifications.length, data: notifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create a notification (Admin message, single or bulk)
// @route   POST /api/v1/notifications
export const createNotification = async (req, res) => {
    try {
        const { userId, message, subject, isPopup, targetType, targetIds, randomCount } = req.body;
        
        let notificationsToCreate = [];
        const senderType = 'Admin'; // Messages sent via this endpoint are always from an Admin

        // CASE 1: Single User (Legacy or specific selection)
        if (userId) {
             const user = await User.findById(userId);
             if (!user) return res.status(404).json({ success: false, error: 'User not found' });
             notificationsToCreate.push({ userId, senderType, message, subject, isPopup, popupShown: false, read: false });
        } 
        // CASE 2: Bulk Messaging
        else if (targetType) {
            let users = [];
            let query = {};
            
            if (targetType === 'all') {
                query = {}; // Select all users
                users = await User.find(query).select('_id');
            } else if (targetType === 'plan' && targetIds && targetIds.length > 0) {
                // Select users who have ANY of the selected plans in their activePlans array
                query = { 'activePlans.planId': { $in: targetIds } };
                users = await User.find(query).select('_id');
            } else if (targetType === 'single' && targetIds && targetIds.length > 0) {
                query = { _id: { $in: targetIds } };
                users = await User.find(query).select('_id');
            } else if (targetType === 'inactive') {
                query = { 
                    $or: [
                        { activePlans: { $exists: false } }, 
                        { activePlans: { $size: 0 } }
                    ] 
                };
                let inactiveUsers = await User.find(query).select('_id');

                const count = randomCount ? parseInt(randomCount, 10) : 0;
                if (count > 0 && count < inactiveUsers.length) {
                    // Fisher-Yates shuffle algorithm
                    for (let i = inactiveUsers.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [inactiveUsers[i], inactiveUsers[j]] = [inactiveUsers[j], inactiveUsers[i]];
                    }
                    users = inactiveUsers.slice(0, count);
                } else {
                    users = inactiveUsers;
                }
            } else {
                return res.status(400).json({ success: false, error: 'Invalid target configuration' });
            }
            
            notificationsToCreate = users.map(u => ({
                userId: u._id,
                senderType,
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
            const created = await Notification.insertMany(notificationsToCreate);
            await Setting.bumpVersion();
            // Return all newly created notifications so frontend state can be updated
            return res.status(201).json({ success: true, count: created.length, data: created });
        }

        res.status(200).json({ success: true, count: 0, data: [], message: 'No users matched the criteria.' });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Mark notifications as read for a user (Bulk)
// @route   PUT /api/v1/notifications/read/:userId
export const markAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.params.userId, read: false },
            { $set: { read: true } }
        );
        await Setting.bumpVersion();
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin ? {} : { userId: req.user?.id };
        const updatedNotifications = await Notification.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: updatedNotifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update a single notification (e.g., mark as read)
// @route   PUT /api/v1/notifications/:id
export const updateNotification = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!notification) return res.status(404).json({ success: false, error: "Notification not found" });
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: notification });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete a single notification
// @route   DELETE /api/v1/notifications/:id
export const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndDelete(req.params.id);
        if (!notification) return res.status(404).json({ success: false, error: "Notification not found" });
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: {} });
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
        
        await Setting.bumpVersion();
        
        // Return updated list for frontend sync
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin ? {} : { userId: req.user?.id };
        const notifications = await Notification.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: notifications });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
