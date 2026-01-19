
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
        type: String, // e.g., 'admin', 'system'
        required: true,
    },
}, {
    timestamps: { createdAt: 'timestamp' }
});

export default mongoose.model('Log', LogSchema);