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
    proofImage: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
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
