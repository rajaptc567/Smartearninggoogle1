
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Deposit from '../models/Deposit.js';
import Withdrawal from '../models/Withdrawal.js';
import Transfer from '../models/Transfer.js';
import OfferwallPostbackLog from '../models/OfferwallPostbackLog.js';
import Notification from '../models/Notification.js';
import OfferwallProvider from '../models/OfferwallProvider.js';

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

/**
 * Admin: Get all Pending Offerwall Reward transactions flagged for Risk REVIEW
 */
export const getPendingOfferwallRiskReviews = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        if (!isAdmin) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        const query = {
            type: 'Offerwall Reward',
            status: 'Pending',
            riskStatus: 'REVIEW'
        };

        const pending = await Transaction.find(query)
            .sort({ date: -1 })
            .lean();

        // Populate user details safely
        const userIds = [...new Set(pending.map(t => String(t.userId)).filter(Boolean))];
        const users = await User.find({ _id: { $in: userIds } }).select('_id username email status restrictions').lean();
        const userMap = new Map(users.map(u => [String(u._id), u]));

        const data = pending.map(t => {
            const u = userMap.get(String(t.userId));
            return {
                _id: t._id,
                userId: t.userId,
                username: t.userName || u?.username || 'Unknown',
                userEmail: u?.email || '',
                userStatus: u?.status || 'Active',
                userRestrictions: u?.restrictions || {},
                provider: t.offerwallProvider,
                externalTransactionId: t.externalTransactionId,
                amountUSD: t.userRewardAmount ?? t.amountUSD ?? t.amount,
                grossAmountUSD: t.grossAmount || 0,
                riskReason: t.riskReason || 'Flagged for security review',
                description: t.description,
                createdAt: t.date || t.createdAt
            };
        });

        return res.status(200).json({ success: true, count: data.length, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * Admin: Approve Pending Offerwall Reward transaction and credit spendable wallet balance
 */
export const approveOfferwallRiskReview = async (req, res) => {
    const { id } = req.params;
    const { reviewNote } = req.body || {};

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
    }

    if (!reviewNote || !String(reviewNote).trim()) {
        return res.status(400).json({ success: false, error: 'Mandatory review note is required to approve pending reward.' });
    }

    let session = null;
    let sessionStarted = false;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        sessionStarted = true;
    } catch (_) {
        session = null;
        sessionStarted = false;
    }

    // Never approve a financial reward without a working MongoDB transaction
    if (!sessionStarted || !session) {
        return res.status(503).json({
            success: false,
            error: 'MongoDB transaction support is unavailable. Reward approval failed closed and remains Pending.'
        });
    }

    try {
        // Query to match only eligible Pending REVIEW Offerwall Reward
        const txQuery = {
            _id: id,
            type: 'Offerwall Reward',
            status: 'Pending',
            riskStatus: 'REVIEW'
        };

        const existingTx = await Transaction.findOne(txQuery).session(session);
        if (!existingTx) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: 'Transaction not found or not eligible for approval (must be Offerwall Reward in Pending REVIEW state).'
            });
        }

        // Check for an existing reversal record/marker for the same provider and external transaction ID (race-safe)
        const existingReversal = await Transaction.findOne({
            offerwallProvider: existingTx.offerwallProvider,
            externalTransactionId: existingTx.externalTransactionId,
            type: 'Offerwall Reversal'
        }).session(session);

        if (existingReversal) {
            await session.abortTransaction();
            return res.status(409).json({
                success: false,
                error: 'Cannot approve reward: a reversal has already been processed for this transaction.'
            });
        }

        // Verify target user is NOT Blocked and earning is not restricted (within transaction)
        const targetUser = await User.findById(existingTx.userId).session(session);
        if (!targetUser) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, error: 'Target user account not found.' });
        }
        if (targetUser.status === 'Blocked' || targetUser.restrictions?.earning === true) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                error: 'User account is Blocked or earning-restricted; approval rejected.'
            });
        }

        const rewardToCredit = Number(existingTx.userRewardAmount ?? existingTx.amountUSD ?? existingTx.amount);
        if (!Number.isFinite(rewardToCredit) || rewardToCredit <= 0) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, error: 'Invalid or non-positive reward amount.' });
        }

        const balanceBefore = Number(targetUser.taskEarningsBalance || 0);
        const balanceAfter = Number((balanceBefore + rewardToCredit).toFixed(4));

        // Atomically transition transaction status
        const updatedTx = await Transaction.findOneAndUpdate(
            txQuery,
            {
                $set: {
                    status: 'Approved',
                    riskStatus: 'APPROVED',
                    balanceBefore,
                    balanceAfter,
                    reviewedBy: req.user?._id || req.user?.id,
                    reviewedAt: new Date(),
                    reviewDecision: 'Approved',
                    reviewNote: String(reviewNote).trim()
                }
            },
            { new: true, session }
        );

        if (!updatedTx) {
            await session.abortTransaction();
            return res.status(409).json({
                success: false,
                error: 'Transaction was already reviewed or modified concurrently.'
            });
        }

        // Atomically credit user task earnings balance
        const updatedUser = await User.findOneAndUpdate(
            {
                _id: targetUser._id,
                status: { $ne: 'Blocked' },
                'restrictions.earning': { $ne: true }
            },
            {
                $inc: {
                    taskEarningsBalance: rewardToCredit,
                    taskWalletBalance: rewardToCredit
                }
            },
            { new: true, session }
        );

        if (!updatedUser) {
            await session.abortTransaction();
            return res.status(500).json({
                success: false,
                error: 'Failed to update user wallet balance during approval; transaction aborted.'
            });
        }

        // Update provider metrics exactly once in the same transaction
        if (existingTx.offerwallProvider) {
            const providerFilter = (existingTx.offerwallProvider === 'offerwall_gg' || existingTx.offerwallProvider === 'offerwallgg')
                ? { providerKey: { $in: ['offerwall_gg', 'offerwallgg'] } }
                : { providerKey: existingTx.offerwallProvider };

            const updatedProvider = await OfferwallProvider.findOneAndUpdate(
                providerFilter,
                {
                    $inc: {
                        totalGrossPayoutUSD: existingTx.grossAmount || 0,
                        totalUserPayoutUSD: rewardToCredit,
                        totalPlatformRevenueUSD: existingTx.platformRevenueAmount || 0,
                        totalPostbackCount: 1
                    }
                },
                { session }
            );

            if (!updatedProvider) {
                await session.abortTransaction();
                return res.status(500).json({
                    success: false,
                    error: `Failed to update provider metrics: provider '${existingTx.offerwallProvider}' not found; transaction aborted.`
                });
            }
        }

        // Update linked OfferwallPostbackLog
        try {
            await OfferwallPostbackLog.findOneAndUpdate(
                { transactionId: updatedTx._id },
                {
                    $set: {
                        status: 'Processed',
                        userBalanceBefore: balanceBefore,
                        userBalanceAfter: balanceAfter
                    }
                },
                { session }
            );
        } catch (_) {}

        await session.commitTransaction();

        // User Notification
        try {
            await Notification.create({
                userId: targetUser._id,
                subject: `Offerwall Reward Approved & Credited! 🎁 (+$${rewardToCredit.toFixed(2)})`,
                message: `Your pending offerwall reward of $${rewardToCredit.toFixed(2)} has been approved by security review and credited to your Task Balance. Note: ${String(reviewNote).trim()}`,
                senderType: 'System'
            });
        } catch (_) {}

        // Socket sync
        try {
            const io = req.app?.get('io');
            if (io) io.emit('DATA_CHANGED');
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: 'Offerwall reward approved and balance credited successfully.',
            data: updatedTx
        });
    } catch (err) {
        if (sessionStarted) {
            try { await session.abortTransaction(); } catch (_) {}
        }
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        if (session) {
            try { session.endSession(); } catch (_) {}
        }
    }
};

/**
 * Admin: Reject Pending Offerwall Reward transaction with zero balance credit/deduction
 */
export const rejectOfferwallRiskReview = async (req, res) => {
    const { id } = req.params;
    const { reviewNote } = req.body || {};

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
    }

    if (!reviewNote || !String(reviewNote).trim()) {
        return res.status(400).json({ success: false, error: 'Mandatory review note is required to reject pending reward.' });
    }

    try {
        const txQuery = {
            _id: id,
            type: 'Offerwall Reward',
            status: 'Pending',
            riskStatus: 'REVIEW'
        };

        const updatedTx = await Transaction.findOneAndUpdate(
            txQuery,
            {
                $set: {
                    status: 'Rejected',
                    reviewedBy: req.user?._id || req.user?.id,
                    reviewedAt: new Date(),
                    reviewDecision: 'Rejected',
                    reviewNote: String(reviewNote).trim()
                }
            },
            { new: true }
        );

        if (!updatedTx) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found or not eligible for rejection (must be Offerwall Reward in Pending REVIEW state).'
            });
        }

        // Update linked OfferwallPostbackLog
        try {
            await OfferwallPostbackLog.findOneAndUpdate(
                { transactionId: updatedTx._id },
                {
                    $set: {
                        status: 'Rejected',
                        errorMessage: `Risk review rejected: ${String(reviewNote).trim()}`
                    }
                }
            );
        } catch (_) {}

        // Notify User
        try {
            await Notification.create({
                userId: updatedTx.userId,
                subject: `Offerwall Reward Security Review Notice ❌`,
                message: `Your pending offerwall reward of $${(updatedTx.userRewardAmount ?? updatedTx.amountUSD ?? updatedTx.amount).toFixed(2)} was not approved following security review. Reason: ${String(reviewNote).trim()}`,
                senderType: 'System'
            });
        } catch (_) {}

        // Socket sync
        try {
            const io = req.app?.get('io');
            if (io) io.emit('DATA_CHANGED');
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: 'Offerwall reward rejected successfully with zero wallet balance mutation.',
            data: updatedTx
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};


