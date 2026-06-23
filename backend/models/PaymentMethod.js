import mongoose from 'mongoose';

const PaymentMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
        default: 'USD',
    },
    type: {
        type: String,
        enum: ['Deposit', 'Withdrawal'],
        required: true,
    },
    accountTitle: {
        type: String,
    },
    accountNumber: {
        type: String,
    },
    instructions: {
        type: String,
    },
    gatewayMode: {
        type: String,
        enum: ['manual', 'paynow'],
        default: 'manual',
    },
    gatewayTitle: {
        type: String,
        default: 'Checkout Payment Gateway',
    },
    gatewayDescription: {
        type: String,
        default: 'Click below to pay safely using your PayPal, Stripe checkout system, or Credit Card.',
    },
    payNowUrl: {
        type: String,
        default: '',
    },
    payNowButtonText: {
        type: String,
        default: 'Pay Now',
    },
    isPopupViewEnabled: {
        type: Boolean,
        default: false,
    },
    popupViewTitle: {
        type: String,
        default: 'Verify & Proceed',
    },
    popupViewInstructions: {
        type: String,
        default: '',
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
    qrCodeUrl: {
        type: String,
    },
    p2pWithdrawalId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Withdrawal', // Link to the withdrawal if this is a P2P method
    },
    customFields: [{
        title: { type: String, required: true },
        value: { type: String, required: true }
    }],
    confirmationFields: [{
        label: { type: String, required: true },
        placeholder: { type: String },
        type: { type: String, default: 'text' },
        required: { type: Boolean, default: true }
    }],
    customLabels: {
        providerLabel: { type: String },
        accountTitleLabel: { type: String },
        accountNumberLabel: { type: String }
    },
    howToDeposit: {
        enabled: { type: Boolean, default: false },
        showBeforePayment: { type: Boolean, default: false },
        dropdownMode: { type: Boolean, default: false },
        steps: [{
            title: String,
            description: String,
            imageUrl: String
        }]
    }
}, {
    timestamps: true
});

export default mongoose.model('PaymentMethod', PaymentMethodSchema);