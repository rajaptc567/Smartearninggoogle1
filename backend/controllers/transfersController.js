
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';

const toMoneyInt = (val) => Math.round(parseFloat(val || 0) * 100);
const toMoneyDec = (val) => Number((val / 100).toFixed(2));

export const getTransfers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const totalCount = await Transfer.countDocuments();
        const transfers = await Transfer.find().skip(skip).limit(limit).sort({ date: -1 });
        
        res.status(200).json({ 
            success: true, 
            data: transfers,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createTransfer = async (req, res) => {
    const { senderId, recipientId, amount } = req.body;
    try {
        const sender = await User.findById(senderId);
        const recipient = await User.findById(recipientId);
        const settings = await Setting.getSettings();

        if (!sender || !recipient) return res.status(404).json({ success: false, error: 'Not found.' });
        if (sender.status === 'Blocked' || sender.restrictions?.transfer) return res.status(403).json({ success: false, error: `Transfers disabled.` });

        const config = settings.transferConfig || { enabled: true, tiers: [] };
        if (!config.enabled) return res.status(403).json({ success: false, error: 'Disabled.' });

        const valInt = toMoneyInt(amount);
        const tier = config.tiers.find(t => t.currency === sender.currency && valInt >= toMoneyInt(t.minAmount) && valInt <= toMoneyInt(t.maxAmount));

        if (!tier) return res.status(400).json({ success: false, error: `Amount outside allowed limits.` });

        let feeInt = tier.feeType === 'percentage' ? Math.round((valInt * tier.feeValue) / 100) : toMoneyInt(tier.feeValue);
        const totalDeductionInt = valInt + feeInt;
        const totalDeductionDec = toMoneyDec(totalDeductionInt);

        // ATOMIC SENDER DEDUCTION
        const updatedSender = await User.findOneAndUpdate(
            { _id: senderId, walletBalance: { $gte: totalDeductionDec } },
            { $inc: { walletBalance: -totalDeductionDec } },
            { new: true }
        );

        if (!updatedSender) {
            return res.status(400).json({ success: false, error: `Insufficient funds or concurrent transfer request.` });
        }

        const transfer = await Transfer.create({
            ...req.body,
            amount: toMoneyDec(valInt),
            currency: sender.currency,
            fee: toMoneyDec(feeInt),
            totalDeducted: totalDeductionDec,
            status: 'Pending'
        });

        await Transaction.create({
            userId: sender._id, userName: sender.username, currency: sender.currency,
            type: 'Transfer Request', amount: -totalDeductionDec,
            status: 'Pending', description: `Pending Transfer #${transfer._id}`
        });
        
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { transfer, user: updatedSender }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateTransfer = async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        let transfer = await Transfer.findById(req.params.id);
        if (!transfer || transfer.status !== 'Pending') return res.status(400).json({ success: false, error: 'Already processed.' });

        const sender = await User.findById(transfer.senderId);
        const recipient = await User.findById(transfer.recipientId);
        
        let finalSender = sender;
        let finalRecipient = recipient;
        let finalTransaction = null;

        if (status === 'Approved') {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278.50 };

            let receivedAmountInt = toMoneyInt(transfer.amount);
            if (sender.currency !== recipient.currency) {
                const fromRate = rates[sender.currency.toUpperCase()] || 1;
                const toRate = rates[recipient.currency.toUpperCase()] || 1;
                receivedAmountInt = Math.round((receivedAmountInt / fromRate) * toRate);
            }

            const receivedAmountDec = toMoneyDec(receivedAmountInt);

            // ATOMIC RECIPIENT CREDIT
            finalRecipient = await User.findByIdAndUpdate(recipient._id, { $inc: { walletBalance: receivedAmountDec } }, { new: true });

            await Transaction.findOneAndUpdate({ description: { $regex: transfer._id } }, { status: 'Approved' });
            finalTransaction = await Transaction.create({
                userId: recipient._id, userName: recipient.username, currency: recipient.currency,
                type: 'Transfer Received', amount: receivedAmountDec,
                status: 'Approved', description: `Received from ${sender.username}`
            });
        } else if (status === 'Rejected') {
            // ATOMIC SENDER REFUND
            finalSender = await User.findByIdAndUpdate(sender._id, { $inc: { walletBalance: transfer.totalDeducted } }, { new: true });
            await Transaction.findOneAndUpdate({ description: { $regex: transfer._id } }, { status: 'Rejected' });
        }
        
        transfer.status = status;
        transfer.adminNotes = adminNotes;
        await transfer.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { transfer, sender: finalSender, recipient: finalRecipient, transaction: finalTransaction }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
