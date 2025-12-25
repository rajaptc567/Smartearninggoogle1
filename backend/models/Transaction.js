
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
    sourceUserId: { // The user who triggered the transaction
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'hold_upgrade', 'hold_slot', 'overflow'],
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
    original_amount: {
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
    }
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

// Safety check to prevent regression: Prevent zeroing of held funds
TransactionSchema.pre('save', function(next) {
    if (['Approved', 'hold_upgrade', 'hold_slot'].includes(this.status) && this.amount <= 0 && this.type === 'Commission') {
        return next(new Error('Commission amount must be positive for Approved or Held statuses.'));
    }
    next();
});

export default mongoose.model('Transaction', TransactionSchema);
