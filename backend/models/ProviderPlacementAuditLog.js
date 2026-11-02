import mongoose from 'mongoose';

const ProviderPlacementAuditLogSchema = new mongoose.Schema({
    placementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProviderPlacement',
        required: true,
        index: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    adminUsername: {
        type: String,
        default: 'Admin'
    },
    action: {
        type: String,
        enum: ['CREATED', 'UPDATED', 'DELETED', 'TOGGLED'],
        required: true
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

export default mongoose.model('ProviderPlacementAuditLog', ProviderPlacementAuditLogSchema);
