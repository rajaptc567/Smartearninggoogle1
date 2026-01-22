
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
        const { senderId, recipientId, amount } = req.body;
        const sender = await User.findById(senderId);
        const settings = await Setting.getSettings();

        // 1. Calculate Fee
        const config = settings.transferConfig;
        const tier = config.tiers.find(t => t.currency === sender.currency && amount >= t.minAmount && amount <= t.maxAmount);
        if (!tier) throw new Error('Amount outside allowed tiers');

        const fee = tier.feeType === 'percentage' ? (amount * tier.feeValue) / 100 : tier.feeValue;
        const totalDeduction = Number((amount + fee).toFixed(2));

        if (sender.walletBalance < totalDeduction) {
            return res.status(400).json({ success: false, error: 'Insufficient balance for amount + fee' });
        }

        // 2. Immediate Deduction (Prevent Double Spend)
        sender.walletBalance = Number((sender.walletBalance - totalDeduction).toFixed(2));
        await sender.save();

        const transfer = await Transfer.create({
            ...req.body,
            fee,
            totalDeducted: totalDeduction,
            currency: sender.currency,
            status: 'Pending'
        });

        const transaction = await Transaction.create({
            userId: sender._id,
            userName: sender.username,
            currency: sender.currency,
            type: 'Transfer Request',
            amount: -totalDeduction,
            status: 'Pending',
            description: `Sent ${amount} to @${req.body.recipientName} (Fee: ${fee})`
        });

        res.status(201).json({ success: true, data: { transfer, user: sender, transaction }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateTransfer = async (req, res) => {
    try {
        const { status } = req.body;
        const oldTransfer = await Transfer.findById(req.params.id);
        if (!oldTransfer || oldTransfer.status !== 'Pending') {
            return res.status(400).json({ success: false, error: 'Transfer not found or already processed' });
        }

        const transfer = await Transfer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        const sender = await User.findById(transfer.senderId);
        const recipient = await User.findById(transfer.recipientId);
        const settings = await Setting.getSettings();

        if (status === 'Approved') {
            // Credit Recipient
            let creditAmount = transfer.amount;
            
            // Handle Cross-Currency Conversion
            if (recipient.currency !== transfer.currency) {
                const fromRate = settings.exchangeRates[transfer.currency] || 1;
                const toRate = settings.exchangeRates[recipient.currency] || 1;
                creditAmount = (creditAmount / fromRate) * toRate;
            }

            recipient.walletBalance = Number((recipient.walletBalance + creditAmount).toFixed(2));
            await recipient.save();

            await Transaction.create({
                userId: recipient._id,
                userName: recipient.username,
                currency: recipient.currency,
                type: 'Transfer Received',
                amount: Number(creditAmount.toFixed(2)),
                status: 'Approved',
                description: `Received from @${transfer.senderName}`
            });
        } 
        else if (status === 'Rejected') {
            // Refund Sender
            sender.walletBalance = Number((sender.walletBalance + transfer.totalDeducted).toFixed(2));
            await sender.save();

            await Transaction.create({
                userId: sender._id,
                userName: sender.username,
                currency: sender.currency,
                type: 'Transfer Refund',
                amount: transfer.totalDeducted,
                status: 'Approved',
                description: `Refund for Rejected Transfer #${transfer._id}`
            });
        }

        res.status(200).json({ success: true, data: { transfer, sender, recipient }});
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
