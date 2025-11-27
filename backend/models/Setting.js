
import mongoose from 'mongoose';

const TransferTierSchema = new mongoose.Schema({
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true },
    feeType: { type: String, enum: ['percentage', 'fixed'], required: true },
    feeValue: { type: Number, required: true },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'PKR'],
        required: true,
    },
    enabled: { type: Boolean, default: true }
}, { _id: false });

const SettingSchema = new mongoose.Schema({
    isUserTransferEnabled: {
        type: Boolean,
        default: true,
    },
    transferConfig: {
        enabled: { type: Boolean, default: true },
        tiers: [TransferTierSchema]
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
            transferConfig: {
                enabled: true,
                tiers: [
                    // Default examples for each currency
                    { minAmount: 1, maxAmount: 100, feeType: 'fixed', feeValue: 1, currency: 'USD', enabled: true },
                    { minAmount: 101, maxAmount: 10000, feeType: 'percentage', feeValue: 2, currency: 'USD', enabled: true },
                    { minAmount: 1, maxAmount: 10000, feeType: 'percentage', feeValue: 1.5, currency: 'EUR', enabled: true },
                    { minAmount: 100, maxAmount: 50000, feeType: 'fixed', feeValue: 150, currency: 'PKR', enabled: true }
                ]
            },
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