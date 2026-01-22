import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getDisputes = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        let query = {};
        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            return res.status(200).json({ success: true, data: [] });
        }

        const disputes = await Dispute.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: disputes });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const createDispute = async (req, res) => {
    try {
        const disputeData = { ...req.body };
        if (req.file) {
            disputeData.proofUrl = await uploadStream(req.file.buffer, 'disputes');
        }
        const dispute = await Dispute.create(disputeData);
        res.status(201).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateDispute = async (req, res) => {
    try {
        const dispute = await Dispute.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const markAsRead = async (req, res) => {
    try {
        const dispute = await Dispute.findByIdAndUpdate(req.params.id, { [req.body.role === 'admin' ? 'adminUnread' : 'userUnread']: false }, { new: true });
        res.status(200).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};