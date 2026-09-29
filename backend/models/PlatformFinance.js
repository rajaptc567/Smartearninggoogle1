import mongoose from 'mongoose';

const PlatformAccountSchema = new mongoose.Schema({
    accountName: {
        type: String,
        default: 'PLATFORM_TREASURY',
        unique: true,
        required: true
    },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'PKR'],
        default: 'USD'
    },
    availableBalanceUSD: {
        type: Number,
        default: 0,
        min: [0, 'Available balance cannot be negative']
    },
    reservedBalanceUSD: {
        type: Number,
        default: 0,
        min: [0, 'Reserved balance cannot be negative']
    },
    spentBalanceUSD: {
        type: Number,
        default: 0,
        min: [0, 'Spent balance cannot be negative']
    },
    revenueBalanceUSD: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const PlatformLedgerSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['TOP_UP', 'CAMPAIGN_RESERVE', 'WORKER_PAYOUT', 'RESERVE_RELEASE', 'REVERSAL', 'COMMISSION_REVENUE'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0.0001
    },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'PKR'],
        default: 'USD'
    },
    campaignId: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserTask'
    },
    submissionId: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserTaskSubmission'
    },
    performedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    performedByUsername: {
        type: String,
        default: 'system'
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Approved', 'Pending', 'Rejected'],
        default: 'Approved'
    },
    idempotencyKey: {
        type: String,
        unique: true,
        sparse: true
    },
    relatedTransactionId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction'
    },
    reversalReferenceId: {
        type: mongoose.Schema.ObjectId,
        ref: 'PlatformLedger'
    },
    balanceBefore: {
        availableBalanceUSD: { type: Number, required: true },
        reservedBalanceUSD: { type: Number, required: true },
        spentBalanceUSD: { type: Number, default: 0 }
    },
    balanceAfter: {
        availableBalanceUSD: { type: Number, required: true },
        reservedBalanceUSD: { type: Number, required: true },
        spentBalanceUSD: { type: Number, default: 0 }
    }
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
});

PlatformLedgerSchema.index({ type: 1, createdAt: -1 });
PlatformLedgerSchema.index({ campaignId: 1 });
PlatformLedgerSchema.index({ submissionId: 1 });
PlatformLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const PlatformAccount = mongoose.model('PlatformAccount', PlatformAccountSchema);
export const PlatformLedger = mongoose.model('PlatformLedger', PlatformLedgerSchema);

export default { PlatformAccount, PlatformLedger };
