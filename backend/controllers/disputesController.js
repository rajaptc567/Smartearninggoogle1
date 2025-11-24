
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
        
        // Initialize messages array with the description if desired, 
        // but keeping description separate for title/header often works better.
        // We will initialize an empty messages array.
        disputeData.messages = [];

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

// @desc    Update dispute status or add message (Admin)
// @route   PUT /api/v1/disputes/:id
export const updateDispute = async (req, res) => {
    try {
        const { status, newMessage } = req.body;
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        let statusChanged = false;
        if (status && status !== dispute.status) {
            // Log status change as a system message
            dispute.messages.push({
                sender: 'System',
                message: `Status changed from ${dispute.status} to ${status}`,
                date: new Date()
            });
            dispute.status = status;
            statusChanged = true;
        }

        if (newMessage) {
            dispute.messages.push({
                sender: 'Admin',
                message: newMessage,
                date: new Date()
            });
        }

        await dispute.save();

        // Notify user if status changed or admin replied
        if (statusChanged || newMessage) {
            const msg = newMessage 
                ? `Update on Dispute #${dispute._id}: Admin sent a message.` 
                : `Dispute #${dispute._id} status updated to ${status}.`;
                
            await Notification.create({
                userId: dispute.userId,
                subject: `Dispute Update: #${dispute._id}`,
                message: msg,
                isPopup: statusChanged // Show popup on status change
            });
        }

        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
