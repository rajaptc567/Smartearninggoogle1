import BulkPopupBroadcast from '../models/BulkPopupBroadcast.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// @desc    Get all bulk popup broadcasts (history and active)
// @route   GET /api/v1/bulk-popups
// @access  Private/Admin
export const getBulkPopups = async (req, res) => {
    try {
        const broadcasts = await BulkPopupBroadcast.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: broadcasts });
    } catch (error) {
        console.error('Error fetching bulk popups:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Create and send a bulk popup broadcast
// @route   POST /api/v1/bulk-popups
// @access  Private/Admin
export const createBulkPopup = async (req, res) => {
    try {
        const {
            subject,
            message,
            imageUrl,
            targetType,
            targetIds,
            targetPlanIds,
            displayTrigger,
            frequency,
            actionButtonText,
            actionButtonLink,
            selectedChannels
        } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message content is required' });
        }

        // Determine recipient users
        let recipientUsers = [];
        if (targetType === 'all') {
            recipientUsers = await User.find({ status: { $ne: 'Banned' } });
        } else if (targetType === 'single' && targetIds && targetIds.length > 0) {
            recipientUsers = await User.find({ _id: { $in: targetIds }, status: { $ne: 'Banned' } });
        } else if (targetType === 'plan' && targetPlanIds && targetPlanIds.length > 0) {
            recipientUsers = await User.find({
                'activePlans.planId': { $in: targetPlanIds },
                status: { $ne: 'Banned' }
            });
        } else if (targetType === 'inactive') {
            recipientUsers = await User.find({
                $or: [{ activePlans: { $size: 0 } }, { activePlans: { $exists: false } }],
                status: { $ne: 'Banned' }
            });
        } else if (targetType === 'country' && targetIds && targetIds.length > 0) {
            recipientUsers = await User.find({ country: { $in: targetIds }, status: { $ne: 'Banned' } });
        } else if (targetType === 'currency' && targetIds && targetIds.length > 0) {
            recipientUsers = await User.find({ currency: { $in: targetIds }, status: { $ne: 'Banned' } });
        } else {
            recipientUsers = await User.find({ status: { $ne: 'Banned' } });
        }

        const notificationsToCreate = recipientUsers.map(user => ({
            userId: user._id,
            senderType: 'Admin',
            subject,
            message,
            imageUrl,
            isPopup: true,
            popupShown: false,
            read: false,
            displayTrigger: displayTrigger || 'login',
            frequency: frequency || 'once_per_user',
            actionButtonText,
            actionButtonLink
        }));

        if (notificationsToCreate.length > 0) {
            await Notification.insertMany(notificationsToCreate);
        }

        // Save broadcast record
        const broadcast = await BulkPopupBroadcast.create({
            subject,
            message,
            imageUrl,
            targetType: targetType || 'all',
            targetIds: targetIds || [],
            targetPlanIds: targetPlanIds || [],
            displayTrigger: displayTrigger || 'login',
            frequency: frequency || 'once_per_user',
            actionButtonText,
            actionButtonLink,
            selectedChannels: selectedChannels || [],
            status: 'active',
            sentCount: recipientUsers.length
        });

        res.status(201).json({
            success: true,
            data: broadcast,
            count: recipientUsers.length,
            message: `Successfully broadcasted to ${recipientUsers.length} users`
        });
    } catch (error) {
        console.error('Error creating bulk popup broadcast:', error);
        res.status(500).json({ success: false, error: error.message || 'Server Error' });
    }
};

// @desc    Update a bulk popup broadcast status or content
// @route   PUT /api/v1/bulk-popups/:id
// @access  Private/Admin
export const updateBulkPopup = async (req, res) => {
    try {
        const broadcast = await BulkPopupBroadcast.findById(req.params.id);
        if (!broadcast) {
            return res.status(404).json({ success: false, error: 'Broadcast not found' });
        }

        const updated = await BulkPopupBroadcast.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating bulk popup:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Delete a bulk popup broadcast record
// @route   DELETE /api/v1/bulk-popups/:id
// @access  Private/Admin
export const deleteBulkPopup = async (req, res) => {
    try {
        const broadcast = await BulkPopupBroadcast.findById(req.params.id);
        if (!broadcast) {
            return res.status(404).json({ success: false, error: 'Broadcast not found' });
        }

        await broadcast.deleteOne();
        res.status(200).json({ success: true, message: 'Broadcast deleted successfully' });
    } catch (error) {
        console.error('Error deleting bulk popup:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
