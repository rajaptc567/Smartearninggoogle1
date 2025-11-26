
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

export default mongoose.model('Transfer', TransferSchema);