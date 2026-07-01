import PasswordResetRequest from '../models/PasswordResetRequest.js';

// @desc    Get all password reset requests
// @route   GET /api/v1/password-reset-requests
export const getPasswordResetRequests = async (req, res) => {
    try {
        const requests = await PasswordResetRequest.find({}).sort({ requestDate: -1 });
        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update a password reset request (mark as handled, log process channel/links)
// @route   PUT /api/v1/password-reset-requests/:id
export const updatePasswordResetRequest = async (req, res) => {
    try {
        const { process, sendType, channel, sentAt, status, resetLink, resetToken } = req.body;
        
        const updateData = {};
        if (process !== undefined) updateData.process = process;
        if (sendType !== undefined) updateData.sendType = sendType;
        if (channel !== undefined) updateData.channel = channel;
        if (sentAt !== undefined) updateData.sentAt = sentAt;
        if (status !== undefined) {
            updateData.status = status;
            if (status === 'Handled') {
                updateData.handledAt = new Date();
            }
        }
        if (resetLink !== undefined) updateData.resetLink = resetLink;
        if (resetToken !== undefined) updateData.resetToken = resetToken;
        
        const request = await PasswordResetRequest.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );
        
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: request });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete a password reset request
// @route   DELETE /api/v1/password-reset-requests/:id
export const deletePasswordResetRequest = async (req, res) => {
    try {
        const request = await PasswordResetRequest.findByIdAndDelete(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};