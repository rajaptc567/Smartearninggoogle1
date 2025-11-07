const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true },
}, { _id: false });

const investmentPlanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, default: 0 }, // 0 for unlimited
    minWithdraw: { type: Number, required: true },
    description: String,
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' },
    directReferralLimit: { type: Number, default: 0 }, // 0 for unlimited
    directCommission: commissionSchema,
    indirectCommissions: [commissionSchema],
    commissionDeductions: {
        afterMaxPayout: commissionSchema,
        afterMaxEarning: commissionSchema,
        afterMaxDirect: commissionSchema,
    },
    autoUpgrade: {
        enabled: { type: Boolean, default: false },
        toPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvestmentPlan' },
    },
    holdPosition: {
        enabled: { type: Boolean, default: false },
        slots: [Number],
    },
}, { timestamps: true });

investmentPlanSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

investmentPlanSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
    }
});

const InvestmentPlan = mongoose.model('InvestmentPlan', investmentPlanSchema);
module.exports = InvestmentPlan;
