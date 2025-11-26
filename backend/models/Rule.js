

import mongoose from 'mongoose';

const RuleSchema = new mongoose.Schema({
    fromPlan: {
        type: String,
        required: true,
    },
    toPlan: {
        type: String,
        required: true,
    },
    requiredEarnings: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'PKR'],
        required: true,
        default: 'USD',
    },
}, {
    timestamps: true
});

export default mongoose.model('Rule', RuleSchema);
