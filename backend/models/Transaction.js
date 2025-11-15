import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: String,
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
    description: {
        type: String,
        required: true,
    },
    level: {
        type: Number,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
    },
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Transaction', TransactionSchema);