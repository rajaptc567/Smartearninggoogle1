
import mongoose from 'mongoose';

const TransferSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    senderName: {
        type: String,
        required: true,
    },
    recipientId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    recipientName: {
        type: String,
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
    fee: {
        type: Number,
        default: 0
    },
    totalDeducted: {
        type: Number
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    adminNotes: {
        type: String,
    },
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

TransferSchema.index({ senderId: 1, date: -1 });
TransferSchema.index({ recipientId: 1, date: -1 });
TransferSchema.index({ status: 1 });

export default mongoose.model('Transfer', TransferSchema);
