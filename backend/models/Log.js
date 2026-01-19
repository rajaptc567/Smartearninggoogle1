
import mongoose from 'mongoose';

const LogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
    },
    affectedUser: {
        type: String,
    },
    details: {
        type: String,
    },
    performedBy: {
        type: String, 
        required: true,
    },
    ipAddress: {
        type: String,
    },
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: { createdAt: 'timestamp', updatedAt: false } // No updatedAt for logs
});

// --- AUDIT IMMUTABILITY ---
// Prevent updates to existing logs
LogSchema.pre('save', function(next) {
    if (!this.isNew) {
        return next(new Error('Audit logs are immutable and cannot be updated.'));
    }
    next();
});

// Prevent deletion or modification via query methods
const preventMutation = function(next) {
    next(new Error('Audit logs are immutable. Operations like update or delete are prohibited.'));
};

LogSchema.pre('updateOne', preventMutation);
LogSchema.pre('updateMany', preventMutation);
LogSchema.pre('findOneAndUpdate', preventMutation);
LogSchema.pre('deleteOne', preventMutation);
LogSchema.pre('deleteMany', preventMutation);
LogSchema.pre('findOneAndDelete', preventMutation);

export default mongoose.model('Log', LogSchema);
