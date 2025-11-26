
import mongoose from 'mongoose';

const AmountLimitSchema = new mongoose.Schema({
    currency: { type: String, enum: ['USD', 'EUR', 'PKR'], required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10000 }
}, { _id: false });

const PaymentMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['Deposit', 'Withdrawal'],
        required: true,
    },
    accountTitle: {
        type: String,
        required: true,
    },
    accountNumber: {
        type: String,
        required: true,
    },
    instructions: {
        type: String,
    },
    supportedCurrencies: {
        type: [String],
        enum: ['USD', 'EUR', 'PKR'],
        default: ['USD']
    },
    amountLimits: [AmountLimitSchema],
    feePercent: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['Enabled', 'Disabled'],
        default: 'Enabled',
    },
    logoUrl: {
        type: String,
    },
    p2pWithdrawalId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Withdrawal',
    },
    // Legacy fields
    minAmount: { type: Number, default: 0 },
    maxAmount: { type: Number, default: 10000 },
}, {
    timestamps: true
});

export default mongoose.model('PaymentMethod', PaymentMethodSchema);
