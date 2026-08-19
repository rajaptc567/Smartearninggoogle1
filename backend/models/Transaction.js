
import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: [
            'Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 
            'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 
            'Transfer Received', 'Transfer Request', 'Transfer Refund', 'Task Budget Deduction', 
            'Task Refund', 'Task Reward', 'Currency Conversion', 'Investment To Task Wallet Transfer',
            'Task Wallet Transfer', 'Campaign Creation', 'Task Reward Transfer', 
            'Main To Campaign Wallet Transfer', 'Campaign Wallet To Main Transfer',
            'Task Wallet Conversion', 'Task Earnings Conversion', 'Task Earnings Transfer'
        ],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    level: {
        type: Number,
    },
    sourceUserId: { // The user who triggered the transaction (e.g., plan purchaser)
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
    },
    relatedPlanId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    },
    // For multi-currency commission tracking
    originalAmount: {
        type: Number,
    },
    originalCurrency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
    },
    exchangeRate: {
        type: Number,
    },
    amountUSD: {
        type: Number,
    },
    submissionId: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserTaskSubmission'
    },
    campaignId: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserTask'
    },
    // Source of funds and Wallet attribution
    sourceWallet: {
        type: String,
        enum: ['Investment', 'TaskEarnings', 'CampaignFunds', 'CampaignEscrow', 'External', 'MLMCommission', 'HeldUpgrade', 'System'],
        default: 'System'
    },
    destinationWallet: {
        type: String,
        enum: ['Investment', 'TaskEarnings', 'CampaignFunds', 'CampaignEscrow', 'External', 'MLMCommission', 'HeldUpgrade', 'System'],
        default: 'System'
    },
    sourceBreakdown: {
        fromInvestmentUSD: { type: Number, default: 0 },
        fromTaskEarningsUSD: { type: Number, default: 0 },
        fromRefundsUSD: { type: Number, default: 0 }
    },
    // Offerwall / Survey tracking & idempotency
    offerwallProvider: {
        type: String
    },
    externalTransactionId: {
        type: String
    },
    relatedTransactionId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction'
    }
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ submissionId: 1 });
TransactionSchema.index({ offerwallProvider: 1, externalTransactionId: 1 }, { sparse: true });

export default mongoose.model('Transaction', TransactionSchema);
