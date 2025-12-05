

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
        
        // Add user's currency to the deposit data
        depositData.currency = user.currency;

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
                    error: `Deposit amount ${user.currency}${depositAmount} exceeds the remaining needed amount of ${user.currency}${remaining}.`
                });
            }

            // Logic proceeds...
        }

        if (req.file) {
            // Convert buffer to Base64 string
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const mimeType = req.file.mimetype;
            // Store as Data URI in database
            depositData.receiptUrl = `data:${mimeType};base64,${b64}`;
        }

        const deposit = await Deposit.create(depositData);
        
        // NEW: Create a Transaction record immediately (Pending)
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Deposit',
            amount: deposit.amount,
            status: 'Pending',
            description: `Pending Deposit #${deposit._id}`
        });
        
        // Create a notification for the user
        await Notification.create({
            userId: deposit.userId,
            message: `Your deposit request #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} is pending review.`
        });

        // --- HANDLE P2P UPDATE ---
        if (deposit.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
            const depositAmount = deposit.amount;
            
            // 1. Deduct amount from remaining IMMEDIATELY (even if pending) - Precision Fix
            const currentRemaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
            withdrawal.matchRemainingAmount = Number((currentRemaining - depositAmount).toFixed(2));
            
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
                
                // Notify Withdrawal User about Partial Payment Pending Verification
                await Notification.create({
                    userId: withdrawal.userId,
                    message: `A payment of ${user.currency}${depositAmount.toFixed(2)} for your withdrawal request has been received and is pending verification. Remaining amount: ${user.currency}${withdrawal.matchRemainingAmount.toFixed(2)}.`
                });
            } else {
                // 4. FULLY MATCHED! Disable the Payment Method instantly
                await PaymentMethod.findOneAndDelete({ p2pWithdrawalId: withdrawal._id });
                
                // Notify Withdrawal User about Completion Pending Verification
                await Notification.create({
                    userId: withdrawal.userId,
                    message: `Your withdrawal request of ${user.currency}${withdrawal.finalAmount.toFixed(2)} is now being processed for payment.`
                });
            }
        }
        // --- END P2P HANDLE ---
        
        res.status(201).json({ success: true, data: { deposit, transaction } });
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
            return res.status(200).json({ success: true, data: { deposit } });
        }
        
        deposit.status = status;
        deposit.adminNotes = adminNotes;

        let user = await User.findById(deposit.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        // --- Find existing transaction to update status ---
        const transaction = await Transaction.findOne({ 
            description: { $regex: `Deposit #${deposit._id}` } 
        });

        // --- Main Approval/Rejection Logic ---
        
        // 1. BECOMING APPROVED (From Pending or Rejected)
        if (originalStatus !== 'Approved' && status === 'Approved') {
            user.walletBalance = Number((user.walletBalance + deposit.amount).toFixed(2));
            await user.save();
            
            if (transaction) {
                transaction.status = 'Approved';
                transaction.description = `Approved Deposit #${deposit._id}`;
                await transaction.save();
            }

            await Notification.create({
                userId: user._id,
                message: `Your deposit #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} has been approved.`
            });

            // Notify Withdrawal User that payment is confirmed
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
                if(withdrawal) {
                    await Notification.create({
                        userId: withdrawal.userId,
                        message: `Payment Confirmation: ${user.currency}${deposit.amount.toFixed(2)} has been confirmed for your pending withdrawal.`
                    });
                }
            }
            
        } 
        // 2. REVOKING APPROVAL (Going from Approved TO Rejected or Pending)
        else if (originalStatus === 'Approved' && status !== 'Approved') {
            user.walletBalance = Number((user.walletBalance - deposit.amount).toFixed(2));
            await user.save();
            
            if (transaction) {
                transaction.status = status === 'Pending' ? 'Pending' : 'Rejected';
                transaction.description = `${status} Deposit #${deposit._id}`;
                await transaction.save();
            }
        } 
        // 3. SIMPLE REJECTION (Pending -> Rejected) or PENDING (Rejected -> Pending)
        else {
             if (transaction) {
                transaction.status = status;
                transaction.description = `${status} Deposit #${deposit._id}`;
                await transaction.save();
            }
        }
        
        if (status === 'Rejected') {
            let rejectionReason = adminNotes || 'Contact support';
            // If this is a P2P deposit, override the reason for the user's notification to be generic.
            if (deposit.matchedWithdrawalId) {
                rejectionReason = 'Payment could not be verified. Please contact support if this is an error.';
            }

             await Notification.create({
                userId: user._id,
                message: `Your deposit #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} has been rejected. Reason: ${rejectionReason}`
            });
            
            // Reverse P2P Matching Logic if Rejected
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
                if (withdrawal) {
                    withdrawal.matchRemainingAmount = Number(((withdrawal.matchRemainingAmount || 0) + deposit.amount).toFixed(2));
                    withdrawal.matchedDepositIds = withdrawal.matchedDepositIds.filter(id => id.toString() !== deposit._id.toString());
                    await withdrawal.save();
                    
                    // Notify Withdrawal User about Rejection/Restoration
                    await Notification.create({
                        userId: withdrawal.userId,
                        message: `An issue occurred with a payment for your withdrawal. The amount of ${user.currency}${deposit.amount.toFixed(2)} has been returned to your pending balance to be matched again.`
                    });

                    const p2pMethod = await PaymentMethod.findOne({ p2pWithdrawalId: withdrawal._id });
                    
                    if (p2pMethod) {
                        p2pMethod.maxAmount = withdrawal.matchRemainingAmount;
                        p2pMethod.status = 'Enabled';
                        await p2pMethod.save();
                    } else {
                        await PaymentMethod.create({
                            name: `P2P - ${withdrawal.method}`,
                            type: 'Deposit',
                            currency: withdrawal.currency,
                            accountTitle: withdrawal.accountTitle,
                            accountNumber: withdrawal.accountNumber,
                            minAmount: 1,
                            maxAmount: withdrawal.matchRemainingAmount,
                            feePercent: 0,
                            status: 'Enabled',
                            instructions: '',
                            p2pWithdrawalId: withdrawal._id
                        });
                    }
                }
            }
        }

        await deposit.save();
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
        if (!deposit) {
            return res.status(404).json({ success: false, error: 'Deposit not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
