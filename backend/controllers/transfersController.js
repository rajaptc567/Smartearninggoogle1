
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';
import { sendTemplateNotification } from '../utils/automation.js';

export const getTransfers = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin ? {} : { 
            $or: [
                { senderId: req.user?.id }, 
                { recipientId: req.user?.id }
            ] 
        };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, data: [] });
        }

        const transfers = await Transfer.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: transfers });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createTransfer = async (req, res) => {
    const { senderId, recipientId, amount } = req.body;
    try {
        const loggedInUserId = req.user?.id;
        const requestedSenderId = senderId;
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';

        if (!isAdmin && String(loggedInUserId) !== String(requestedSenderId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot initiate transfer on behalf of other users.' });
        }

        const amountNum = Number(amount);
        if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ success: false, error: 'Please provide a valid, positive transfer amount.' });
        }

        const sender = await User.findById(senderId);
        const recipient = await User.findById(recipientId);
        const settings = await Setting.getSettings();

        if (!sender || !recipient) {
            return res.status(404).json({ success: false, error: 'Sender or recipient not found.' });
        }

        if (String(sender._id) === String(recipient._id)) {
            return res.status(400).json({ success: false, error: 'Cannot transfer funds to yourself.' });
        }

        if (recipient.status === 'Blocked' || recipient.status === 'Banned' || recipient.status === 'Suspended') {
            return res.status(400).json({ success: false, error: 'Recipient account is not eligible to receive transfers.' });
        }

        // 1. Check Investment Module Access
        if (!isAdmin && !canUserAccessInvestmentModule(sender, settings)) {
            return res.status(403).json({
                success: false,
                error: 'The Investment Module is currently disabled. Wallet transfers are unavailable.',
                code: 'INVESTMENT_MODULE_DISABLED'
            });
        }

        // 2. Check User Restrictions
        if (sender.status === 'Blocked' || (sender.restrictions && sender.restrictions.transfer)) {
            return res.status(403).json({ success: false, error: `Transfers are currently disabled for your account.` });
        }

        // 3. Check Global Transfer Settings
        const config = settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [], allowCrossCurrency: false };
        
        if (!config.enabled) {
            return res.status(403).json({ success: false, error: 'Transfers are currently disabled by the administrator.' });
        }
        
        // 3. Check Cross-Currency Setting
        if (sender.currency !== recipient.currency && !config.allowCrossCurrency) {
            return res.status(403).json({ success: false, error: 'Cross-currency transfers are currently disabled by the administrator.' });
        }

        // 3.1 Check Manual/Outside Network Recipient Setting
        if (config.allowManualRecipientEntry === false) {
            const allUsers = await User.find({}).select('username sponsor').lean();
            const downlineUsernames = new Set();
            const buildDownline = (sponsorUsername) => {
                const directRefs = allUsers.filter(u => u.sponsor && u.sponsor.toLowerCase() === sponsorUsername.toLowerCase());
                for (const ref of directRefs) {
                    if (!downlineUsernames.has(ref.username.toLowerCase())) {
                        downlineUsernames.add(ref.username.toLowerCase());
                        buildDownline(ref.username);
                    }
                }
            };
            buildDownline(sender.username);
            if (!downlineUsernames.has(recipient.username.toLowerCase())) {
                return res.status(403).json({ success: false, error: 'Direct transfers to members outside your referral network are currently restricted by the administrator.' });
            }
        }

        // 4. Determine Fee based on Tiers (always based on sender's currency)
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

        // 5. Check Balance
        if (sender.walletBalance < totalDeduction) {
            return res.status(400).json({ success: false, error: `Insufficient funds. You need ${sender.currency}${totalDeduction.toFixed(2)} (Amount + Fee) but have ${sender.currency}${sender.walletBalance.toFixed(2)}.` });
        }

        // 6. Process Transfer
        sender.walletBalance = Number((sender.walletBalance - totalDeduction).toFixed(2));
        
        const transfer = await Transfer.create({
            ...req.body,
            currency: sender.currency, // Transfer is always recorded in sender's currency
            fee: fee,
            totalDeducted: totalDeduction,
            status: 'Pending'
        });

        // 7. Logs & Notifications
        const transaction = await Transaction.create({
            userId: sender._id,
            userName: sender.username,
            currency: sender.currency,
            type: 'Transfer Request',
            amount: -totalDeduction,
            transferId: transfer._id,
            description: `Transfer Request #${transfer._id} to ${recipient.username}. Fee: ${sender.currency}${fee.toFixed(2)}`,
            status: 'Pending'
        });
        
        await Notification.create({
            userId: sender._id,
            message: `Your transfer of ${sender.currency}${amount.toFixed(2)} to ${recipient.username} (Fee: ${sender.currency}${fee.toFixed(2)}) is pending approval.`
        });
        
        await sender.save();

        // Trigger Template Notifications for Transfer Request & Pending
        const transferVariables = {
            amount: amount.toFixed(2),
            currency: sender.currency,
            recipientUsername: recipient.username,
            fee: fee.toFixed(2),
            totalDeducted: totalDeduction.toFixed(2),
            txId: String(transfer._id),
            date: new Date().toLocaleString()
        };
        sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_request_email', variables: transferVariables });
        sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_request_whatsapp', variables: transferVariables });
        sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_pending_email', variables: transferVariables });
        sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_pending_whatsapp', variables: transferVariables });

        res.status(201).json({ success: true, data: { transfer, user: sender, transaction }});

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateTransfer = async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        // Atomic conditional check ensuring status is Pending and transitioning atomically
        const transfer = await Transfer.findOneAndUpdate(
            { _id: req.params.id, status: 'Pending' },
            { $set: { status, adminNotes } },
            { new: false }
        );
        if (!transfer) {
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

            // Correct Conversion Logic (USD is base)
            if (sender.currency !== recipient.currency) {
                const fromCurrency = sender.currency.toUpperCase();
                const toCurrency = recipient.currency.toUpperCase();

                // Step 1: Convert sender's amount to base currency (USD).
                const fromRate = getRate(fromCurrency);
                const toRate = getRate(toCurrency);

                const amountInUSD = transfer.amount / fromRate;
                
                // Step 2: Convert from USD to the recipient's currency.
                receivedAmount = Number((amountInUSD * toRate).toFixed(2));
                
                originalAmountForTx = transfer.amount;
                originalCurrencyForTx = sender.currency;

                // Update Descriptions to reflect exchange
                senderDesc += `. Recipient received: ${recipient.currency} ${receivedAmount.toFixed(2)}`;
                recipientDesc += ` (Original: ${sender.currency} ${transfer.amount.toFixed(2)})`;
            }

            // Add converted funds to recipient
            recipient.walletBalance = Number((recipient.walletBalance + receivedAmount).toFixed(2));
            await recipient.save();

            if (originalTransaction) {
                originalTransaction.status = 'Approved';
                originalTransaction.description = senderDesc;
                await originalTransaction.save();
            }

            // Create Receipt Transaction for Recipient with converted amount
            const transactionPayload = {
                userId: recipient._id,
                userName: recipient.username,
                currency: recipient.currency,
                type: 'Transfer Received',
                amount: receivedAmount,
                transferId: transfer._id,
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

            // Trigger Template Notifications for Approved Transfer
            const approvedSenderVars = {
                amount: transfer.amount.toFixed(2),
                currency: sender.currency,
                recipientUsername: recipient.username,
                recipientFullName: recipient.fullName || '',
                fee: (transfer.fee || 0).toFixed(2),
                totalDeducted: (transfer.totalDeducted || (transfer.amount + (transfer.fee || 0))).toFixed(2),
                txId: String(transfer._id)
            };
            sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_sent_email', variables: approvedSenderVars });
            sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_sent_whatsapp', variables: approvedSenderVars });

            const approvedRecipientVars = {
                amount: receivedAmount.toFixed(2),
                currency: recipient.currency,
                senderUsername: sender.username,
                senderFullName: sender.fullName || '',
                txId: String(transfer._id)
            };
            sendTemplateNotification({ userId: recipient._id, templateKey: 'transfer_received_email', variables: approvedRecipientVars });
            sendTemplateNotification({ userId: recipient._id, templateKey: 'transfer_received_whatsapp', variables: approvedRecipientVars });

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

            // Trigger Template Notifications for Rejected Transfer
            const rejectedSenderVars = {
                amount: transfer.amount.toFixed(2),
                currency: sender.currency,
                recipientUsername: recipient ? recipient.username : 'User',
                notes: adminNotes || 'Verification failed',
                txId: String(transfer._id)
            };
            sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_rejected_email', variables: rejectedSenderVars });
            sendTemplateNotification({ userId: sender._id, templateKey: 'transfer_rejected_whatsapp', variables: rejectedSenderVars });
        }
        
        transfer.status = status;
        transfer.adminNotes = adminNotes;
        await transfer.save();
        
        res.status(200).json({ success: true, data: { transfer, sender, recipient }});

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
