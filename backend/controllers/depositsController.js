
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import PaymentMethod from '../models/PaymentMethod.js';
import { bucket } from '../config/db.js';
import { Readable } from 'stream';
import path from 'path';

// @desc    Get all deposits (Conditional Pagination)
// @route   GET /api/v1/deposits
export const getDeposits = async (req, res) => {
    try {
        /**
         * CONDITIONAL PAGINATION:
         * If 'page' is provided, we use skip/limit.
         * If 'page' is missing, we return ALL records to avoid hiding data from a UI that lacks pagination controls.
         */
        const page = req.query.page ? parseInt(req.query.page, 10) : null;
        const limit = parseInt(req.query.limit, 10) || 100;
        
        let query = Deposit.find().sort({ date: -1 });

        if (page !== null) {
            const skip = (page - 1) * limit;
            query = query.skip(skip).limit(limit);
        }

        const deposits = await query;
        res.status(200).json({ success: true, count: deposits.length, data: deposits });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
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
            return res.status(403).json({ success: false, error: `Deposits are currently disabled for your account.` });
        }
        
        depositData.currency = user.currency;

        // GRIDFS PERSISTENT UPLOAD
        if (req.file) {
            const filename = `receipt_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
            
            const readableStream = new Readable();
            readableStream.push(req.file.buffer);
            readableStream.push(null);

            const uploadStream = bucket.openUploadStream(filename, {
                contentType: req.file.mimetype
            });

            await new Promise((resolve, reject) => {
                readableStream.pipe(uploadStream)
                    .on('error', reject)
                    .on('finish', resolve);
            });

            depositData.receiptUrl = `/uploads/${filename}`;
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
            message: `Your deposit request #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} is pending review.`
        });

        res.status(201).json({ success: true, data: { deposit, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateDeposit = async (req, res) => {
    try {
        const depositId = req.params.id;
        const { status, adminNotes } = req.body;
        const deposit = await Deposit.findById(depositId);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });

        const originalStatus = deposit.status;
        deposit.status = status;
        deposit.adminNotes = adminNotes;

        if (originalStatus !== 'Approved' && status === 'Approved') {
            await User.findByIdAndUpdate(deposit.userId, { $inc: { walletBalance: Number(deposit.amount.toFixed(2)) } });
            await Transaction.updateOne({ description: { $regex: `Deposit #${deposit._id}` } }, { status: 'Approved', description: `Approved Deposit #${deposit._id}` });
            await Notification.create({ userId: deposit.userId, message: `Your deposit #${deposit._id} has been approved.` });
        } 
        else if (originalStatus === 'Approved' && status !== 'Approved') {
            await User.findByIdAndUpdate(deposit.userId, { $inc: { walletBalance: -Number(deposit.amount.toFixed(2)) } });
            await Transaction.updateOne({ description: { $regex: `Deposit #${deposit._id}` } }, { status: status === 'Pending' ? 'Pending' : 'Rejected' });
        }

        await deposit.save();
        const updatedUser = await User.findById(deposit.userId);
        res.status(200).json({ success: true, data: { deposit, user: updatedUser } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findByIdAndDelete(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
