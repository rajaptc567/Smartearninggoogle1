
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';
import { sendTemplateNotification } from '../utils/automation.js';

export const getDeposits = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        const query = isAdmin ? {} : { userId: req.user?.id };
        
        // If not admin and no user ID found in token, return empty
        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const deposits = await Deposit.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: deposits.length, data: deposits });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
        
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin && deposit.userId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to this record' });
        }

        res.status(200).json({ success: true, data: deposit });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createDeposit = async (req, res) => {
    try {
        const depositData = { ...req.body };
        if (depositData.isHub === 'true' || depositData.isHub === true) {
            depositData.isHub = true;
        } else {
            depositData.isHub = false;
        }
        if (depositData.confirmationAnswers && typeof depositData.confirmationAnswers === 'string') {
            try {
                depositData.confirmationAnswers = JSON.parse(depositData.confirmationAnswers);
            } catch (e) {
                console.error("Failed to parse confirmationAnswers", e);
                depositData.confirmationAnswers = {};
            }
        }

        const loggedInUserId = req.user?.id;
        const requestedUserId = depositData.userId;
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

        if (!isAdmin && String(loggedInUserId) !== String(requestedUserId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot submit deposit on behalf of other users.' });
        }

        const user = await User.findById(depositData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        const amountNum = Number(depositData.amount);
        if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ success: false, error: 'Please provide a valid, positive deposit amount.' });
        }
        depositData.amount = Number(amountNum.toFixed(2));

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.deposit)) {
            return res.status(403).json({ success: false, error: `Deposits disabled.` });
        }
        
        depositData.currency = user.currency;

        if (req.file) {
            try {
                depositData.receiptUrl = await uploadStream(req.file.buffer, 'deposits');
            } catch (uploadErr) {
                return res.status(500).json({ success: false, error: 'Image upload to Cloudinary failed.' });
            }
        }

        const deposit = await Deposit.create(depositData);
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Deposit',
            amount: deposit.amount,
            status: 'Pending',
            depositId: deposit._id,
            description: `Pending Deposit #${deposit._id}`
        });
        
        await Notification.create({
            userId: deposit.userId,
            message: `Your deposit request #${deposit._id} is pending review.`
        });

        try {
            const depositVars = {
                amount: deposit.amount.toFixed(2),
                currency: user.currency,
                txId: String(deposit._id),
                date: new Date().toLocaleString()
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'deposit_pending_email', variables: depositVars });
            sendTemplateNotification({ userId: user._id, templateKey: 'deposit_pending_whatsapp', variables: depositVars });
        } catch (depNotifErr) {
            console.error('Failed to send deposit pending notifications:', depNotifErr);
        }

        if (deposit.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
            if (withdrawal) {
                const currentRemaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
                withdrawal.matchRemainingAmount = Number((currentRemaining - deposit.amount).toFixed(2));
                if (!withdrawal.matchedDepositIds) withdrawal.matchedDepositIds = [];
                withdrawal.matchedDepositIds.push(deposit._id);
                await withdrawal.save();

                if (withdrawal.matchRemainingAmount <= 0) {
                    await PaymentMethod.findOneAndDelete({ p2pWithdrawalId: withdrawal._id });
                }
            }
        }
        
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(201).json({ success: true, data: { deposit, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateDeposit = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });

        const originalStatus = deposit.status;

        if (originalStatus === status) {
            deposit.adminNotes = adminNotes !== undefined ? adminNotes : deposit.adminNotes;
            await deposit.save();
            return res.status(200).json({ success: true, data: { deposit } });
        }

        if (status === 'Approved' && originalStatus !== 'Approved') {
            // Atomic conditional update ensuring only one approval executes
            const updatedDeposit = await Deposit.findOneAndUpdate(
                { _id: req.params.id, status: { $ne: 'Approved' } },
                { $set: { status: 'Approved', adminNotes: adminNotes !== undefined ? adminNotes : deposit.adminNotes } },
                { new: true }
            );

            if (!updatedDeposit) {
                const currentDep = await Deposit.findById(req.params.id);
                return res.status(200).json({ success: true, data: { deposit: currentDep, message: 'Deposit already approved.' } });
            }

            let user = await User.findById(deposit.userId);
            if (user) {
                if (deposit.isHub) {
                    user.taskWalletBalance = Number((user.taskWalletBalance + deposit.amount).toFixed(2));
                } else {
                    user.walletBalance = Number((user.walletBalance + deposit.amount).toFixed(2));
                }
                await user.save();
            }

            await Transaction.findOneAndUpdate(
                { $or: [{ depositId: deposit._id }, { description: { $regex: deposit._id } }] },
                { $set: { status: 'Approved', depositId: deposit._id } }
            );
            
            // Send dynamic templated notification in the background
            const variables = {
                amount: deposit.amount,
                currency: deposit.currency,
                txId: deposit.transactionId || deposit._id,
                notes: adminNotes || ''
            };
            sendTemplateNotification({ userId: deposit.userId, templateKey: 'deposit_success_email', variables }).catch(err => console.error(err));
            sendTemplateNotification({ userId: deposit.userId, templateKey: 'deposit_success_whatsapp', variables }).catch(err => console.error(err));

            await Setting.bumpVersion();
            req.app.get('io')?.emit('DATA_CHANGED');
            return res.status(200).json({ success: true, data: { deposit: updatedDeposit, user } });
        } else if (status === 'Rejected' && originalStatus !== 'Rejected') {
            const updatedDeposit = await Deposit.findOneAndUpdate(
                { _id: req.params.id, status: { $ne: 'Rejected' } },
                { $set: { status: 'Rejected', adminNotes: adminNotes !== undefined ? adminNotes : deposit.adminNotes } },
                { new: true }
            );

            if (!updatedDeposit) {
                const currentDep = await Deposit.findById(req.params.id);
                return res.status(200).json({ success: true, data: { deposit: currentDep, message: 'Deposit already rejected.' } });
            }

            await Transaction.findOneAndUpdate(
                { $or: [{ depositId: deposit._id }, { description: { $regex: deposit._id } }] },
                { $set: { status: 'Rejected', depositId: deposit._id } }
            );
            
            // Send dynamic templated notification in the background
            const variables = {
                amount: deposit.amount,
                currency: deposit.currency,
                txId: deposit.transactionId || deposit._id,
                notes: adminNotes || ''
            };
            sendTemplateNotification({ userId: deposit.userId, templateKey: 'deposit_rejected_email', variables }).catch(err => console.error(err));
            sendTemplateNotification({ userId: deposit.userId, templateKey: 'deposit_rejected_whatsapp', variables }).catch(err => console.error(err));

            await Setting.bumpVersion();
            req.app.get('io')?.emit('DATA_CHANGED');
            return res.status(200).json({ success: true, data: { deposit: updatedDeposit } });
        }

        deposit.status = status;
        if (adminNotes !== undefined) deposit.adminNotes = adminNotes;
        await deposit.save();
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: { deposit } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteDeposit = async (req, res) => {
    try {
        await Deposit.findByIdAndDelete(req.params.id);
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
