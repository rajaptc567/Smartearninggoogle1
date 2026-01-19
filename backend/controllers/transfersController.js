
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';

export const getTransfers = async (req, res) => {
    try {
        const transfers = await Transfer.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: transfers });
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

        if (!sender || !recipient) {
            return res.status(404).json({ success: false, error: 'Sender or recipient not found.' });
        }

        if (sender.status === 'Blocked' || (sender.restrictions && sender.restrictions.transfer)) {
            return res.status(403).json({ success: false, error: `Transfers are currently disabled for your account.` });
        }

        const config = settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [], allowCrossCurrency: false };
        
        if (!config.enabled) return res.status(403).json({ success: false, error: 'Transfers are currently disabled.' });
        
        if (sender.currency !== recipient.currency && !config.allowCrossCurrency) {
            return res.status(403).json({ success: false, error: 'Cross-currency transfers are currently disabled.' });
        }

        const tier = config.tiers.find(t => 
            t.currency === sender.currency &&
            amount >= t.minAmount && 
            amount <= t.maxAmount && 
            (t.enabled === undefined || t.enabled === true)
        );

        if (!tier) return res.status(400).json({ success: false, error: `Transfer amount not within allowed limits.` });

        let fee = tier.feeType === 'percentage' ? (amount * tier.feeValue) / 100 : tier.feeValue;
        fee = Number(fee.toFixed(2));
        const totalDeduction = Number((amount + fee).toFixed(2));

        if (sender.walletBalance < totalDeduction) {
            return res.status(400).json({ success: false, error: `Insufficient funds.` });
        }

        // ATOMIC SENDER DEDUCTION
        const updatedSender = await User.findByIdAndUpdate(senderId, { $inc: { walletBalance: -totalDeduction } }, { new: true });
        
        const transfer = await Transfer.create({
            ...req.body,
            currency: sender.currency,
            fee: fee,
            totalDeducted: totalDeduction,
            status: 'Pending'
        });

        await Transaction.create({
            userId: sender._id, userName: sender.username, currency: sender.currency,
            type: 'Transfer Request', amount: -totalDeduction,
            description: `Transfer Request #${transfer._id} to ${recipient.username}. Fee: ${sender.currency}${fee.toFixed(2)}`,
            status: 'Pending'
        });
        
        await Notification.create({
            userId: sender._id,
            message: `Your transfer of ${sender.currency}${amount.toFixed(2)} to ${recipient.username} is pending approval.`
        });
        
        res.status(201).json({ success: true, data: { transfer, user: updatedSender, transaction: {} }});

    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateTransfer = async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        let transfer = await Transfer.findById(req.params.id);
        if (!transfer || transfer.status !== 'Pending') {
            return res.status(400).json({ success: false, error: 'Transfer not found or already processed.' });
        }

        const sender = await User.findById(transfer.senderId);
        const recipient = await User.findById(transfer.recipientId);
        
        const originalTransaction = await Transaction.findOne({
            userId: transfer.senderId,
            type: 'Transfer Request',
            description: { $regex: `Transfer .* #${transfer._id}` },
        });

        let updatedSender = sender;
        let updatedRecipient = recipient;

        if (status === 'Approved') {
            if (!recipient) return res.status(404).json({success: false, error: "Recipient not found"});
            
            const settings = await Setting.getSettings();
            const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.50 };
            const rates = settings.exchangeRates || {};
            const getRate = (curr) => {
                const r = rates[curr];
                if (r !== undefined && r !== null && r !== 0) return r;
                return defaultRates[curr] || 1;
            };

            let receivedAmount = transfer.amount;
            if (sender.currency !== recipient.currency) {
                const fromRate = getRate(sender.currency.toUpperCase());
                const toRate = getRate(recipient.currency.toUpperCase());
                receivedAmount = Number(((transfer.amount / fromRate) * toRate).toFixed(2));
            }

            // ATOMIC RECIPIENT ADDITION
            updatedRecipient = await User.findByIdAndUpdate(transfer.recipientId, { $inc: { walletBalance: receivedAmount } }, { new: true });

            if (originalTransaction) {
                originalTransaction.status = 'Approved';
                await originalTransaction.save();
            }

            await Transaction.create({
                userId: recipient._id, userName: recipient.username, currency: recipient.currency,
                type: 'Transfer Received', amount: receivedAmount,
                description: `Received from ${sender.username}`, sourceUserId: sender._id,
                status: 'Approved'
            });

            await Notification.create({ 
                userId: sender._id, message: `Your transfer to ${recipient.username} was approved.` 
            });
            await Notification.create({ userId: recipient._id, message: `You received ${recipient.currency}${receivedAmount.toFixed(2)} from ${sender.username}.` });

        } else if (status === 'Rejected') {
            const refundAmount = transfer.totalDeducted || (transfer.amount + (transfer.fee || 0));
            // ATOMIC SENDER REFUND
            updatedSender = await User.findByIdAndUpdate(transfer.senderId, { $inc: { walletBalance: Number(refundAmount.toFixed(2)) } }, { new: true });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                await originalTransaction.save();
            }
            
            await Transaction.create({
                userId: sender._id, userName: sender.username, currency: sender.currency,
                type: 'Transfer Refund', amount: refundAmount, status: 'Approved',
                description: `Refund for rejected transfer #${transfer._id}`
            });

            await Notification.create({ userId: sender._id, message: `Your transfer was rejected and funds returned.` });
        }
        
        transfer.status = status;
        transfer.adminNotes = adminNotes;
        await transfer.save();
        
        res.status(200).json({ success: true, data: { transfer, sender: updatedSender, recipient: updatedRecipient }});

    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
