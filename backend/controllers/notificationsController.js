import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
    try {
        let query = {};
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        }

        const notifications = await Notification.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: notifications.length, data: notifications });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const createNotification = async (req, res) => {
    try {
        const created = await Notification.create(req.body);
        res.status(201).json({ success: true, data: [created] });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const markAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.params.userId }, { $set: { read: true } });
        const updated = await Notification.find({ userId: req.params.userId }).sort({ date: -1 });
        res.status(200).json({ success: true, data: updated });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateNotification = async (req, res) => {
    try {
        const n = await Notification.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, data: n });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteNotification = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const markPopupShown = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { popupShown: true });
        const list = await Notification.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: list });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};