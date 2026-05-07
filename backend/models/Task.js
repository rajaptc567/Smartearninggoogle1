
import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a task title'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    link: {
        type: String,
        required: [true, 'Please add a target link']
    },
    type: {
        type: String,
        enum: ['Video', 'Link', 'Social', 'Subscription'],
        default: 'Link'
    },
    platform: {
        type: String,
        enum: ['YouTube', 'Facebook', 'Instagram', 'Telegram', 'TikTok', 'X', 'Other'],
        default: 'Other'
    },
    action: {
        type: String,
        enum: ['Watch', 'Follow', 'Like', 'Subscribe', 'Comment', 'Share'],
        default: 'Watch'
    },
    category: {
        type: String,
        default: 'General'
    },
    priority: {
        type: Number,
        default: 0
    },
    frequency: {
        type: String,
        enum: ['Once', 'Daily', 'Weekly', 'Custom'],
        default: 'Once'
    },
    cooldownHours: {
        type: Number,
        default: 0
    },
    videoDurationType: {
        type: String,
        enum: ['Full', 'Specific'],
        default: 'Specific'
    },
    videoDurationValue: {
        type: Number,
        default: 60
    },
    requireProof: {
        type: Boolean,
        default: false
    },
    proofInstructions: {
        type: String,
        default: 'Please upload a screenshot as proof of completion.'
    },
    isRequiredForWithdrawal: {
        type: Boolean,
        default: false
    },
    targetPlanIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    }],
    targetCountries: [String],
    targetCurrencies: [{
        type: String,
        enum: ['USD', 'EUR', 'PKR']
    }],
    minPlanValue: {
        type: Number,
        default: 0
    },
    activeFrom: {
        type: Date
    },
    activeTo: {
        type: Date
    },
    maxGlobalCompletions: {
        type: Number,
        default: 0 // 0 for unlimited
    },
    currentGlobalCompletions: {
        type: Number,
        default: 0
    },
    rewardAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Disabled', 'Draft', 'Archived'],
        default: 'Active'
    }
}, {
    timestamps: { createdAt: 'createdAt' }
});

export default mongoose.model('Task', TaskSchema);
