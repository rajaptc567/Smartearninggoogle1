import PasswordResetRequest from '../models/PasswordResetRequest.js';

export const getPasswordResetRequests = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        if (!isAdmin) {
            return res.status(200).json({ success: true, data: [] });
        }

        const requests = await PasswordResetRequest.find({ status: 'Pending' }).sort({ requestDate: -1 });
        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const deletePasswordResetRequest = async (req, res) => {
    try {
        await PasswordResetRequest.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};