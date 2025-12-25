
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
        enum: ['Pending', 'Approved', 'Rejected', 'hold_slot', 'hold_upgrade', 'overflow'],
        default: 'Approved'
    },
    relatedPlanId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    },
    // MLM Internal Audit Fields
    slot_index: {
        type: Number,
    },
    required_plan_id: {
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    },
    hold_reason: {
        type: String,
    },
    unlock_on_upgrade: {
        type: Boolean,
        default: false
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
    }
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Transaction', TransactionSchema);
