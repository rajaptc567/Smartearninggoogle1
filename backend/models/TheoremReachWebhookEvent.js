import mongoose from 'mongoose';

const TheoremReachWebhookEventSchema = new mongoose.Schema({
    encSalt: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    username: {
        type: String
    },
    apiKey: {
        type: String,
        trim: true
    },
    at: {
        type: Date
    },
    externalTxId: {
        type: String
    },
    reversedTransactions: [{
        type: String
    }],
    payload: {
        type: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: ['Processed', 'Duplicate', 'IgnoredUnmatchedReversal', 'UserNotFound', 'UnhandledEventType', 'Error'],
        default: 'Processed',
        index: true
    },
    errorMessage: {
        type: String
    }
}, {
    timestamps: true
});

TheoremReachWebhookEventSchema.index({ createdAt: -1 });

export default mongoose.model('TheoremReachWebhookEvent', TheoremReachWebhookEventSchema);
