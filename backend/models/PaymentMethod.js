
import mongoose from 'mongoose';

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
    minAmount: {
        type: Number,
        default: 0,
    },
    maxAmount: {
        type: Number,
        default: 10000,
    },
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
        ref: 'Withdrawal', // Link to the withdrawal if this is a P2P method
    }
}, {
    timestamps: true
});

export default mongoose.model('PaymentMethod', PaymentMethodSchema);
