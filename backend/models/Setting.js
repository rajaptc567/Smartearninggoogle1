
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

const DemoProfileSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    currency: { type: String, enum: ['USD', 'EUR', 'PKR'], required: true },
});

const DemoActivityTemplateSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    template: { type: String, required: true },
    type: { type: String, enum: ['withdrawal', 'transfer', 'joined', 'deposit', 'plan'], required: true },
    enabled: { type: Boolean, default: true },
});

const SettingSchema = new mongoose.Schema({
    isUserTransferEnabled: {
        type: Boolean,
        default: true,
    },
    transferConfig: {
        enabled: { type: Boolean, default: true },
        tiers: [TransferTierSchema]
    },
    exchangeRates: {
        USD: { type: Number, default: 1 },
        EUR: { type: Number, default: 0.92 },
        PKR: { type: Number, default: 278.50 }
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
    },
    demoProfiles: [DemoProfileSchema],
    demoActivityTemplates: [DemoActivityTemplateSchema],
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
                    { minAmount: 1, maxAmount: 100, feeType: 'fixed', feeValue: 1, currency: 'USD', enabled: true },
                    { minAmount: 101, maxAmount: 10000, feeType: 'percentage', feeValue: 2, currency: 'USD', enabled: true },
                    { minAmount: 1, maxAmount: 10000, feeType: 'percentage', feeValue: 1.5, currency: 'EUR', enabled: true },
                    { minAmount: 100, maxAmount: 50000, feeType: 'fixed', feeValue: 150, currency: 'PKR', enabled: true }
                ]
            },
            exchangeRates: {
                USD: 1,
                EUR: 0.92,
                PKR: 278.50
            },
            restrictWithdrawalAmount: false,
            requirePlanMatchForCommission: false,
            requireActivePlanForCommission: false,
            withdrawalFrequency: {
                enabled: false,
                value: 1,
                unit: 'days'
            },
            demoProfiles: [
                { _id: '1', name: 'John D.', country: 'United States', currency: 'USD' },
                { _id: '2', name: 'Maria S.', country: 'Germany', currency: 'EUR' },
                { _id: '3', name: 'Ali K.', country: 'Pakistan', currency: 'PKR' },
                { _id: '4', name: 'Fatima Z.', country: 'Pakistan', currency: 'PKR' },
                { _id: '5', name: 'Chloe M.', country: 'France', currency: 'EUR' },
                { _id: '6', name: 'David L.', country: 'Canada', currency: 'USD' },
            ],
            demoActivityTemplates: [
                { _id: 't1', template: '{name} from {country} just joined SmartEarning!', type: 'joined', enabled: true },
                { _id: 't2', template: '{name} made a new deposit of {amount}', type: 'deposit', enabled: true },
                { _id: 't3', template: '{name} successfully withdrew {amount}', type: 'withdrawal', enabled: true },
                { _id: 't4', template: '{name} upgraded to the {plan} plan', type: 'plan', enabled: true },
                { _id: 't5', template: '{name} sent funds to another member', type: 'transfer', enabled: false },
            ],
        });
    }
    return settings;
};

export default mongoose.model('Setting', SettingSchema);
