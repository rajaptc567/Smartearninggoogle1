
import mongoose from 'mongoose';

const CommissionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
    },
    value: {
        type: Number,
        required: true,
    },
}, { _id: false });

const CurrencyValueSchema = new mongoose.Schema({
    currency: { type: String, enum: ['USD', 'EUR', 'PKR'], required: true },
    value: { type: Number, required: true }
}, { _id: false });

const InvestmentPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a plan name'],
        unique: true,
        trim: true,
    },
    prices: [CurrencyValueSchema],
    durationDays: {
        type: Number,
        required: true,
        default: 0, // 0 for unlimited
    },
    minWithdraw: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
    },
    status: {
        type: String,
        enum: ['Active', 'Disabled'],
        default: 'Active',
    },
    directReferralLimit: {
        type: Number,
        default: 0, // 0 for unlimited
    },
    directCommissions: [CommissionSchema],
    indirectCommissions: [CommissionSchema],
    commissionDeductions: {
        afterMaxPayout: CommissionSchema,
        afterMaxEarning: CommissionSchema,
        afterMaxDirect: CommissionSchema,
    },
    autoUpgrade: {
        enabled: { type: Boolean, default: false },
        toPlanId: { type: String },
    },
    holdPosition: {
        enabled: { type: Boolean, default: false },
        slots: [Number],
    },
    // Legacy field for backward compatibility
    price: { type: Number, default: 0 },
}, {
    timestamps: true
});

export default mongoose.model('InvestmentPlan', InvestmentPlanSchema);
