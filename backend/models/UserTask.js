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
        required: [true, 'Please select a task category'],
        enum: ['Facebook', 'YouTube', 'WhatsApp', 'Website', 'Other']
    },
    subType: {
        type: String,
        required: [true, 'Please select task action type'],
        enum: ['Comment', 'Like', 'Follow', 'Subscribe', 'Watch Time', 'Sign-up', 'Share', 'Other']
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
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'On Hold', 'Paid', 'Completed'],
        default: 'Pending'
    },
    adminNotes: {
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

export default mongoose.model('UserTask', UserTaskSchema);
