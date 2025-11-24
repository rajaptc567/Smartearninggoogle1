
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

// @desc    Update dispute status (Admin)
// @route   PUT /api/v1/disputes/:id
export const updateDispute = async (req, res) => {
    try {
        const { status, adminResponse } = req.body;
        const dispute = await Dispute.findByIdAndUpdate(
            req.params.id,
            { status, adminResponse },
            { new: true }
        );

        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        // Notify user of resolution
        await Notification.create({
            userId: dispute.userId,
            subject: `Dispute Updated: #${dispute._id}`,
            message: `Your dispute has been marked as ${status}. Admin Response: ${adminResponse || 'No comments.'}`,
            isPopup: true // Make it visible
        });

        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
