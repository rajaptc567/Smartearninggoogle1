
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    senderType: {
        type: String,
        enum: ['Admin', 'System'],
        default: 'System',
    },
    subject: {
        type: String,
    },
    message: {
        type: String,
        required: true,
    },
    isPopup: {
        type: Boolean,
        default: false,
    },
    popupShown: {
        type: Boolean,
        default: false,
    },
    imageUrl: {
        type: String,
    },
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
    read: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('Notification', NotificationSchema);