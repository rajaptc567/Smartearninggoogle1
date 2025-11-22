
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
    requirePlanMatchForCommission: {
        type: Boolean,
        default: false,
    },
    requireActivePlanForCommission: {
        type: Boolean,
        default: false,
    },
    withdrawalFrequency: {
        enabled: { type: Boolean, default: false },
        value: { type: Number, default: 1 },
        unit: { 
            type: String, 
            enum: ['hours', 'days', 'weeks', 'months'],
            default: 'days'
        }
    }
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
            requirePlanMatchForCommission: false,
            requireActivePlanForCommission: false,
            withdrawalFrequency: {
                enabled: false,
                value: 1,
                unit: 'days'
            }
        });
    }
    return settings;
};

export default mongoose.model('Setting', SettingSchema);