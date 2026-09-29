import mongoose from 'mongoose';
import { PlatformAccount, PlatformLedger } from '../models/PlatformFinance.js';
import UserTask from '../models/UserTask.js';
import Transaction from '../models/Transaction.js';

/**
 * Checks whether the active MongoDB connection supports replica-set transactions.
 */
export const isReplicaSetSupported = () => {
    try {
        const client = mongoose.connection?.getClient?.();
        const topology = client?.topology;
        const type = topology?.description?.type;
        return type === 'ReplicaSetWithPrimary' || type === 'Sharded';
    } catch {
        return false;
    }
};

/**
 * Retrieves the authoritative Platform Treasury account record, initializing it if not present.
 */
export const getOrCreatePlatformAccount = async () => {
    let account = await PlatformAccount.findOne({ accountName: 'PLATFORM_TREASURY' });
    if (!account) {
        account = await PlatformAccount.create({
            accountName: 'PLATFORM_TREASURY',
            currency: 'USD',
            availableBalanceUSD: 0,
            reservedBalanceUSD: 0,
            spentBalanceUSD: 0,
            revenueBalanceUSD: 0
        });
    }
    return account;
};

/**
 * Returns a high-level summary of the Platform Finance state.
 */
export const getPlatformFinanceSummary = async () => {
    const account = await getOrCreatePlatformAccount();
    const totalTreasuryUSD = Number(
        (account.availableBalanceUSD + account.reservedBalanceUSD + account.spentBalanceUSD).toFixed(2)
    );
    return {
        accountName: account.accountName,
        currency: account.currency,
        availableBalanceUSD: account.availableBalanceUSD,
        reservedBalanceUSD: account.reservedBalanceUSD,
        spentBalanceUSD: account.spentBalanceUSD,
        revenueBalanceUSD: account.revenueBalanceUSD,
        totalTreasuryUSD,
        lastUpdated: account.lastUpdated
    };
};

/**
 * Retrieves paginated immutable platform ledger entries.
 */
export const getPlatformLedgerHistory = async ({ page = 1, limit = 50, type, campaignId }) => {
    const query = {};
    if (type) query.type = type;
    if (campaignId) query.campaignId = campaignId;

    const skip = (Math.max(1, page) - 1) * limit;
    const [entries, total] = await Promise.all([
        PlatformLedger.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('campaignId', 'title category targetQuantity rewardPerTask status')
            .populate('performedBy', 'username email role'),
        PlatformLedger.countDocuments(query)
    ]);

    return {
        entries,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
};

/**
 * Admin-only manual top-up of Platform Available Balance.
 * Never modifies any member wallet or invents untracked funds.
 */
export const topUpPlatformBalance = async ({
    amount,
    currency = 'USD',
    performedBy,
    performedByUsername = 'Admin',
    description = 'Manual Platform Treasury Top-Up',
    idempotencyKey
}) => {
    const topUpAmount = Number(Number(amount).toFixed(2));
    if (isNaN(topUpAmount) || topUpAmount <= 0) {
        throw new Error('Top-up amount must be a valid positive number.');
    }

    const effectiveIdempotencyKey = idempotencyKey || `topup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Idempotency check
    const existing = await PlatformLedger.findOne({ idempotencyKey: effectiveIdempotencyKey });
    if (existing) {
        return { success: true, ledger: existing, message: 'Top-up already executed (idempotent).' };
    }

    const currentAccount = await getOrCreatePlatformAccount();
    const balanceBefore = {
        availableBalanceUSD: currentAccount.availableBalanceUSD,
        reservedBalanceUSD: currentAccount.reservedBalanceUSD,
        spentBalanceUSD: currentAccount.spentBalanceUSD
    };

    // Atomic increment
    const updatedAccount = await PlatformAccount.findOneAndUpdate(
        { accountName: 'PLATFORM_TREASURY' },
        {
            $inc: { availableBalanceUSD: topUpAmount },
            $set: { lastUpdated: new Date() }
        },
        { new: true, upsert: true }
    );

    const balanceAfter = {
        availableBalanceUSD: updatedAccount.availableBalanceUSD,
        reservedBalanceUSD: updatedAccount.reservedBalanceUSD,
        spentBalanceUSD: updatedAccount.spentBalanceUSD
    };

    // Immutable Ledger Entry
    const ledger = await PlatformLedger.create({
        type: 'TOP_UP',
        amount: topUpAmount,
        currency,
        performedBy,
        performedByUsername,
        description: `${description}: +$${topUpAmount.toFixed(2)} USD`,
        status: 'Approved',
        idempotencyKey: effectiveIdempotencyKey,
        balanceBefore,
        balanceAfter
    });

    // Companion Audit Transaction in main Transaction log
    if (performedBy) {
        await Transaction.create({
            userId: performedBy,
            userName: performedByUsername,
            currency: 'USD',
            type: 'Platform Top-Up',
            amount: topUpAmount,
            amountUSD: topUpAmount,
            sourceWallet: 'External',
            destinationWallet: 'PlatformCampaignBudget',
            description: `Admin Platform Treasury Top-Up: +$${topUpAmount.toFixed(2)} USD`,
            status: 'Approved',
            idempotencyKey: effectiveIdempotencyKey,
            balanceBefore: balanceBefore.availableBalanceUSD,
            balanceAfter: balanceAfter.availableBalanceUSD
        }).catch(err => {
            console.error('Non-critical: Failed to write companion top-up transaction:', err.message);
        });
    }

    return { success: true, ledger, account: updatedAccount };
};

/**
 * Reserves funds for a platform campaign from Platform Available Balance.
 * Fails fast and rejects if available balance < required reserve.
 */
export const reservePlatformBudgetForCampaign = async ({
    campaignId,
    requiredReserveUSD,
    performedBy,
    performedByUsername = 'Admin',
    description,
    idempotencyKey
}) => {
    const requiredUSD = Number(Number(requiredReserveUSD).toFixed(2));
    if (isNaN(requiredUSD) || requiredUSD <= 0) {
        throw new Error('Required campaign reserve must be a valid positive number.');
    }

    const effectiveIdempotencyKey = idempotencyKey || `platform-reserve-${campaignId}`;

    // Idempotency check: prevent double reservation
    const existing = await PlatformLedger.findOne({ idempotencyKey: effectiveIdempotencyKey });
    if (existing) {
        return { success: true, ledger: existing, alreadyReserved: true };
    }

    // Atomic reservation with strict conditional check (availableBalanceUSD >= requiredUSD)
    const currentAccount = await getOrCreatePlatformAccount();
    if (currentAccount.availableBalanceUSD < requiredUSD) {
        return {
            success: false,
            error: `Insufficient platform available balance. Required: $${requiredUSD.toFixed(2)} USD, Available: $${currentAccount.availableBalanceUSD.toFixed(2)} USD. Please top up platform treasury first.`,
            requiredUSD,
            availableUSD: currentAccount.availableBalanceUSD
        };
    }

    const balanceBefore = {
        availableBalanceUSD: currentAccount.availableBalanceUSD,
        reservedBalanceUSD: currentAccount.reservedBalanceUSD,
        spentBalanceUSD: currentAccount.spentBalanceUSD
    };

    const updatedAccount = await PlatformAccount.findOneAndUpdate(
        {
            accountName: 'PLATFORM_TREASURY',
            availableBalanceUSD: { $gte: requiredUSD }
        },
        {
            $inc: {
                availableBalanceUSD: -requiredUSD,
                reservedBalanceUSD: requiredUSD
            },
            $set: { lastUpdated: new Date() }
        },
        { new: true }
    );

    if (!updatedAccount) {
        return {
            success: false,
            error: `Failed to reserve platform budget: available balance ($${currentAccount.availableBalanceUSD.toFixed(2)} USD) is less than required reserve ($${requiredUSD.toFixed(2)} USD).`,
            requiredUSD,
            availableUSD: currentAccount.availableBalanceUSD
        };
    }

    const balanceAfter = {
        availableBalanceUSD: updatedAccount.availableBalanceUSD,
        reservedBalanceUSD: updatedAccount.reservedBalanceUSD,
        spentBalanceUSD: updatedAccount.spentBalanceUSD
    };

    // Immutable Ledger Entry
    const ledger = await PlatformLedger.create({
        type: 'CAMPAIGN_RESERVE',
        amount: requiredUSD,
        currency: 'USD',
        campaignId,
        performedBy,
        performedByUsername,
        description: description || `Campaign escrow reserved: $${requiredUSD.toFixed(2)} USD for campaign ${campaignId}`,
        status: 'Approved',
        idempotencyKey: effectiveIdempotencyKey,
        balanceBefore,
        balanceAfter
    });

    // Update campaign tracking fields
    await UserTask.findByIdAndUpdate(campaignId, {
        $set: {
            isReserved: true,
            reservedBudgetUSD: requiredUSD,
            spentBudgetUSD: 0,
            releasedBudgetUSD: 0
        }
    });

    return { success: true, ledger, account: updatedAccount };
};

/**
 * Settles worker reward for a platform-funded campaign submission.
 * Moves funds from Campaign Reserved Balance -> Platform Campaign Spent.
 * Fully idempotent: cannot double-pay or double-decrement.
 */
export const settlePlatformWorkerPayout = async ({
    campaignId,
    submissionId,
    workerId,
    rewardUSD,
    performedBy,
    performedByUsername = 'System',
    description,
    idempotencyKey
}) => {
    const payoutUSD = Number(Number(rewardUSD).toFixed(2));
    if (isNaN(payoutUSD) || payoutUSD <= 0) {
        throw new Error('Payout reward amount must be a positive number.');
    }

    const effectiveIdempotencyKey = idempotencyKey || `platform-payout-${submissionId}`;

    // Idempotency check: ensure settlement happens only once per submission
    const existing = await PlatformLedger.findOne({ idempotencyKey: effectiveIdempotencyKey });
    if (existing) {
        return { success: true, ledger: existing, alreadySettled: true };
    }

    const currentAccount = await getOrCreatePlatformAccount();
    const balanceBefore = {
        availableBalanceUSD: currentAccount.availableBalanceUSD,
        reservedBalanceUSD: currentAccount.reservedBalanceUSD,
        spentBalanceUSD: currentAccount.spentBalanceUSD
    };

    // Bounded atomic movement: move payoutUSD from reserved to spent
    const amountToDeduct = Math.min(payoutUSD, currentAccount.reservedBalanceUSD);

    const updatedAccount = await PlatformAccount.findOneAndUpdate(
        {
            accountName: 'PLATFORM_TREASURY',
            reservedBalanceUSD: { $gte: amountToDeduct }
        },
        {
            $inc: {
                reservedBalanceUSD: -amountToDeduct,
                spentBalanceUSD: amountToDeduct
            },
            $set: { lastUpdated: new Date() }
        },
        { new: true }
    );

    const balanceAfter = updatedAccount ? {
        availableBalanceUSD: updatedAccount.availableBalanceUSD,
        reservedBalanceUSD: updatedAccount.reservedBalanceUSD,
        spentBalanceUSD: updatedAccount.spentBalanceUSD
    } : balanceBefore;

    // Immutable Ledger Entry
    const ledger = await PlatformLedger.create({
        type: 'WORKER_PAYOUT',
        amount: payoutUSD,
        currency: 'USD',
        campaignId,
        submissionId,
        performedBy,
        performedByUsername,
        description: description || `Worker payout: $${payoutUSD.toFixed(2)} USD for submission ${submissionId}`,
        status: 'Approved',
        idempotencyKey: effectiveIdempotencyKey,
        balanceBefore,
        balanceAfter
    });

    // Update campaign's spent/reserved fields
    if (campaignId) {
        await UserTask.findByIdAndUpdate(campaignId, {
            $inc: {
                spentBudgetUSD: payoutUSD,
                reservedBudgetUSD: -payoutUSD
            }
        });
    }

    return { success: true, ledger, account: updatedAccount };
};

/**
 * Releases unused campaign reserve back to Platform Available Balance upon deletion or closure.
 * Unused amount = remaining unpaid eligible slots × rewardPerTask.
 * Fully bounded and idempotent: cannot release more than currently reserved or double-release.
 */
export const releasePlatformCampaignReserve = async ({
    campaignId,
    performedBy,
    performedByUsername = 'Admin',
    reason = 'Campaign closed/deleted',
    idempotencyKey
}) => {
    const effectiveIdempotencyKey = idempotencyKey || `platform-release-${campaignId}`;

    // Idempotency check: prevent duplicate release
    const existing = await PlatformLedger.findOne({ idempotencyKey: effectiveIdempotencyKey });
    if (existing) {
        return { success: true, ledger: existing, alreadyReleased: true };
    }

    const task = await UserTask.findById(campaignId);
    if (!task) {
        return { success: false, error: 'Campaign not found for reserve release.' };
    }

    // Calculate actual unused reserve safely
    const totalReserved = Number((task.reservedBudgetUSD || task.totalBudget || 0).toFixed(2));
    const alreadySpent = Number((task.spentBudgetUSD || ((task.currentCompletions || 0) * task.rewardPerTask)).toFixed(2));
    const alreadyReleased = Number((task.releasedBudgetUSD || 0).toFixed(2));

    const remainingSlots = Math.max(0, task.targetQuantity - (task.currentCompletions || 0));
    const slotsUnusedUSD = Number((remainingSlots * task.rewardPerTask).toFixed(2));

    // Cap release at the maximum eligible amount
    const maxEligible = Math.max(0, Number((totalReserved - alreadySpent - alreadyReleased).toFixed(2)));
    const amountToRelease = Math.min(maxEligible, slotsUnusedUSD);

    if (amountToRelease <= 0) {
        return { success: true, releasedAmountUSD: 0, message: 'No remaining reserve eligible for release.' };
    }

    const currentAccount = await getOrCreatePlatformAccount();
    const actualReserveInAccount = currentAccount.reservedBalanceUSD || 0;
    const finalReleaseAmount = Math.min(amountToRelease, actualReserveInAccount);

    if (finalReleaseAmount <= 0) {
        return { success: true, releasedAmountUSD: 0, message: 'Platform treasury has 0 reserved balance to release.' };
    }

    const balanceBefore = {
        availableBalanceUSD: currentAccount.availableBalanceUSD,
        reservedBalanceUSD: currentAccount.reservedBalanceUSD,
        spentBalanceUSD: currentAccount.spentBalanceUSD
    };

    // Atomic transfer: Reserved -> Available
    const updatedAccount = await PlatformAccount.findOneAndUpdate(
        {
            accountName: 'PLATFORM_TREASURY',
            reservedBalanceUSD: { $gte: finalReleaseAmount }
        },
        {
            $inc: {
                reservedBalanceUSD: -finalReleaseAmount,
                availableBalanceUSD: finalReleaseAmount
            },
            $set: { lastUpdated: new Date() }
        },
        { new: true }
    );

    const balanceAfter = updatedAccount ? {
        availableBalanceUSD: updatedAccount.availableBalanceUSD,
        reservedBalanceUSD: updatedAccount.reservedBalanceUSD,
        spentBalanceUSD: updatedAccount.spentBalanceUSD
    } : balanceBefore;

    // Immutable Ledger Entry
    const ledger = await PlatformLedger.create({
        type: 'RESERVE_RELEASE',
        amount: finalReleaseAmount,
        currency: 'USD',
        campaignId,
        performedBy,
        performedByUsername,
        description: `Reserve released (${reason}): returned ${remainingSlots} unused slots ($${finalReleaseAmount.toFixed(2)} USD) to Available Platform Balance`,
        status: 'Approved',
        idempotencyKey: effectiveIdempotencyKey,
        balanceBefore,
        balanceAfter
    });

    // Update campaign tracking
    await UserTask.findByIdAndUpdate(campaignId, {
        $inc: {
            releasedBudgetUSD: finalReleaseAmount,
            reservedBudgetUSD: -finalReleaseAmount
        }
    });

    // Companion Audit Transaction
    await Transaction.create({
        userId: performedBy || task.userId,
        userName: performedByUsername,
        currency: 'USD',
        type: 'Platform Campaign Refund',
        amount: finalReleaseAmount,
        amountUSD: finalReleaseAmount,
        campaignId: task._id,
        sourceWallet: 'CampaignEscrow',
        destinationWallet: 'PlatformCampaignBudget',
        description: `Platform Campaign deleted/closed: returned remaining ${remainingSlots} slots ($${finalReleaseAmount.toFixed(2)} USD) to Platform Campaign Budget`,
        status: 'Approved',
        idempotencyKey: effectiveIdempotencyKey,
        balanceBefore: balanceBefore.availableBalanceUSD,
        balanceAfter: balanceAfter.availableBalanceUSD
    }).catch(err => {
        console.error('Non-critical: Failed to write companion release transaction:', err.message);
    });

    return {
        success: true,
        releasedAmountUSD: finalReleaseAmount,
        remainingSlots,
        ledger,
        account: updatedAccount
    };
};

export default {
    isReplicaSetSupported,
    getOrCreatePlatformAccount,
    getPlatformFinanceSummary,
    getPlatformLedgerHistory,
    topUpPlatformBalance,
    reservePlatformBudgetForCampaign,
    settlePlatformWorkerPayout,
    releasePlatformCampaignReserve
};
