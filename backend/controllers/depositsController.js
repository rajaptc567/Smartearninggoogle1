
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import PaymentMethod from '../models/PaymentMethod.js';

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
        
        // Check specific activity restriction or blocked status
        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.deposit)) {
            return res.status(403).json({ success: false, error: `Deposits are currently disabled for your account.` });
        }

        // Check P2P Matching logic BEFORE creating deposit
        if (depositData.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(depositData.matchedWithdrawalId);
            if (!withdrawal) {
                return res.status(400).json({ success: false, error: 'Matched withdrawal request not found.' });
            }
            
            const depositAmount = parseFloat(depositData.amount);
            const remaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;

            // Ensure deposit does not exceed remaining needed
            if (depositAmount > remaining) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Deposit amount $${depositAmount} exceeds the remaining needed amount of $${remaining}.`
                });
            }

            // Logic proceeds...
        }

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

        // --- HANDLE P2P UPDATE ---
        if (deposit.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
            const depositAmount = deposit.amount;
            
            // 1. Deduct amount from remaining
            const currentRemaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
            withdrawal.matchRemainingAmount = currentRemaining - depositAmount;
            
            // 2. Add to list of matched deposits
            if (!withdrawal.matchedDepositIds) withdrawal.matchedDepositIds = [];
            withdrawal.matchedDepositIds.push(deposit._id);

            await withdrawal.save();

            // 3. Update Payment Method Max Amount (to prevent over-deposit on next try)
            if (withdrawal.matchRemainingAmount > 0) {
                await PaymentMethod.findOneAndUpdate(
                    { p2pWithdrawalId: withdrawal._id },
                    { maxAmount: withdrawal.matchRemainingAmount }
                );
                
                // Notify Withdrawal User about Partial (Sanitized message)
                await Notification.create({
                    userId: withdrawal.userId,
                    message: `Withdrawal Update: A payment of $${depositAmount.toFixed(2)} has been processed for your request. Remaining amount pending: $${withdrawal.matchRemainingAmount.toFixed(2)}.`
                });
            } else {
                // 4. FULLY MATCHED! Disable the Payment Method instantly
                await PaymentMethod.findOneAndDelete({ p2pWithdrawalId: withdrawal._id });
                
                // Notify Withdrawal User about Completion (Sanitized message)
                await Notification.create({
                    userId: withdrawal.userId,
                    message: `Withdrawal Update: Your request has been fully funded. Final processing in progress.`
                });
            }
        }
        // --- END P2P HANDLE ---
        
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
        if (originalStatus === status) {
            // Only notes are updated, no financial logic needed
            deposit.adminNotes = adminNotes;
            await deposit.save();
            return res.status(200).json({ success: true, data: deposit });
        }
        
        deposit.status = status;
        deposit.adminNotes = adminNotes;

        let user = await User.findById(deposit.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        // --- Main Approval/Rejection Logic ---
        if (originalStatus === 'Pending' && status === 'Approved') {
            // 1. Update user balance
            user.walletBalance += deposit.amount;
            await user.save();
            
            // 2. Create an approved deposit transaction
            await Transaction.create({
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
            
        } else if (originalStatus === 'Approved' && status !== 'Approved') {
            // Reverting an approval
            user.walletBalance -= deposit.amount;
            await user.save();
        }
        
        if (status === 'Rejected') {
             await Notification.create({
                userId: user._id,
                message: `Your deposit #${deposit._id} for $${deposit.amount.toFixed(2)} has been rejected. Reason: ${adminNotes || 'Contact support'}`
            });
            
            // Reverse P2P Matching Logic if Rejected
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
                if (withdrawal) {
                    // Add amount back to remaining
                    withdrawal.matchRemainingAmount = (withdrawal.matchRemainingAmount || 0) + deposit.amount;
                    // Remove from matched list
                    withdrawal.matchedDepositIds = withdrawal.matchedDepositIds.filter(id => id.toString() !== deposit._id.toString());
                    await withdrawal.save();
                    
                    // Restore Payment Method if it was deleted (because it was full)
                    const p2pMethod = await PaymentMethod.findOne({ p2pWithdrawalId: withdrawal._id });
                    if (p2pMethod) {
                        p2pMethod.maxAmount = withdrawal.matchRemainingAmount;
                        await p2pMethod.save();
                    } else {
                        // Re-create method if it was deleted
                        await PaymentMethod.create({
                            name: `P2P - ${withdrawal.method}`,
                            type: 'Deposit',
                            accountTitle: withdrawal.accountTitle,
                            accountNumber: withdrawal.accountNumber,
                            minAmount: 1,
                            maxAmount: withdrawal.matchRemainingAmount,
                            feePercent: 0,
                            status: 'Enabled',
                            instructions: '', // Ideally fetch old instructions or leave blank
                            p2pWithdrawalId: withdrawal._id
                        });
                    }
                }
            }
        }

        await deposit.save();
        
        // Return the updated deposit AND the updated user to sync frontend state
        res.status(200).json({ 
            success: true, 
            data: { 
                deposit, 
                user 
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
