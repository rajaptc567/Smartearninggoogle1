
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

        // Handle File Upload for Chat
        let attachmentUrl = null;
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const mimeType = req.file.mimetype;
            attachmentUrl = `data:${mimeType};base64,${b64}`;
        }

        // 1. Add New Message (if any text OR attachment)
        if (newMessage || attachmentUrl) {
            const msgSender = sender || 'Admin'; 
            
            dispute.messages.push({
                sender: msgSender,
                message: newMessage || (attachmentUrl ? 'Sent an attachment' : ''),
                attachmentUrl: attachmentUrl
            });
            
            // Update legacy field if Admin sent it
            if (msgSender === 'Admin') {
                dispute.adminResponse = newMessage || 'Sent an attachment';
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
                message: `Your dispute status has changed to ${status}.${newMessage && sender === 'Admin' ? ` Admin Message: ${newMessage}` : ''}`,
                isPopup: status === 'Resolved' || status === 'Closed' 
            });
        } 
        // 3. Notifications for new messages
        else if (newMessage || attachmentUrl) {
            if (sender === 'Admin') {
                // Notify User
                await Notification.create({
                    userId: dispute.userId,
                    subject: `New Message on Dispute #${dispute._id}`,
                    message: `Admin: ${newMessage || 'Sent an attachment'}`,
                    isPopup: false
                });
            } 
        }

        await dispute.save();

        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
