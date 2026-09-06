
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';

export const getTransactions = async (req, res) => {
    try {
        let query = {};
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

        if (!isAdmin && req.user) {
            query = { userId: req.user.id };
        } else if (!isAdmin) {
            // Unauthenticated requests get nothing
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const transactions = await Transaction.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, count: transactions.length, data: transactions });
    } catch (err) {
        res.status(200).json({ success: false, data: [], error: err.message });
    }
};

/**
 * P28 Financial Reconciliation Report (Admin-only, Read-only Audit)
 * Analyzes database records for consistency anomalies without altering user data.
 */
export const getReconciliationReport = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        if (!isAdmin) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required for financial reconciliation audit.' });
        }

        // 1. Check for negative balances
        const negativeUsers = await User.find({
            $or: [
                { walletBalance: { $lt: 0 } },
                { taskWalletBalance: { $lt: 0 } },
                { taskEarningsBalance: { $lt: 0 } }
            ]
        }).select('_id name email walletBalance taskWalletBalance taskEarningsBalance');

        // 2. Check for duplicate task reward transactions
        const duplicateTaskRewards = await Transaction.aggregate([
            { $match: { type: 'Task Reward', submissionId: { $exists: true, $ne: null } } },
            { $group: { _id: '$submissionId', count: { $sum: 1 }, transactions: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
        ]);

        // 3. Count pending parent financial records
        const pendingDepositsCount = await Deposit.countDocuments({ status: 'Pending' });
        const pendingWithdrawalsCount = await Withdrawal.countDocuments({ status: { $in: ['Pending', 'Matching'] } });
        const pendingTransfersCount = await Transfer.countDocuments({ status: 'Pending' });
        const pendingSubmissionsCount = await UserTaskSubmission.countDocuments({ status: 'Pending Review' });

        // 4. Check for approved task submissions missing Task Reward transaction
        const approvedSubmissions = await UserTaskSubmission.find({ status: 'Approved', rewardClaimed: true }).select('_id workerId rewardAmount');
        const submissionIds = approvedSubmissions.map(s => s._id);
        const existingRewardTxs = await Transaction.find({ submissionId: { $in: submissionIds }, type: 'Task Reward' }).select('submissionId');
        const rewardedSubIdSet = new Set(existingRewardTxs.map(t => String(t.submissionId)));
        const missingRewardTxSubmissions = approvedSubmissions.filter(s => !rewardedSubIdSet.has(String(s._id)));

        // 5. Check for approved deposits missing transaction
        const approvedDeposits = await Deposit.find({ status: 'Approved' }).select('_id userId amount');
        const approvedDepositIds = approvedDeposits.map(d => d._id);
        const depositTxs = await Transaction.find({
            $or: [
                { depositId: { $in: approvedDepositIds } },
                { type: 'Deposit', status: 'Approved' }
            ]
        }).select('_id depositId description');
        const matchedDepositIds = new Set(
            depositTxs.map(t => t.depositId ? String(t.depositId) : '').filter(Boolean)
        );
        const missingDepositTxCount = approvedDeposits.filter(d => !matchedDepositIds.has(String(d._id))).length;

        // 6. Check for rejected withdrawals missing refund transaction
        const rejectedWithdrawals = await Withdrawal.find({ status: 'Rejected' }).select('_id userId amount');
        const rejectedWithdrawalIds = rejectedWithdrawals.map(w => w._id);
        const refundTxs = await Transaction.find({
            $or: [
                { withdrawalId: { $in: rejectedWithdrawalIds } },
                { type: 'Withdrawal Refund' }
            ]
        }).select('_id withdrawalId description');
        const matchedRefundWithdrawalIds = new Set(
            refundTxs.map(t => t.withdrawalId ? String(t.withdrawalId) : '').filter(Boolean)
        );
        const missingRefundTxCount = rejectedWithdrawals.filter(w => !matchedRefundWithdrawalIds.has(String(w._id))).length;

        // 7. Summarize total system transaction volume
        const totalTransactions = await Transaction.countDocuments();

        const isHealthy = negativeUsers.length === 0 && duplicateTaskRewards.length === 0 && missingRewardTxSubmissions.length === 0;

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            auditSummary: {
                negativeBalanceUsersCount: negativeUsers.length,
                negativeBalanceUsers: negativeUsers,
                duplicateTaskRewardsCount: duplicateTaskRewards.length,
                duplicateTaskRewards: duplicateTaskRewards,
                missingRewardTransactionsCount: missingRewardTxSubmissions.length,
                missingRewardSubmissions: missingRewardTxSubmissions,
                missingDepositTransactionsCount: missingDepositTxCount,
                missingWithdrawalRefundTransactionsCount: missingRefundTxCount,
                pendingRecords: {
                    deposits: pendingDepositsCount,
                    withdrawals: pendingWithdrawalsCount,
                    transfers: pendingTransfersCount,
                    taskSubmissions: pendingSubmissionsCount
                },
                totalTransactionsCount: totalTransactions
            },
            status: isHealthy ? 'HEALTHY' : 'ANOMALIES_DETECTED'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

