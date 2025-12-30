
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
    isRequiredForWithdrawal: {
        type: Boolean,
        default: false
    },
    rewardAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Disabled'],
        default: 'Active'
    }
}, {
    timestamps: { createdAt: 'createdAt' }
});

export default mongoose.model('Task', TaskSchema);
