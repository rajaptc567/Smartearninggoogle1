import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';

// @desc    Get all deposits
// @route   GET /api/v1/deposits
export const getDeposits = async (req, res) => {
    try {
        const deposits = await Deposit.find().sort({ date: -1 });
        res.status(200).json({ success: true, count: deposits.length, data: deposits });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single deposit
// @route   GET /api/v1/deposits/:id
export const getDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.params.id);
        if (!deposit) {
            return res.status(404).json({ success: false, error: 'Deposit not found' });
        }
        res.status(200).json({ success: true, data: deposit });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create new deposit
// @route   POST /api/v1/deposits
export const createDeposit = async (req, res) => {
    try {
        const depositData = { ...req.body };
        
        if (req.file) {
            // Store the path to be accessible from the frontend
            depositData.receiptUrl = `/uploads/${req.file.filename}`;
        }

        const deposit = await Deposit.create(depositData);
        
        // Create a notification for the user
        await Notification.create({
            userId: deposit.userId,
            message: `Your deposit request #${deposit._id} for $${deposit.amount.toFixed(2)} is pending review.`
        });

        // TODO: Add logic to create pending commission transactions for sponsors
        
        res.status(201).json({ success: true, data: deposit });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update deposit (Approve/Reject)
// @route   PUT /api/v1/deposits/:id
export const updateDeposit = async (req, res) => {
    try {
        const depositId = req.params.id;
        const { status, adminNotes } = req.body;

        const deposit = await Deposit.findById(depositId);
        if (!deposit) {
            return res.status(404).json({ success: false, error: 'Deposit not found' });
        }

        const originalStatus = deposit.status;
        
        deposit.status = status;
        deposit.adminNotes = adminNotes;

        let user = await User.findById(deposit.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        let newTransaction = null;

        // --- Main Approval/Rejection Logic ---
        if (originalStatus === 'Pending' && status === 'Approved') {
            // 1. Update user balance
            user.walletBalance += deposit.amount;
            
            // 2. Create an approved deposit transaction
            newTransaction = await Transaction.create({
                userId: user._id,
                userName: user.username,
                type: 'Deposit',
                amount: deposit.amount,
                status: 'Approved',
                description: `Approved Deposit #${deposit._id}`
            });

            // 3. Create success notification
            await Notification.create({
                userId: user._id,
                message: `Your deposit #${deposit._id} for $${deposit.amount.toFixed(2)} has been approved.`
            });

            // TODO: Add logic to find and approve pending commissions.
            // TODO: Add P2P matching logic for withdrawals.
        } else if (originalStatus === 'Approved' && status !== 'Approved') {
            // Reverting an approval
            user.walletBalance -= deposit.amount;
            // Note: Also need to handle reverting commissions and transactions, which adds complexity.
            // For now, we just revert the balance.
        }
        
        if (status === 'Rejected' && originalStatus !== 'Rejected') {
             await Notification.create({
                userId: user._id,
                message: `Your deposit #${deposit._id} for $${deposit.amount.toFixed(2)} has been rejected. Reason: ${adminNotes || 'Contact support'}`
            });
        }

        await deposit.save();
        await user.save();
        
        // Return all affected data to sync frontend state
        res.status(200).json({ 
            success: true, 
            data: { 
                deposit, 
                user,
                transaction: newTransaction
            }
        });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete deposit
// @route   DELETE /api/v1/deposits/:id
export const deleteDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findByIdAndDelete(req.params.id);
        if (!deposit) {
            return res.status(404).json({ success: false, error: 'Deposit not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};