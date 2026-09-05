import mongoose from 'mongoose';

const OfferwallPostbackLogSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        index: true
    },
    externalTxId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        index: true
    },
    username: {
        type: String
    },
    rewardUSD: {
        type: Number,
        default: 0
    },
    rawReward: {
        type: Number,
        default: 0
    },
    rawCurrency: {
        type: String,
        default: 'USD'
    },
    offerId: {
        type: String
    },
    offerName: {
        type: String
    },
    status: {
        type: String,
        enum: ['Processed', 'Duplicate', 'Rejected', 'Reversed', 'UserNotFound', 'InvalidSignature', 'IPBlocked', 'Error'],
        default: 'Processed',
        index: true
    },
    isReversal: {
        type: Boolean,
        default: false
    },
    clientIp: {
        type: String
    },
    queryParams: {
        type: mongoose.Schema.Types.Mixed
    },
    rawBody: {
        type: mongoose.Schema.Types.Mixed
    },
    rawHeaders: {
        type: mongoose.Schema.Types.Mixed
    },
    signature: {
        type: String
    },
    calculatedSignature: {
        type: String
    },
    signatureStatus: {
        type: String,
        enum: ['Verified', 'Invalid', 'Missing', 'Bypassed_TestMode', 'NotRequired'],
        default: 'Verified'
    },
    grossAmountUSD: {
        type: Number,
        default: 0
    },
    userRewardUSD: {
        type: Number,
        default: 0
    },
    platformRevenueUSD: {
        type: Number,
        default: 0
    },
    reversalReferenceTxId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction'
    },
    reversedAmountUSD: {
        type: Number,
        default: 0
    },
    chargebackStatus: {
        type: String,
        enum: ['None', 'Settled', 'Liability_Owed'],
        default: 'None'
    },
    userBalanceBefore: {
        type: Number
    },
    userBalanceAfter: {
        type: Number
    },
    riskStatus: {
        type: String,
        enum: ['NORMAL', 'REVIEW', 'HELD', 'BLOCKED'],
        default: 'NORMAL'
    },
    riskReason: {
        type: String
    },
    errorMessage: {
        type: String
    },
    transactionId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction'
    }
}, {
    timestamps: { createdAt: 'receivedAt', updatedAt: true }
});

OfferwallPostbackLogSchema.index({ provider: 1, externalTxId: 1, isReversal: 1 }, { unique: true });
OfferwallPostbackLogSchema.index({ receivedAt: -1 });

export default mongoose.model('OfferwallPostbackLog', OfferwallPostbackLogSchema);
