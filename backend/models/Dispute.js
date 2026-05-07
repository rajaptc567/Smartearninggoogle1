
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['User', 'Admin', 'System'],
        required: true
    },
    message: {
        type: String,
    },
    date: {
        type: Date,
        default: Date.now
    },
    attachmentUrl: { // URL or Base64 string for the image
        type: String,
    }
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
        type: String, // Base64 or URL for initial proof
    },
    status: {
        type: String,
        enum: ['Open', 'Processing', 'Resolved', 'Closed'],
        default: 'Open',
    },
    adminResponse: {
        type: String,
    },
    messages: [MessageSchema], // Use the defined sub-schema
    adminUnread: {
        type: Boolean,
        default: true, // Unread for admin when user creates it
    },
    userUnread: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Dispute', DisputeSchema);
