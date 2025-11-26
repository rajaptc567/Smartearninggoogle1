
import mongoose from 'mongoose';

const DepositSchema = new mongoose.Schema({
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
    transactionId: {
        type: String,
        required: true,
    },
    senderAccountTitle: {
        type: String,
        // Not strictly required for backward compatibility, but effectively required by frontend
    },
    receiptUrl: {
        type: String,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    adminNotes: {
        type: String,
    },
    userNotes: {
        type: String,
    },
    matchedWithdrawalId: {
        type: String, // Can be ObjectId if Withdrawal model is fully implemented
    },
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Deposit', DepositSchema);
