
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

// @desc    Update dispute status (Admin)
// @route   PUT /api/v1/disputes/:id
export const updateDispute = async (req, res) => {
    try {
        const { status, newMessage, sender } = req.body;
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        // 1. Add New Message (if any)
        if (newMessage) {
            const messageData = {
                sender: sender || 'Admin', // Default to Admin for backward compatibility
                message: newMessage
            };

            if (req.file) {
                const b64 = Buffer.from(req.file.buffer).toString('base64');
                const mimeType = req.file.mimetype;
                messageData.attachmentUrl = `data:${mimeType};base64,${b64}`;
            }

            dispute.messages.push(messageData);
            
            // Update the legacy adminResponse field for table summaries if admin sent it
            if (sender !== 'User') {
                dispute.adminResponse = newMessage; 
            }
        }

        // 2. Handle Status Change
        if (status && status !== dispute.status) {
            dispute.status = status;
            
            // Log status change in chat history
            dispute.messages.push({
                sender: 'System',
                message: `Status changed to: ${status}`
            });

            // Notify user of resolution/update
            await Notification.create({
                userId: dispute.userId,
                subject: `Dispute Update: #${dispute._id}`,
                message: `Your dispute status has changed to ${status}.${newMessage ? ` Admin Message: ${newMessage}` : ''}`,
                isPopup: status === 'Resolved' || status === 'Closed' // Make final resolutions popup
            });
        } else if (newMessage && sender !== 'User') {
            // Notify user of new message only (if not sent by themselves)
             await Notification.create({
                userId: dispute.userId,
                subject: `New Message on Dispute #${dispute._id}`,
                message: `Admin: ${newMessage}`,
                isPopup: false
            });
        }

        await dispute.save();

        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
