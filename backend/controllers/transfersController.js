
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';

export const getTransfers = async (req, res) => {
    try {
        const isMaster = req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        const isAdmin = isMaster || req.user?.role === 'admin';

        let query = {};
        if (!isAdmin && req.user) {
            query = { $or: [{ senderId: req.user.id }, { recipientId: req.user.id }] };
        } else if (!isAdmin) {
            return res.status(200).json({ success: true, data: [] });
        }

        const transfers = await Transfer.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: transfers });
    } catch (err) {
        res.status(200).json({ success: true, data: [] });
    }
};

export const createTransfer = async (req, res) => {
    try {
        const transfer = await Transfer.create(req.body);
        res.status(201).json({ success: true, data: { transfer }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateTransfer = async (req, res) => {
    try {
        const transfer = await Transfer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        // NOTE: Standard user transactions (transfers) do NOT bump global dataVersion
        // only admin-level global changes should trigger a sync.
        res.status(200).json({ success: true, data: { transfer }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
