
import PaymentMethod from '../models/PaymentMethod.js';

export const getPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find();
        res.status(200).json({ success: true, data: methods });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createPaymentMethod = async (req, res) => {
    try {
        const method = await PaymentMethod.create(req.body);
        res.status(201).json({ success: true, data: method });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updatePaymentMethod = async (req, res) => {
    try {
        const method = await PaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!method) return res.status(404).json({ success: false, error: 'Payment method not found' });
        res.status(200).json({ success: true, data: method });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deletePaymentMethod = async (req, res) => {
    try {
        const method = await PaymentMethod.findByIdAndDelete(req.params.id);
        if (!method) return res.status(404).json({ success: false, error: 'Payment method not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
