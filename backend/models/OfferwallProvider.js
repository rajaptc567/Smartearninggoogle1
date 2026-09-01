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
