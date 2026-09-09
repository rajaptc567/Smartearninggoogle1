import mongoose from 'mongoose';

const EmailLogSchema = new mongoose.Schema({
    event: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    sender: {
        type: String,
        required: true,
        trim: true
    },
    recipient: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    provider: {
        type: String,
        enum: ['existing', 'resend'],
        default: 'existing',
        required: true
    },
    status: {
        type: String,
        enum: ['Success', 'Failed'],
        required: true,
        index: true
    },
    error: {
        type: String,
        default: null
    },
    messageId: {
        type: String,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

export default mongoose.model('EmailLog', EmailLogSchema);
