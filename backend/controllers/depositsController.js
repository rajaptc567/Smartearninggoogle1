
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
        
        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.deposit)) {
            return res.status(403).json({ success: false, error: `Deposits are currently disabled for your account.` });
        }
        
        depositData.currency = user.currency;

        if (depositData.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(depositData.matchedWithdrawalId);
            if (!withdrawal) {
                return res.status(400).json({ success: false, error: 'Target gateway not found.' });
            }
            
            const depositAmount = parseFloat(depositData.amount);
            const remaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;

            if (depositAmount > remaining) {
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
            userId: deposit.userId,
            message: `Your deposit request #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} is pending review.`
        });

        if (deposit.matchedWithdrawalId) {
            const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
            const depositAmount = deposit.amount;
            
            const currentRemaining = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;
            withdrawal.matchRemainingAmount = Number((currentRemaining - depositAmount).toFixed(2));
            
            if (!withdrawal.matchedDepositIds) withdrawal.matchedDepositIds = [];
            withdrawal.matchedDepositIds.push(deposit._id);

            await withdrawal.save();

            if (withdrawal.matchRemainingAmount > 0) {
                await PaymentMethod.findOneAndUpdate(
                    { p2pWithdrawalId: withdrawal._id },
                    { maxAmount: withdrawal.matchRemainingAmount }
                );
            } else {
                await PaymentMethod.findOneAndDelete({ p2pWithdrawalId: withdrawal._id });
            }

            await Notification.create({
                userId: withdrawal.userId,
                subject: 'Payout Update',
                message: `Your withdrawal request #${withdrawal._id} has been processed through a secondary gateway and is now being verified.`
            });
        }
        
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

        const transaction = await Transaction.findOne({ 
            description: { $regex: `Deposit #${deposit._id}` } 
        });

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
            
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId).populate('matchedDepositIds');
                if (withdrawal) {
                    await Notification.create({
                        userId: withdrawal.userId,
                        subject: 'Payment Received',
                        message: `A payment of ${deposit.currency}${deposit.amount.toFixed(2)} for your withdrawal request #${withdrawal._id} has been verified.`
                    });

                    const approvedDeposits = await Deposit.find({
                        _id: { $in: withdrawal.matchedDepositIds },
                        status: 'Approved'
                    });
                    
                    const totalApproved = approvedDeposits.reduce((sum, d) => sum + d.amount, 0);
                    
                    if (totalApproved >= (withdrawal.finalAmount - 0.01)) {
                        withdrawal.status = 'Paid';
                        await withdrawal.save();
                        
                        const withdrawalTx = await Transaction.findOne({
                           userId: withdrawal.userId,
                           type: 'Withdrawal Request',
                           description: { $regex: `Withdrawal #${withdrawal._id}` }
                        });
                        
                        if (withdrawalTx) {
                            withdrawalTx.status = 'Approved';
                            withdrawalTx.description = `Paid Withdrawal #${withdrawal._id}`;
                            await withdrawalTx.save();
                        }

                        await Notification.create({
                            userId: withdrawal.userId,
                            subject: 'Withdrawal Success',
                            message: `Congratulations! Your withdrawal request #${withdrawal._id} has been fully settled and marked as Paid.`
                        });
                        
                        global.appDataVersion = Date.now();
                    }
                }
            }
        } 
        else if (originalStatus === 'Approved' && status !== 'Approved') {
            user.walletBalance = Number((user.walletBalance - deposit.amount).toFixed(2));
            await user.save();
            
            if (transaction) {
                transaction.status = status === 'Pending' ? 'Pending' : 'Rejected';
                transaction.description = `${status} Deposit #${deposit._id}`;
                await transaction.save();
            }
        } 
        else {
             if (transaction) {
                transaction.status = status;
                transaction.description = `${status} Deposit #${deposit._id}`;
                await transaction.save();
            }
        }
        
        if (status === 'Rejected') {
            let rejectionReason = adminNotes || 'Please contact support for more information.';
            if (deposit.matchedWithdrawalId) {
                rejectionReason = 'The transfer could not be verified by our clearing department.';
            }

             await Notification.create({
                userId: user._id,
                message: `Your deposit #${deposit._id} for ${user.currency}${deposit.amount.toFixed(2)} has been rejected. Reason: ${rejectionReason}`
            });
            
            if (deposit.matchedWithdrawalId) {
                const withdrawal = await Withdrawal.findById(deposit.matchedWithdrawalId);
                if (withdrawal) {
                    withdrawal.matchRemainingAmount = Number(((withdrawal.matchRemainingAmount || 0) + deposit.amount).toFixed(2));
                    withdrawal.matchedDepositIds = withdrawal.matchedDepositIds.filter(id => id.toString() !== deposit._id.toString());
                    await withdrawal.save();
                    
                    await Notification.create({
                        userId: withdrawal.userId,
                        subject: 'Gateway Update',
                        message: `A partial payment for your request #${withdrawal._id} could not be verified. Your request remains active in our priority queue.`
                    });

                    const p2pMethod = await PaymentMethod.findOne({ p2pWithdrawalId: withdrawal._id });
                    
                    if (p2pMethod) {
                        p2pMethod.maxAmount = withdrawal.matchRemainingAmount;
                        p2pMethod.status = 'Enabled';
                        await p2pMethod.save();
                    } else {
                        await PaymentMethod.create({
                            name: `Gateway - ${withdrawal.method}`,
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
