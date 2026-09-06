
import mongoose from 'mongoose';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { sendTemplateNotification } from '../utils/automation.js';

const isUserAdmin = (user) => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'super_admin' || user.email === 'studio56.pk@gmail.com';
};

export const getWithdrawals = async (req, res) => {
    try {
        const isAdmin = isUserAdmin(req.user);
        const query = isAdmin ? {} : { userId: req.user?.id };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const withdrawals = await Withdrawal.find(query)
            .sort({ date: -1 })
            .populate({
                path: 'matchedDepositIds',
                select: 'amount date status receiptUrl userName transactionId method'
            });
            
        res.status(200).json({ success: true, count: withdrawals.length, data: withdrawals });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }

        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && withdrawal.userId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to this record' });
        }

        res.status(200).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createWithdrawal = async (req, res) => {
    try {
        const loggedInUserId = req.user?.id;
        const requestedUserId = req.body.userId;
        const isAdmin = isUserAdmin(req.user);

        if (!isAdmin && String(loggedInUserId) !== String(requestedUserId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot withdraw on behalf of other users.' });
        }

        const amountNum = Number(req.body.amount);
        if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ success: false, error: 'Please provide a valid, positive withdrawal amount.' });
        }
        req.body.amount = Number(amountNum.toFixed(2));

        const user = await User.findById(req.body.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.withdrawal)) {
            return res.status(403).json({ success: false, error: `Withdrawals are currently disabled for your account.` });
        }
        
        const settings = await Setting.getSettings();
        if (settings.withdrawalFrequency && settings.withdrawalFrequency.enabled) {
            const { value, unit } = settings.withdrawalFrequency;
            const lastWithdrawal = await Withdrawal.findOne({ userId: user._id }).sort({ date: -1 });
            
            if (lastWithdrawal) {
                const lastDate = new Date(lastWithdrawal.date).getTime();
                const now = Date.now();
                let durationMs = 0;

                switch (unit) {
                    case 'hours': durationMs = value * 60 * 60 * 1000; break;
                    case 'days': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'weeks': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'months': durationMs = value * 30 * 24 * 60 * 60 * 1000; break;
                }

                const nextAllowedTime = lastDate + durationMs;
                
                if (now < nextAllowedTime) {
                    const remainingMs = nextAllowedTime - now;
                    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    let timeString = '';
                    if (days > 0) timeString += `${days} days, `;
                    if (hours > 0) timeString += `${hours} hours, `;
                    timeString += `${minutes} minutes`;

                    return res.status(400).json({ 
                        success: false, 
                        error: `Withdrawal frequency limit reached. You can make your next withdrawal in: ${timeString}.`
                    });
                }
            }
        }

        const isHub = req.body.isHub === 'true' || req.body.isHub === true;

        let sourceWallet = 'Investment';
        let sourceAmount = req.body.amount;
        let balanceBefore = user.walletBalance || 0;
        let balanceAfter = 0;
        let withdrawal = null;
        let transaction = null;

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                if (isHub) {
                    sourceWallet = 'TaskEarnings';
                    const rate = settings?.exchangeRates?.[user.currency] || 1;
                    const reqAmountUSD = Number((user.currency === 'USD' ? req.body.amount : (req.body.amount / (rate || 1))).toFixed(4));
                    sourceAmount = reqAmountUSD;
                    balanceBefore = user.taskEarningsBalance || 0;

                    // Atomic balance check and debit to prevent double spending
                    const updatedUser = await User.findOneAndUpdate(
                        {
                            _id: user._id,
                            status: { $ne: 'Blocked' },
                            'restrictions.withdrawal': { $ne: true },
                            $or: [
                                { taskEarningsBalance: { $gte: reqAmountUSD - 0.001 } },
                                { taskWalletBalance: { $gte: reqAmountUSD - 0.001 } }
                            ]
                        },
                        {
                            $inc: {
                                taskEarningsBalance: -reqAmountUSD,
                                taskWalletBalance: -reqAmountUSD
                            }
                        },
                        { session, new: true }
                    );

                    if (!updatedUser) {
                        const err = new Error('Insufficient Task Earnings / Task Wallet balance');
                        err.code = 'INSUFFICIENT_BALANCE';
                        throw err;
                    }

                    balanceAfter = updatedUser.taskEarningsBalance;
                } else {
                    sourceWallet = 'Investment';
                    balanceBefore = user.walletBalance || 0;

                    // Atomic balance check and debit from Investment main wallet
                    const updatedUser = await User.findOneAndUpdate(
                        {
                            _id: user._id,
                            status: { $ne: 'Blocked' },
                            'restrictions.withdrawal': { $ne: true },
                            walletBalance: { $gte: req.body.amount }
                        },
                        {
                            $inc: { walletBalance: -req.body.amount }
                        },
                        { session, new: true }
                    );

                    if (!updatedUser) {
                        const err = new Error('Insufficient balance');
                        err.code = 'INSUFFICIENT_BALANCE';
                        throw err;
                    }

                    balanceAfter = updatedUser.walletBalance;
                }
                
                const withdrawalData = {
                    ...req.body,
                    isHub,
                    currency: user.currency,
                    sourceWallet,
                    sourceAmount,
                    balanceBefore,
                    balanceAfter
                };
                const [newW] = await Withdrawal.create([withdrawalData], { session });
                withdrawal = newW;
                
                const idempotencyKey = `withdrawal_${newW._id}`;
                const [newTx] = await Transaction.create([{
                    userId: user._id,
                    userName: user.username,
                    currency: user.currency,
                    type: 'Withdrawal Request',
                    amount: -newW.amount,
                    status: 'Pending',
                    withdrawalId: newW._id,
                    sourceWallet,
                    destinationWallet: 'External',
                    balanceBefore,
                    balanceAfter,
                    idempotencyKey,
                    description: `Pending Withdrawal #${newW._id} (${sourceWallet})`
                }], { session });
                transaction = newTx;

                newW.relatedTransactionId = newTx._id;
                await newW.save({ session });
            });
        } catch (txErr) {
            if (txErr.code === 'INSUFFICIENT_BALANCE') {
                return res.status(400).json({ success: false, error: txErr.message });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }

        await Notification.create({
            userId: user._id,
            message: `Your withdrawal request for ${user.currency}${withdrawal.amount.toFixed(2)} has been submitted for review.`
        });

        try {
            const withdrawalVars = {
                amount: withdrawal.amount.toFixed(2),
                currency: user.currency,
                txId: String(withdrawal._id),
                date: new Date().toLocaleString()
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_pending_email', variables: withdrawalVars });
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_pending_whatsapp', variables: withdrawalVars });
        } catch (wNotifErr) {
            console.error('Failed to send withdrawal pending notifications:', wNotifErr);
        }
        
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(201).json({ success: true, data: { withdrawal, user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateWithdrawal = async (req, res) => {
    try {
        if (!isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
        }

        const { status, adminNotes, p2pName, p2pAccountTitle, p2pAccountNumber, p2pInstructions, p2pLogoUrl, p2pCustomFields } = req.body;
        
        let withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        const user = await User.findById(withdrawal.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        const originalStatus = withdrawal.status;

        if (status === 'Matching') {
            const remainingAmount = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;

            const methodData = {
                name: p2pName || `Gateway - ${withdrawal.method}`,
                type: 'Deposit',
                currency: withdrawal.currency,
                accountTitle: p2pAccountTitle || withdrawal.accountTitle,
                accountNumber: p2pAccountNumber || withdrawal.accountNumber,
                minAmount: 1,
                maxAmount: remainingAmount,
                feePercent: 0,
                status: 'Enabled',
                instructions: p2pInstructions || '', 
                logoUrl: p2pLogoUrl || '',
                p2pWithdrawalId: withdrawal._id,
                customFields: p2pCustomFields || []
            };

            if (originalStatus === 'Matching') {
                await PaymentMethod.findOneAndUpdate({ p2pWithdrawalId: withdrawal._id }, methodData);
            } else {
                await PaymentMethod.create(methodData);
                if (withdrawal.matchRemainingAmount === undefined) {
                    withdrawal.matchRemainingAmount = withdrawal.finalAmount;
                }
            }
        }

        if (originalStatus === 'Matching' && status !== 'Matching') {
            await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }

        if (originalStatus === status) {
            withdrawal.adminNotes = adminNotes || withdrawal.adminNotes;
            await withdrawal.save();
            return res.status(200).json({ success: true, data: { withdrawal, user } });
        }
        
        const originalTransaction = await Transaction.findOne({
            userId: user._id,
            type: 'Withdrawal Request',
            description: { $regex: `Withdrawal #${withdrawal._id}` }
        });

        if ((originalStatus === 'Pending' || originalStatus === 'Matching') && status === 'Rejected') {
            const session = await mongoose.startSession();
            let updatedWithdrawal = null;
            let refundedWallet = 'Investment';

            try {
                await session.withTransaction(async () => {
                    const foundW = await Withdrawal.findOneAndUpdate(
                        { _id: req.params.id, status: { $in: ['Pending', 'Matching'] } },
                        { $set: { status: 'Rejected', adminNotes: adminNotes || withdrawal.adminNotes } },
                        { session, new: true }
                    );

                    if (!foundW) {
                        const err = new Error('ALREADY_PROCESSED');
                        err.code = 'ALREADY_PROCESSED';
                        throw err;
                    }
                    updatedWithdrawal = foundW;

                    let currentBalance = 0;

                    if (withdrawal.isHub || withdrawal.sourceWallet === 'TaskEarnings') {
                        refundedWallet = 'TaskEarnings';
                        const settings = await Setting.findOne().session(session);
                        const rate = settings?.exchangeRates?.[withdrawal.currency] || 1;
                        const refundUSD = withdrawal.sourceAmount || (withdrawal.currency === 'USD' ? withdrawal.amount : Number((withdrawal.amount / rate).toFixed(4)));

                        const u = await User.findByIdAndUpdate(user._id, {
                            $inc: {
                                taskEarningsBalance: refundUSD,
                                taskWalletBalance: refundUSD
                            }
                        }, { session, new: true });
                        currentBalance = u?.taskEarningsBalance || 0;
                    } else {
                        refundedWallet = 'Investment';
                        const refundAmount = withdrawal.sourceAmount || withdrawal.amount;

                        const u = await User.findByIdAndUpdate(user._id, {
                            $inc: { walletBalance: refundAmount }
                        }, { session, new: true });
                        currentBalance = u?.walletBalance || 0;
                    }
                    
                    const refundIdempotencyKey = `refund_withdrawal_${withdrawal._id}`;
                    await Transaction.create([{
                        userId: user._id,
                        userName: user.username,
                        currency: user.currency,
                        type: 'Withdrawal Refund',
                        amount: withdrawal.amount,
                        status: 'Approved',
                        withdrawalId: withdrawal._id,
                        sourceWallet: 'External',
                        destinationWallet: refundedWallet,
                        balanceAfter: currentBalance,
                        idempotencyKey: refundIdempotencyKey,
                        description: `Refund for rejected withdrawal #${withdrawal._id} to ${refundedWallet}`
                    }], { session });

                    if (originalTransaction) {
                        await Transaction.findByIdAndUpdate(originalTransaction._id, {
                            $set: {
                                status: 'Rejected',
                                description: `Rejected Withdrawal #${withdrawal._id}`
                            }
                        }, { session });
                    }
                });
            } catch (txErr) {
                if (txErr.code === 'ALREADY_PROCESSED') {
                    const currentW = await Withdrawal.findById(req.params.id);
                    return res.status(200).json({ success: true, data: { withdrawal: currentW, user, message: 'Withdrawal already processed.' } });
                }
                throw txErr;
            } finally {
                await session.endSession();
            }

            await Notification.create({
                userId: user._id,
                message: `Your withdrawal for ${user.currency}${withdrawal.amount.toFixed(2)} was rejected. The amount has been refunded to your ${refundedWallet === 'TaskEarnings' ? 'task wallet' : 'wallet'}.`
            });

            // Send dynamic templated notification in the background
            const variables = {
                amount: withdrawal.amount,
                currency: withdrawal.currency,
                txId: withdrawal._id,
                notes: adminNotes || ''
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_rejected_email', variables }).catch(err => console.error(err));
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_rejected_whatsapp', variables }).catch(err => console.error(err));

            await Setting.bumpVersion();
            req.app.get('io')?.emit('DATA_CHANGED');
            return res.status(200).json({ success: true, data: { withdrawal: updatedWithdrawal, user } });
        }
        
        if (status === 'Paid' || status === 'Approved') {
            const updatedWithdrawal = await Withdrawal.findOneAndUpdate(
                { _id: req.params.id, status: { $ne: status } },
                { $set: { status, adminNotes: adminNotes || withdrawal.adminNotes } },
                { new: true }
            );

            if (!updatedWithdrawal) {
                const currentW = await Withdrawal.findById(req.params.id);
                return res.status(200).json({ success: true, data: { withdrawal: currentW, user, message: 'Withdrawal already updated.' } });
            }

            if (originalTransaction) {
                originalTransaction.status = status === 'Paid' ? 'Approved' : status;
                originalTransaction.description = `${status} Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }
            const message = status === 'Paid' 
                ? `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been successfully paid.`
                : `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been approved.`;
            await Notification.create({ userId: user._id, message });

            // Send dynamic templated notification in the background
            const variables = {
                amount: withdrawal.finalAmount !== undefined ? withdrawal.finalAmount : withdrawal.amount,
                currency: withdrawal.currency,
                txId: withdrawal._id,
                notes: adminNotes || ''
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_success_email', variables }).catch(err => console.error(err));
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_success_whatsapp', variables }).catch(err => console.error(err));

            await Setting.bumpVersion();
            req.app.get('io')?.emit('DATA_CHANGED');
            return res.status(200).json({ success: true, data: { withdrawal: updatedWithdrawal, user } });
        }
        
        withdrawal.status = status;
        withdrawal.adminNotes = adminNotes;
        
        await withdrawal.save();
        await user.save();
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: { withdrawal, user } });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        if (withdrawal.status === 'Matching') {
             await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }
        
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
