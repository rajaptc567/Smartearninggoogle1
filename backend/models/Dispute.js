
import mongoose from 'mongoose';

const DisputeMessageSchema = new mongoose.Schema({
    sender: { type: String, enum: ['User', 'Admin', 'System'], required: true },
    message: { type: String, required: true },
    date: { type: Date, default: Date.now }
}, { _id: false });

const DisputeSchema = new mongoose.Schema({
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
        enum: ['Deposit', 'Withdrawal', 'Transfer'],
        required: true,
    },
    referenceId: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    proofUrl: {
        type: String, // Base64 or URL
    },
    status: {
        type: String,
        enum: ['Open', 'Processing', 'Resolved', 'Closed'],
        default: 'Open',
    },
    messages: [DisputeMessageSchema]
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Dispute', DisputeSchema);
