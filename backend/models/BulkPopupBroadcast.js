import mongoose from 'mongoose';

const BulkPopupBroadcastSchema = new mongoose.Schema({
    subject: {
        type: String,
    },
    message: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
    },
    targetType: {
        type: String,
        default: 'all',
    },
    targetIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }],
    targetPlanIds: [{
        type: String
    }],
    displayTrigger: {
        type: String,
        default: 'login',
    },
    frequency: {
        type: String,
        default: 'once_per_user',
    },
    actionButtonText: {
        type: String,
    },
    actionButtonLink: {
        type: String,
    },
    selectedChannels: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['active', 'archived', 'paused'],
        default: 'active',
    },
    sentCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

const BulkPopupBroadcast = mongoose.model('BulkPopupBroadcast', BulkPopupBroadcastSchema);
export default BulkPopupBroadcast;
