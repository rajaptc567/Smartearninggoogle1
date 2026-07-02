import mongoose from 'mongoose';

const TemplateLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    username: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
    },
    userPhone: {
        type: String,
    },
    templateKey: {
        type: String,
        required: true,
    },
    templateName: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['email', 'whatsapp'],
        required: true,
    },
    recipient: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
    },
    body: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Success', 'Failed'],
        default: 'Success',
    },
    error: {
        type: String,
    },
    sentBy: {
        type: String,
        enum: ['System', 'Admin'],
        default: 'System',
    }
}, {
    timestamps: { createdAt: 'date', updatedAt: true }
});

export default mongoose.model('TemplateLog', TemplateLogSchema);
