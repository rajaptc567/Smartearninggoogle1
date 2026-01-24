
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

const toMoneyInt = (val) => Math.round(parseFloat(val || 0) * 100);
const toMoneyDec = (val) => Number((val / 100).toFixed(2));

export const getDeposits = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const isAdmin = req.user.email === 'studio56.pk@gmail.com' || req.user.username === 'admin';
        const filter = isAdmin ? {} : { userId: req.user._id };

        const totalCount = await Deposit.countDocuments(filter);
        const deposits = await Deposit.find(filter).skip(skip).limit(limit).sort({ date: -1 });

        res.status(200).json({ 
            success: true, 
            count: deposits.length, 
            data: deposits,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
        
        const isAdmin = req.user.email === 'studio56.pk@gmail.com' || req.user.username === 'admin';
        if (!isAdmin && deposit.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Access Denied' });
        }

        res.status(200).json({ success: true, data: deposit });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createDeposit = async (req, res) => {
    try {
        const depositData = { ...req.body };
        const user = await User.findById(depositData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.deposit)) {
            return res.status(403).json({ success: false, error: `Deposits disabled.` });
        }
        
        // PRECISION: Ensure amount is exactly 2 decimal places from integer math
        const amountInt = toMoneyInt(req.body.amount);
        depositData.amount = toMoneyDec(amountInt);
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
            description: `Pending Deposit #${deposit._id}`
        });
        
        await Notification.create({
            userId: deposit.userId,
            message: `Your deposit request #${deposit._id} is pending review.`
        });

        if (deposit.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
            if (withdrawal) {
                // PRECISION: Use integer math for P2P remaining calculations
                const currentRemainingInt = toMoneyInt(withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount);
                const depositAmountInt = toMoneyInt(deposit.amount);
                
                withdrawal.matchRemainingAmount = toMoneyDec(currentRemainingInt - depositAmountInt);
                if (!withdrawal.matchedDepositIds) withdrawal.matchedDepositIds = [];
                withdrawal.matchedDepositIds.push(deposit._id);
                await withdrawal.save();

                if (toMoneyInt(withdrawal.matchRemainingAmount) <= 0) {
                    await PaymentMethod.findOneAndDelete({ p2pWithdrawalId: withdrawal._id });
                }
            }
        }
        
        global.appDataVersion = Date.now();
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
        deposit.status = status;
        deposit.adminNotes = adminNotes;

        let finalUser = null;
        if (originalStatus !== 'Approved' && status === 'Approved') {
            // ATOMIC CREDIT
            finalUser = await User.findByIdAndUpdate(deposit.userId, { $inc: { walletBalance: deposit.amount } }, { new: true });
            await Transaction.findOneAndUpdate({ description: { $regex: deposit._id } }, { status: 'Approved' });
        } else {
            finalUser = await User.findById(deposit.userId);
        }

        await deposit.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { deposit, user: finalUser } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteDeposit = async (req, res) => {
    try {
        await Deposit.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
