
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';

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

        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const mimeType = req.file.mimetype;
            disputeData.proofUrl = `data:${mimeType};base64,${b64}`;
        }
        
        // Initialize messages array with the description as the opening message from user
        disputeData.messages = [{ 
            sender: 'User', 
            message: disputeData.description,
            attachmentUrl: disputeData.proofUrl // Optionally attach proof to first message too
        }];

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

// @desc    Update dispute status (Admin) or Add Message (User/Admin)
// @route   PUT /api/v1/disputes/:id
export const updateDispute = async (req, res) => {
    try {
        const { status, newMessage, sender } = req.body;
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        // 1. Add New Message (if any)
        if (newMessage || req.file) {
            const msgObj = {
                sender: sender || 'Admin', // Default to Admin if not specified
                message: newMessage || (req.file ? 'Sent an attachment' : ''),
                attachmentUrl: undefined
            };

            if (req.file) {
                const b64 = Buffer.from(req.file.buffer).toString('base64');
                const mimeType = req.file.mimetype;
                msgObj.attachmentUrl = `data:${mimeType};base64,${b64}`;
            }

            dispute.messages.push(msgObj);
            
            // Update legacy field for admin responses only
            if (msgObj.sender === 'Admin') {
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
                message: `Your dispute status has changed to ${status}.`,
                isPopup: status === 'Resolved' || status === 'Closed'
            });
        } 
        
        // Notification logic for new messages
        if (newMessage || req.file) {
            if (sender === 'Admin') {
                await Notification.create({
                    userId: dispute.userId,
                    subject: `New Message on Dispute #${dispute._id}`,
                    message: `Admin: ${newMessage || 'Sent an attachment'}`,
                    isPopup: false
                });
            } 
            // If sender is User, we might want to notify Admins in a real app (via socket or email)
        }

        await dispute.save();

        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
