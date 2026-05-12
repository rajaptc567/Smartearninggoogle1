import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Setting from '../models/Setting.js';

// @desc    Get all pending password reset requests
// @route   GET /api/v1/password-reset-requests
export const getPasswordResetRequests = async (req, res) => {
    try {
        const requests = await PasswordResetRequest.find({ status: 'Pending' }).sort({ requestDate: -1 });
        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete a password reset request (mark as handled)
// @route   DELETE /api/v1/password-reset-requests/:id
export const deletePasswordResetRequest = async (req, res) => {
    try {
        const request = await PasswordResetRequest.findByIdAndDelete(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        await Setting.bumpVersion();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};