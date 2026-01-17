
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';

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
        
        const user = await User.findById(depositData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.deposit)) {
            return res.status(403).json({ success: false, error: `Deposits are currently disabled for your account.` });
        }
        
        depositData.currency = user.currency;

        // Check P2P constraints if applicable
        if (depositData.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(depositData.matchedWithdrawalId);
            if (!withdrawal) {
                return res.status(400).json({ success: false, error: 'Target gateway not found.' });
            }
            
            const depositAmount = parseFloat(depositData.amount);
            const remaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;

            if (depositAmount > (remaining + 0.01)) { // Added small tolerance for float math
                return res.status(400).json({ 
                    success: false, 
                    error: `Deposit amount exceeds the remaining limit for this gateway.`
                });
            }
        }

        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const mimeType = req.file.mimetype;
            depositData.receiptUrl = `data:${mimeType};base64,${b64}`;
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
            userId: user._id,
            message: `Your deposit request #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} is pending review.`
        });

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { deposit, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update deposit status (Admin)
// @route   PUT /api/v1/deposits/:id
export const updateDeposit = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const deposit = await Deposit.findById(req.params.id);

        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
        
        const user = await User.findById(deposit.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const originalStatus = deposit.status;

        // Logic: Moving to Approved
        if (originalStatus !== 'Approved' && status === 'Approved') {
            user.walletBalance = Number((user.walletBalance + deposit.amount).toFixed(2));
            
            // If this was a P2P deposit, update the parent withdrawal balance
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
                if (withdrawal) {
                    const currentRem = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
                    withdrawal.matchRemainingAmount = Number(Math.max(0, currentRem - deposit.amount).toFixed(2));
                    
                    if (!withdrawal.matchedDepositIds.includes(deposit._id)) {
                        withdrawal.matchedDepositIds.push(deposit._id);
                    }
                    await withdrawal.save();
                }
            }

            // Update associated transaction
            await Transaction.findOneAndUpdate(
                { userId: user._id, description: { $regex: deposit._id.toString() } },
                { status: 'Approved', description: `Approved Deposit #${deposit._id}` }
            );

            await Notification.create({
                userId: user._id,
                message: `Your deposit of ${user.currency}${deposit.amount.toFixed(2)} has been approved.`
            });
        }

        // Logic: Reversing an Approval (Approved -> Pending/Rejected)
        if (originalStatus === 'Approved' && status !== 'Approved') {
            user.walletBalance = Number((user.walletBalance - deposit.amount).toFixed(2));
            
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
                if (withdrawal) {
                    const currentRem = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
                    withdrawal.matchRemainingAmount = Number((currentRem + deposit.amount).toFixed(2));
                    await withdrawal.save();
                }
            }

            await Transaction.findOneAndUpdate(
                { userId: user._id, description: { $regex: deposit._id.toString() } },
                { status: status, description: `${status} Deposit #${deposit._id}` }
            );
        }

        deposit.status = status;
        deposit.adminNotes = adminNotes;
        
        await deposit.save();
        await user.save();
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { deposit, user } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete deposit
// @route   DELETE /api/v1/deposits/:id
export const deleteDeposit = async (req, res) => {
    try {
        const deposit = await Deposit.findByIdAndDelete(req.params.id);
        if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });
        
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
