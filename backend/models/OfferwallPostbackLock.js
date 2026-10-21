import mongoose from 'mongoose';

const OfferwallPostbackLockSchema = new mongoose.Schema({
    providerKey: {
        type: String,
        required: true,
    },
    externalTxId: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // TTL 1 hour
    }
});

// Atomic coordination: ensure only one postback is processed per provider+tx
OfferwallPostbackLockSchema.index({ providerKey: 1, externalTxId: 1 }, { unique: true });

export default mongoose.model('OfferwallPostbackLock', OfferwallPostbackLockSchema);
