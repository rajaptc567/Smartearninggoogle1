
import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
    isUserTransferEnabled: {
        type: Boolean,
        default: true,
    },
    restrictWithdrawalAmount: {
        type: Boolean,
        default: false,
    },
    // Add other settings here in the future
}, {
    // Use a capped collection of size 1 to ensure only one settings document exists
    capped: { size: 1024, max: 1 }
});

// Ensure a default settings document is created if one doesn't exist
SettingSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({
            isUserTransferEnabled: true,
            restrictWithdrawalAmount: false,
        });
    }
    return settings;
};

export default mongoose.model('Setting', SettingSchema);