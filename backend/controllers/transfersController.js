

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

        // 1. Check User Restrictions
        if (sender.status === 'Blocked' || (sender.restrictions && sender.restrictions.transfer)) {
            return res.status(403).json({ success: false, error: `Transfers are currently disabled for your account.` });
        }

        // ** MULTI-CURRENCY CHECK **
        if (sender.currency !== recipient.currency) {
            return res.status(400).json({ success: false, error: `Cross-currency transfers are not allowed. Both users must have the same currency.` });
        }

        // 2. Check Global Transfer Settings
        const config = settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] };
        
        if (!config.enabled) {
            return res.status(403).json({ success: false, error: 'Transfers are currently disabled by the administrator.' });
        }

        // 3. Determine Fee based on Tiers
        // Find a tier where the amount falls within minAmount and maxAmount AND is enabled
        const tier = config.tiers.find(t => 
            amount >= t.minAmount && 
            amount <= t.maxAmount && 
            (t.enabled === undefined || t.enabled === true) // Default to true if missing
        );

        if (!tier) {
            return res.status(400).json({ 
                success: false, 
                error: `Transfer amount of ${sender.currency}${amount} is not within any allowed limits set by the administrator.` 
            });
        }

        let fee = 0;
        if (tier.feeType === 'percentage') {
            fee = (amount * tier.feeValue) / 100;
        } else {
            fee = tier.feeValue;
        }

        // Precision Rounding
        fee = Number(fee.toFixed(2));
        const totalDeduction = Number((amount + fee).toFixed(2));

        // 4. Check Balance
        if (sender.walletBalance < totalDeduction) {
            return res.status(400).json({ success: false, error: `Insufficient funds. You need ${sender.currency}${totalDeduction.toFixed(2)} (Amount + Fee) but have ${sender.currency}${sender.walletBalance.toFixed(2)}.` });
        }

        // 5. Process Transfer
        sender.walletBalance = Number((sender.walletBalance - totalDeduction).toFixed(2));
        // Recipient balance will be updated on approval
        // recipient.walletBalance = Number((recipient.walletBalance + amount).toFixed(2));
        
        const transfer = await Transfer.create({
            ...req.body,
            currency: sender.currency,
            fee: fee,
            totalDeducted: totalDeduction,
            status: 'Pending' // Default to Pending for admin review
        });

        // 6. Logs & Notifications
        const transaction = await Transaction.create({
            userId: sender._id,
            userName: sender.username,
            currency: sender.currency,
            type: 'Transfer Request',
            amount: -totalDeduction, // Deduct total
            description: `Transfer Request #${transfer._id} to ${recipient.username}. Fee: ${sender.currency}${fee.toFixed(2)}`,
            status: 'Pending'
        });
        
        await Notification.create({
            userId: sender._id,
            message: `Your transfer of ${sender.currency}${amount.toFixed(2)} to ${recipient.username} (Fee: ${sender.currency}${fee.toFixed(2)}) is pending approval.`
        });
        
        await sender.save();

        res.status(201).json({ success: true, data: { transfer, user: sender, transaction }});

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
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
        
        // Fetch original transaction to update status
        const originalTransaction = await Transaction.findOne({
            userId: sender._id,
            type: 'Transfer Request',
            description: { $regex: `Transfer .* #${transfer._id}` },
        });

        if (status === 'Approved') {
            if (!recipient) return res.status(404).json({success: false, error: "Recipient not found"});

            // Add funds to recipient
            recipient.walletBalance = Number((recipient.walletBalance + transfer.amount).toFixed(2));
            await recipient.save();

            if (originalTransaction) {
                originalTransaction.status = 'Approved';
                originalTransaction.description = `Transfer Sent #${transfer._id} to ${recipient.username}`;
                await originalTransaction.save();
            }

            // Create Receipt Transaction for Recipient
            const recipientTx = await Transaction.create({
                userId: recipient._id,
                userName: recipient.username,
                currency: recipient.currency,
                type: 'Transfer Received',
                amount: transfer.amount,
                description: `Received from ${sender.username}`,
                status: 'Approved'
            });

            await Notification.create({ 
                userId: sender._id, 
                message: `Your transfer of ${sender.currency}${transfer.amount.toFixed(2)} to ${recipient.username} was approved. (Fee deducted: ${sender.currency}${(transfer.fee || 0).toFixed(2)})` 
            });
            
            await Notification.create({ userId: recipient._id, message: `You received ${recipient.currency}${transfer.amount.toFixed(2)} from ${sender.username}.` });
            
            // Return recipient tx for frontend state update if needed
            // (For now we just return basic objects)

        } else if (status === 'Rejected') {
            if (!sender) return res.status(404).json({success: false, error: "Sender not found"});

            // Refund Sender (Total Deducted amount which includes fee)
            // Fallback to Amount + Fee if totalDeducted missing (legacy data)
            const refundAmount = transfer.totalDeducted || (transfer.amount + (transfer.fee || 0));
            
            sender.walletBalance = Number((sender.walletBalance + refundAmount).toFixed(2));
            await sender.save();

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                originalTransaction.description = `Transfer Rejected #${transfer._id}`;
                await originalTransaction.save();
            }
            
            // Create Refund Record
            await Transaction.create({
                userId: sender._id,
                userName: sender.username,
                currency: sender.currency,
                type: 'Transfer Refund',
                amount: refundAmount,
                status: 'Approved',
                description: `Refund for rejected transfer #${transfer._id}`
            });

            await Notification.create({ userId: sender._id, message: `Your transfer to ${recipient ? recipient.username : 'User'} was rejected and funds (${sender.currency}${refundAmount.toFixed(2)}) returned.` });
        }
        
        transfer.status = status;
        transfer.adminNotes = adminNotes;
        await transfer.save();
        
        res.status(200).json({ success: true, data: { transfer, sender, recipient }}); // simplified return

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};