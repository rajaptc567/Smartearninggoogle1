import mongoose from 'mongoose';

const UserTaskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: [true, 'Please select a task category']
    },
    subType: {
        type: String,
        required: [true, 'Please select task action type']
    },
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
        required: [true, 'Please add a target URL or link']
    },
    targetQuantity: {
        type: Number,
        required: [true, 'Please specify target quantity'],
        min: 1
    },
    currentCompletions: {
        type: Number,
        default: 0
    },
    rewardPerTask: {
        type: Number,
        required: [true, 'Please specify reward amount per task'],
        min: 0.01
    },
    totalBudget: {
        type: Number,
        required: true
    },
    adminCommission: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'PKR']
    },
    requireTextProof: { type: Boolean, default: false },
    textProofInstruction: { type: String, default: '' },
    requireUsername: { type: Boolean, default: false },
    usernameInstruction: { type: String, default: '' },
    requireUserId: { type: Boolean, default: false },
    userIdInstruction: { type: String, default: '' },
    requireEmail: { type: Boolean, default: false },
    emailInstruction: { type: String, default: '' },
    requireScreenshot: { type: Boolean, default: true },
    screenshotInstruction: { type: String, default: 'Please upload screenshot proof of completion.' },
    requiredProofs: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'On Hold', 'Paid', 'Completed'],
        default: 'Pending'
    },
    history: [{
        action: { type: String, required: true },
        previousStatus: { type: String },
        newStatus: { type: String },
        timestamp: { type: Date, default: Date.now },
        performedBy: { type: String },
        details: { type: String }
    }],
    adminNotes: {
        type: String,
        default: ''
    },
    baseFeeCharged: {
        type: Number,
        default: 0
    },
    fundingSourceBreakdown: {
        fromInvestmentUSD: { type: Number, default: 0 },
        fromTaskEarningsUSD: { type: Number, default: 0 },
        fromRefundsUSD: { type: Number, default: 0 }
    },
    refundedBreakdown: {
        fromInvestmentUSD: { type: Number, default: 0 },
        fromTaskEarningsUSD: { type: Number, default: 0 },
        fromRefundsUSD: { type: Number, default: 0 }
    },
    reviewRequested: {
        type: Boolean,
        default: false
    },
    resubmittedForReview: {
        type: Boolean,
        default: false
    },
    userReviewMessage: {
        type: String,
        default: ''
    },
    completedUsers: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }],
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

UserTaskSchema.index({ userId: 1, status: 1 });
UserTaskSchema.index({ category: 1, status: 1 });
UserTaskSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('UserTask', UserTaskSchema);
