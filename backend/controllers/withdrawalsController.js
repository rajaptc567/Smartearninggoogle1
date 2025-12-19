
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';

// @desc    Get all withdrawals
// @route   GET /api/v1/withdrawals
export const getWithdrawals = async (req, res) => {
    try {
        // Populate matched deposits to show details in admin panel
        const withdrawals = await Withdrawal.find()
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

// @desc    Get single withdrawal
// @route   GET /api/v1/withdrawals/:id
export const getWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        res.status(200).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create new withdrawal request
// @route   POST /api/v1/withdrawals
export const createWithdrawal = async (req, res) => {
    try {
        const user = await User.findById(req.body.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Check specific activity restriction or blocked status
        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.withdrawal)) {
            return res.status(403).json({ success: false, error: `Withdrawals are currently disabled for your account.` });
        }
        
        // --- FREQUENCY LIMIT CHECK ---
        const settings = await Setting.getSettings();
        if (settings.withdrawalFrequency && settings.withdrawalFrequency.enabled) {
            const { value, unit } = settings.withdrawalFrequency;
            
            // Find the latest withdrawal for this user
            const lastWithdrawal = await Withdrawal.findOne({ userId: user._id }).sort({ date: -1 });
            
            if (lastWithdrawal) {
                const lastDate = new Date(lastWithdrawal.date).getTime();
                const now = Date.now();
                let durationMs = 0;

                switch (unit) {
                    case 'hours': durationMs = value * 60 * 60 * 1000; break;
                    case 'days': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'weeks': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'months': durationMs = value * 30 * 24 * 60 * 60 * 1000; break; // Approx
                }

                const nextAllowedTime = lastDate + durationMs;
                
                if (now < nextAllowedTime) {
                    const remainingMs = nextAllowedTime - now;
                    
                    // Format remaining time
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
        // --- END FREQUENCY CHECK ---

        if (user.walletBalance < req.body.amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // Deduct amount from user's balance immediately
        user.walletBalance -= req.body.amount;
        
        const withdrawalData = { ...req.body, currency: user.currency };
        const withdrawal = await Withdrawal.create(withdrawalData);
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Withdrawal Request',
            amount: -withdrawal.amount,
            status: 'Pending',
            description: `Pending Withdrawal #${withdrawal._id}`
        });

        await Notification.create({
            userId: user._id,
            message: `Your withdrawal request for ${user.currency}${withdrawal.amount.toFixed(2)} has been submitted for review.`
        });
        
        await user.save();
        
        res.status(201).json({ success: true, data: { withdrawal, user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};


// @desc    Update withdrawal (Approve/Reject)
// @route   PUT /api/v1/withdrawals/:id
export const updateWithdrawal = async (req, res) => {
    try {
        const { status, adminNotes, p2pName, p2pAccountTitle, p2pAccountNumber, p2pInstructions, p2pCustomFields } = req.body;
        
        let withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        const user = await User.findById(withdrawal.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        const originalStatus = withdrawal.status;

        // --- P2P MATCHING LOGIC ---
        // 1. If changing TO 'Matching', create a temporary Payment Method
        if (status === 'Matching') {
            // Initialize remaining amount if not set or if resetting logic
            const remainingAmount = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;

            const methodData = {
                name: p2pName || `P2P - ${withdrawal.method}`,
                type: 'Deposit',
                currency: withdrawal.currency,
                accountTitle: p2pAccountTitle || withdrawal.accountTitle,
                accountNumber: p2pAccountNumber || withdrawal.accountNumber,
                minAmount: 1, // Allow partial deposits
                maxAmount: remainingAmount, // Cap at exact remaining amount
                feePercent: 0,
                status: 'Enabled',
                instructions: p2pInstructions || '', 
                p2pWithdrawalId: withdrawal._id,
                customFields: p2pCustomFields || []
            };

            if (originalStatus === 'Matching') {
                // Update existing P2P method
                await PaymentMethod.findOneAndUpdate({ p2pWithdrawalId: withdrawal._id }, methodData);
            } else {
                // Create new
                await PaymentMethod.create(methodData);
                // Initial set of remaining amount if undefined
                if (withdrawal.matchRemainingAmount === undefined) {
                    withdrawal.matchRemainingAmount = withdrawal.finalAmount;
                }
            }
        }

        // 2. If changing FROM 'Matching' to something else (Paid, Rejected, etc.), delete the P2P Method
        if (originalStatus === 'Matching' && status !== 'Matching') {
            await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }
        // --- END P2P MATCHING LOGIC ---


        // If status is not changing (and we already handled P2P detail updates above), just update notes and return.
        if (originalStatus === status) {
            withdrawal.adminNotes = adminNotes || withdrawal.adminNotes;
            await withdrawal.save();
            return res.status(200).json({ success: true, data: { withdrawal, user } });
        }
        
        // --- Handle Transaction Logic ---
        
        // Find the original transaction to update its status and description
        // Use Regex to match "Pending Withdrawal #ID" or similar even if text slightly varied
        const originalTransaction = await Transaction.findOne({
            userId: user._id,
            type: 'Withdrawal Request',
            description: { $regex: `Withdrawal #${withdrawal._id}` }
        });

        // If request was pending/matching and is now being rejected, refund the user
        if ((originalStatus === 'Pending' || originalStatus === 'Matching') && status === 'Rejected') {
            user.walletBalance += withdrawal.amount;
            
            // Create a refund transaction
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: user.currency,
                type: 'Withdrawal Refund',
                amount: withdrawal.amount,
                status: 'Approved',
                description: `Refund for rejected withdrawal #${withdrawal._id}`
            });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                originalTransaction.description = `Rejected Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }

             await Notification.create({
                userId: user._id,
                message: `Your withdrawal for ${user.currency}${withdrawal.amount.toFixed(2)} was rejected. The amount has been refunded to your wallet.`
            });
        }
        
        if (status === 'Paid' || status === 'Approved') {
            if (originalTransaction) {
                originalTransaction.status = status === 'Paid' ? 'Approved' : status;
                originalTransaction.description = `${status} Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }
            const message = status === 'Paid' 
                ? `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been successfully paid.`
                : `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been approved.`;
            await Notification.create({ userId: user._id, message });
        }
        
        // Update the withdrawal document
        withdrawal.status = status;
        withdrawal.adminNotes = adminNotes;
        
        await withdrawal.save();
        await user.save();

        res.status(200).json({ success: true, data: { withdrawal, user } });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete withdrawal
// @route   DELETE /api/v1/withdrawals/:id
export const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        // Cleanup P2P method if exists
        if (withdrawal.status === 'Matching') {
             await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
