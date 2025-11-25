
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// @desc    Get all disputes (Admin)
// @route   GET /api/v1/disputes
export const getDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: disputes });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create a dispute (User)
// @route   POST /api/v1/disputes
export const createDispute = async (req, res) => {
    try {
        const disputeData = { ...req.body };

        // Check restrictions
        const user = await User.findById(disputeData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.dispute)) {
            return res.status(403).json({ success: false, error: 'You are currently restricted from raising new disputes.' });
        }

        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const mimeType = req.file.mimetype;
            disputeData.proofUrl = `data:${mimeType};base64,${b64}`;
        }
        
        // When a user creates a dispute, it is unread for the admin.
        disputeData.adminUnread = true;
        disputeData.userUnread = false;

        const dispute = await Dispute.create(disputeData);

        // Notify user
        await Notification.create({
            userId: dispute.userId,
            message: `Dispute #${dispute._id} regarding ${dispute.type} has been submitted. Admin will review it shortly.`
        });

        res.status(201).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update dispute status or add message (Admin/User)
// @route   PUT /api/v1/disputes/:id
export const updateDispute = async (req, res) => {
    try {
        const { status, newMessage, sender } = req.body;
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        let notificationMessage = '';
        let notificationSubject = '';

        // 1. Add New Message (if any)
        if (newMessage || req.file) {
            const messageData = {
                sender: sender || 'Admin', // Default to Admin if sender is not specified
                message: newMessage || '' // Message can be empty if only a file is sent
            };

            if (req.file) {
                const b64 = Buffer.from(req.file.buffer).toString('base64');
                const mimeType = req.file.mimetype;
                messageData.attachmentUrl = `data:${mimeType};base64,${b64}`;
                 if (!newMessage) messageData.message = 'File attached';
            }

            if (!dispute.messages) dispute.messages = [];
            dispute.messages.push(messageData);
            
            // Set unread flags based on sender
            if (messageData.sender === 'Admin') {
                dispute.userUnread = true;
                notificationSubject = `New Message on Dispute #${dispute._id}`;
                notificationMessage = `Admin: ${messageData.message}`;
            } else { // 'User'
                dispute.adminUnread = true;
                // Admin doesn't get a bell notification, they see it in the panel.
            }
        }

        // 2. Handle Status Change
        if (status && status !== dispute.status) {
            const oldStatus = dispute.status;
            dispute.status = status;
            
            if (!dispute.messages) dispute.messages = [];
            dispute.messages.push({
                sender: 'System',
                message: `Status changed from ${oldStatus} to ${status}`
            });
            
            dispute.userUnread = true; // Notify user of status change
            notificationSubject = `Dispute Update: #${dispute._id}`;
            notificationMessage = `Your dispute status has changed to ${status}.`;
        }
        
        await dispute.save();
        
        // Send notification to user if there's something to send
        if (notificationMessage && notificationSubject) {
            await Notification.create({
                userId: dispute.userId,
                subject: notificationSubject,
                message: notificationMessage,
                isPopup: status === 'Resolved' || status === 'Closed'
            });
        }


        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Mark a dispute as read by a role
// @route   PUT /api/v1/disputes/:id/read
export const markAsRead = async (req, res) => {
    try {
        const { role } = req.body; // 'admin' or 'user'
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        if (role === 'admin') {
            dispute.adminUnread = false;
        } else if (role === 'user') {
            dispute.userUnread = false;
        } else {
            return res.status(400).json({ success: false, error: 'Invalid role provided.' });
        }

        await dispute.save();
        res.status(200).json({ success: true, data: dispute });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
