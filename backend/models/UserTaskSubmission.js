import mongoose from 'mongoose';

const UserTaskSubmissionSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserTask',
        required: true
    },
    workerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    workerName: {
        type: String,
        required: true
    },
    proofText: {
        type: String,
        default: ''
    },
    proofUsername: {
        type: String,
        default: ''
    },
    proofUserIdVal: {
        type: String,
        default: ''
    },
    proofEmail: {
        type: String,
        default: ''
    },
    proofImage: {
        type: String,
        default: ''
    },
    submittedProofs: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Disputed', 'Paid'],
        default: 'Pending'
    },
    rejectionReason: { type: String, default: '' },
    rejectedAt: { type: Date },
    disputeDeadline: { type: Date },
    disputeOpened: { type: Boolean, default: false },
    disputeId: { type: mongoose.Schema.ObjectId, ref: 'Dispute' },
    adminNotes: {
        type: String,
        default: ''
    },
    rewardAmount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    taskTitle: {
        type: String
    },
    taskCategory: {
        type: String
    },
    disputeReviewDeadline: { type: Date },
    secondDisputeDeadline: { type: Date },
    disputeStage: {
        type: String,
        enum: ['None', 'CreatorReview', 'RejectedByCreator', 'Escalated', 'Resolved'],
        default: 'None'
    },
    disputeCreatorNotes: { type: String, default: '' },
    disputeReason: { type: String, default: '' },
    disputeProofUrl: { type: String, default: '' },
    paid: { type: Boolean, default: false },
    rewardClaimed: { type: Boolean, default: false },
    rewardTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    rewardPaidAt: { type: Date }
}, { timestamps: true });

UserTaskSubmissionSchema.index({ taskId: 1, workerId: 1 });
UserTaskSubmissionSchema.index({ workerId: 1, status: 1 });
UserTaskSubmissionSchema.index({ taskId: 1, status: 1 });
UserTaskSubmissionSchema.index({ status: 1 });

export default mongoose.model('UserTaskSubmission', UserTaskSubmissionSchema);
