

import mongoose from 'mongoose';

const WithdrawalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    method: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'PKR'],
        required: true,
    },
    fee: {
        type: Number,
        required: true,
    },
    finalAmount: {
        type: Number,
        required: true,
    },
    accountTitle: {
        type: String,
        required: true,
    },
    accountNumber: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Paid', 'Rejected', 'Matching'],
        default: 'Pending',
    },
    adminNotes: {
        type: String,
    },
    userNotes: {
        type: String,
    },
    matchRemainingAmount: {
        type: Number,
    },
    matchedDepositIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Deposit'
    }]
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Withdrawal', WithdrawalSchema);