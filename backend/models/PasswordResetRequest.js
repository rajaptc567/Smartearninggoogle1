import mongoose from 'mongoose';

const PasswordResetRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    userEmail: {
        type: String,
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Handled'],
        default: 'Pending',
    },
    process: {
        type: String,
        default: 'User requested password reset',
    },
    sendType: {
        type: String,
        enum: ['None', 'Automatic', 'Manual'],
        default: 'None',
    },
    channel: {
        type: String,
        default: 'None',
    },
    sentAt: {
        type: Date,
        default: null,
    },
    resetToken: {
        type: String,
        default: null,
    },
    resetLink: {
        type: String,
        default: null,
    },
    handledAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: { createdAt: 'requestDate', updatedAt: true }
});

export default mongoose.model('PasswordResetRequest', PasswordResetRequestSchema);