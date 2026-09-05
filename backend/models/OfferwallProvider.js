import mongoose from 'mongoose';

const OfferwallProviderSchema = new mongoose.Schema({
    providerKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['offerwall', 'survey', 'video', 'microtask', 'gaming'],
        default: 'offerwall'
    },
    group: {
        type: String,
        enum: ['Group A: Multi-Task / Offerwall', 'Group B: Survey Routers', 'Group C: Video / Gaming Ads', 'Group D: Micro-Tasks & Crowdsourcing'],
        default: 'Group A: Multi-Task / Offerwall'
    },
    enabled: {
        type: Boolean,
        default: false
    },
    appId: {
        type: String,
        default: ''
    },
    secretKey: {
        type: String,
        default: ''
    },
    postbackKey: {
        type: String,
        default: ''
    },
    iframeUrlTemplate: {
        type: String,
        default: ''
    },
    exchangeRateMultiplier: {
        type: Number,
        default: 1.0 // 1 USD received = 1 USD credited to worker taskEarningsBalance
    },
    ipWhitelist: {
        type: [String],
        default: []
    },
    requireSignature: {
        type: Boolean,
        default: true
    },
    signatureType: {
        type: String,
        enum: ['hmac_sha256', 'md5', 'sha1', 'sha256', 'ip_only', 'none', 'custom'],
        default: 'none'
    },
    testMode: {
        type: Boolean,
        default: false
    },
    customConfig: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['NOT_STARTED', 'CREDENTIALS_PENDING', 'SANDBOX', 'TESTING', 'PRODUCTION_READY', 'ACTIVE', 'DISABLED', 'SUSPENDED'],
        default: 'NOT_STARTED'
    },
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Submitted', 'Under Review', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    integrationStatus: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Configured', 'Tested', 'Verified'],
        default: 'Not Started'
    },
    userRevenueSharePercent: {
        type: Number,
        default: 70, // User gets 70% of gross revenue by default
        min: 0,
        max: 100
    },
    platformRevenueSharePercent: {
        type: Number,
        default: 30, // Platform retains 30% of gross revenue
        min: 0,
        max: 100
    },
    riskThresholdUSD: {
        type: Number,
        default: 50.0 // Single transactions above this trigger risk review
    },
    holdRewards: {
        type: Boolean,
        default: false
    },
    holdThresholdUSD: {
        type: Number,
        default: 25.0
    },
    totalGrossPayoutUSD: {
        type: Number,
        default: 0
    },
    totalUserPayoutUSD: {
        type: Number,
        default: 0
    },
    totalPlatformRevenueUSD: {
        type: Number,
        default: 0
    },
    totalPostbackCount: {
        type: Number,
        default: 0
    },
    totalReversalCount: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ''
    },
    badge: {
        type: String,
        default: ''
    },
    icon: {
        type: String,
        default: '⚡'
    },
    technicalReadinessScore: {
        type: Number,
        default: 100 // 0-100%
    },
    approvalLikelihoodScore: {
        type: String,
        default: 'High' // 'High', 'Moderate', 'Requires Review'
    },
    complianceNotes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

OfferwallProviderSchema.index({ providerKey: 1 });
OfferwallProviderSchema.index({ enabled: 1, category: 1 });

export default mongoose.model('OfferwallProvider', OfferwallProviderSchema);
