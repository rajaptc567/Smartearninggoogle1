
import mongoose from 'mongoose';

const RuleSchema = new mongoose.Schema({
    targetPlanId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan',
        required: true,
    },
    targetPlanName: {
        type: String,
        required: true,
    },
    
    // Conditions
    requiredPlanIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    }],
    requiredPlanNames: [String], // Stored for easier display reference
    
    minTotalEarnings: {
        type: Number,
        default: 0
    },
    maxTotalEarnings: {
        type: Number, // Optional: e.g., max earning limit to join this plan
    },
    
    minDirectReferrals: {
        type: Number,
        default: 0
    },

    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
        default: 'USD',
    },
}, {
    timestamps: true
});

export default mongoose.model('Rule', RuleSchema);
