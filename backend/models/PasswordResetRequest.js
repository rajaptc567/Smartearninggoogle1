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
}, {
    timestamps: { createdAt: 'requestDate', updatedAt: true }
});

export default mongoose.model('PasswordResetRequest', PasswordResetRequestSchema);