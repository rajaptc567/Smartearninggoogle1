
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: disputes });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createDispute = async (req, res) => {
    try {
        const disputeData = { ...req.body };
        const user = await User.findById(disputeData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.dispute)) {
            return res.status(403).json({ success: false, error: 'Restricted.' });
        }

        // NEW: CLOUDINARY FOR INITIAL PROOF
        if (req.file) {
            try {
                disputeData.proofUrl = await uploadStream(req.file.buffer, 'disputes');
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Cloudinary upload failed.' });
            }
        }
        
        disputeData.adminUnread = true;
        disputeData.userUnread = false;

        const dispute = await Dispute.create(disputeData);
        await Notification.create({ userId: dispute.userId, message: `Dispute #${dispute._id} submitted.` });
        await Setting.bumpVersion();
        res.status(201).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateDispute = async (req, res) => {
    try {
        const { status, newMessage, sender } = req.body;
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, error: 'Not found' });

        if (newMessage || req.file) {
            const messageData = { sender: sender || 'Admin', message: newMessage || '' };

            // NEW: CLOUDINARY FOR CHAT ATTACHMENTS
            if (req.file) {
                try {
                    messageData.attachmentUrl = await uploadStream(req.file.buffer, 'disputes/chat');
                    if (!newMessage) messageData.message = 'File attached';
                } catch (err) {
                    return res.status(500).json({ success: false, error: 'Attachment upload failed.' });
                }
            }

            if (!dispute.messages) dispute.messages = [];
            dispute.messages.push(messageData);
            
            if (messageData.sender === 'Admin') dispute.userUnread = true;
            else dispute.adminUnread = true;
        }

        if (status && status !== dispute.status) {
            dispute.status = status;
            dispute.messages.push({ sender: 'System', message: `Status: ${status}` });
            dispute.userUnread = true;
        }
        
        await dispute.save();
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const markAsRead = async (req, res) => {
    try {
        const { role } = req.body;
        const dispute = await Dispute.findById(req.params.id);
        if (role === 'admin') dispute.adminUnread = false;
        else dispute.userUnread = false;
        await dispute.save();
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
