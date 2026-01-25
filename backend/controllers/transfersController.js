
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';

export const getTransfers = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        
        // Safe Pagination Logic
        const page = parseInt(req.query.page, 10) || 1;
        let limit = parseInt(req.query.limit, 10) || 20;
        if (limit > 100) limit = 100;
        const skip = (page - 1) * limit;

        const query = isAdmin ? {} : { 
            $or: [
                { senderId: req.user?.id }, 
                { recipientId: req.user?.id }
            ] 
        };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, data: [] });
        }

        const totalRecords = await Transfer.countDocuments(query);
        const transfers = await Transfer.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ 
            success: true, 
            count: transfers.length,
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                currentPage: page,
                pageSize: limit
            },
            data: transfers 
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

        if (!sender || !recipient) {
            return res.status(404).json({ success: false, error: 'Sender or recipient not found.' });
        }

        if (sender.status === 'Blocked' || (sender.restrictions && sender.restrictions.transfer)) {
            return res.status(403).json({ success: false, error: `Transfers are currently disabled for your account.` });
        }

        const config = settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [], allowCrossCurrency: false };
        
        if (!config.enabled) {
            return res.status(403).json({ success: false, error: 'Transfers are currently disabled by the administrator.' });
        }
        
        if (sender.currency !== recipient.currency && !config.allowCrossCurrency) {
            return res.status(403).json({ success: false, error: 'Cross-currency transfers are currently disabled by the administrator.' });
        }

        const tier = config.tiers.find(t => 
            t.currency === sender.currency &&
            amount >= t.minAmount && 
            amount <= t.maxAmount && 
            (t.enabled === undefined || t.enabled === true)
        );

        if (!tier) {
            return res.status(400).json({ 
                success: false, 
                error: `Transfer amount of ${sender.currency}${amount} is not within any allowed limits set by the administrator.` 
            });
        }

        let fee = tier.feeType === 'percentage' ? (amount * tier.feeValue) / 100 : tier.feeValue;
        fee = Number(fee.toFixed(2));
        const totalDeduction = Number((amount + fee).toFixed(2));

        if (sender.walletBalance < totalDeduction) {
            return res.status(400).json({ success: false, error: `Insufficient funds. You need ${sender.currency}${totalDeduction.toFixed(2)} (Amount + Fee) but have ${sender.currency}${sender.walletBalance.toFixed(2)}.` });
        }

        sender.walletBalance = Number((sender.walletBalance - totalDeduction).toFixed(2));
        
        const transfer = await Transfer.create({
            ...req.body,
            currency: sender.currency,
            fee: fee,
            totalDeducted: totalDeduction,
            status: 'Pending'
        });

        const transaction = await Transaction.create({
            userId: sender._id,
            userName: sender.username,
            currency: sender.currency,
            type: 'Transfer Request',
            amount: -totalDeduction,
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
        
        const originalTransaction = await Transaction.findOne({
            userId: sender._id,
            type: 'Transfer Request',
            description: { $regex: `Transfer .* #${transfer._id}` },
        });

        if (status === 'Approved') {
            if (!recipient) return res.status(404).json({success: false, error: "Recipient not found"});
            
            const settingsDoc = await Setting.getSettings();
            const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc;
            
            const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.50 };
            const rates = settings.exchangeRates || {};

            const getRate = (curr) => {
                const r = rates[curr];
                if (r !== undefined && r !== null && r !== 0) return r;
                return defaultRates[curr] || 1;
            };

            let receivedAmount = transfer.amount;
            let originalAmountForTx = null;
            let originalCurrencyForTx = null;
            let senderDesc = `Transfer Sent #${transfer._id} to ${recipient.username}`;
            let recipientDesc = `Received from ${sender.username}`;

            if (sender.currency !== recipient.currency) {
                const fromCurrency = sender.currency.toUpperCase();
                const toCurrency = recipient.currency.toUpperCase();
                const fromRate = getRate(fromCurrency);
                const toRate = getRate(toCurrency);
                const amountInUSD = transfer.amount / fromRate;
                receivedAmount = Number((amountInUSD * toRate).toFixed(2));
                originalAmountForTx = transfer.amount;
                originalCurrencyForTx = sender.currency;
                senderDesc += `. Recipient received: ${recipient.currency} ${receivedAmount.toFixed(2)}`;
                recipientDesc += ` (Original: ${sender.currency} ${transfer.amount.toFixed(2)})`;
            }

            recipient.walletBalance = Number((recipient.walletBalance + receivedAmount).toFixed(2));
            await recipient.save();

            if (originalTransaction) {
                originalTransaction.status = 'Approved';
                originalTransaction.description = senderDesc;
                await originalTransaction.save();
            }

            const transactionPayload = {
                userId: recipient._id,
                userName: recipient.username,
                currency: recipient.currency,
                type: 'Transfer Received',
                amount: receivedAmount,
                description: recipientDesc,
                sourceUserId: sender._id,
                status: 'Approved',
                exchangeRate: rates[sender.currency.toUpperCase()] || 1
            };

            if (originalAmountForTx != null && originalCurrencyForTx != null) {
                transactionPayload.originalAmount = originalAmountForTx;
                transactionPayload.originalCurrency = originalCurrencyForTx;
            }

            await Transaction.create(transactionPayload);

            await Notification.create({ 
                userId: sender._id, 
                message: `Your transfer of ${sender.currency}${transfer.amount.toFixed(2)} to ${recipient.username} was approved. (Fee deducted: ${sender.currency}${(transfer.fee || 0).toFixed(2)})` 
            });
            
            await Notification.create({ userId: recipient._id, message: `You received ${recipient.currency}${receivedAmount.toFixed(2)} from ${sender.username}.` });

        } else if (status === 'Rejected') {
            if (!sender) return res.status(404).json({success: false, error: "Sender not found"});
            const refundAmount = transfer.totalDeducted || (transfer.amount + (transfer.fee || 0));
            sender.walletBalance = Number((sender.walletBalance + refundAmount).toFixed(2));
            await sender.save();
            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                originalTransaction.description = `Transfer Rejected #${transfer._id}`;
                await originalTransaction.save();
            }
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
        res.status(200).json({ success: true, data: { transfer, sender, recipient }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
