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
    }
}, { timestamps: true });

export default mongoose.model('UserTaskSubmission', UserTaskSubmissionSchema);
