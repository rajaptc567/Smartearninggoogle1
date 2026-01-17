
import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import PaymentMethod from '../models/PaymentMethod.js';

// NOTE: For Production, integrate Cloudinary or AWS S3 here.
// Storing Base64 in MongoDB will cause significant performance issues and 16MB document limits.

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
            // PRODUCTION FIX: Upload to Cloudinary/S3 instead of Base64
            // const uploadResult = await cloudinary.uploader.upload(req.file.buffer);
            // depositData.receiptUrl = uploadResult.secure_url;
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
        // ... remaining logic ...
        res.status(201).json({ success: true, data: { deposit, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
// ... remaining functions ...
