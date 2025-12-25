
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

const InvestmentPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a plan name'],
        trim: true,
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
        default: 'USD',
    },
    price: {
        type: Number,
        required: [true, 'Please add a price'],
    },
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
    equivalentPlanIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    }],
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
    hold_slots: {
        type: [Number],
        default: []
    },
    customFeatures: {
        type: [String],
        default: []
    },
    displayConfig: {
        showDuration: { type: Boolean, default: true },
        showMinWithdraw: { type: Boolean, default: true },
        showDirectReferrals: { type: Boolean, default: true },
        showDirectCommission: { type: Boolean, default: true },
        showIndirectCommission: { type: Boolean, default: true },
    }
}, {
    timestamps: true
});

InvestmentPlanSchema.index({ name: 1, currency: 1 }, { unique: true });

export default mongoose.model('InvestmentPlan', InvestmentPlanSchema);
