
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
        enum: ['Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 'Transfer Received', 'Transfer Request', 'Transfer Refund'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR'],
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
        enum: ['EUR', 'PKR'],
    },
    exchangeRate: {
        type: Number,
    }
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Transaction', TransactionSchema);
