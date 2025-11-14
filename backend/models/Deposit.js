import mongoose from 'mongoose';

const DepositSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    method: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    transactionId: {
        type: String,
        required: true
    },
    receiptUrl: {
        type: String // Will store base64 data URL
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    adminNotes: String,
    userNotes: String,
    matchedWithdrawalId: String
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Deposit', DepositSchema);