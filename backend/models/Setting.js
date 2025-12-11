
import mongoose from 'mongoose';

const TransferTierSchema = new mongoose.Schema({
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true },
    feeType: { type: String, enum: ['percentage', 'fixed'], required: true },
    feeValue: { type: Number, required: true },
    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
    },
    enabled: { type: Boolean, default: true }
}, { _id: false });

const DemoProfileSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    currency: { type: String, enum: ['EUR', 'PKR', 'USD'], required: true },
});

const DemoActivityTemplateSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    template: { type: String, required: true },
    type: { type: String, enum: ['withdrawal', 'transfer', 'joined', 'deposit', 'plan', 'commission'], required: true },
    enabled: { type: Boolean, default: true },
});

const NoticeSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    message: { type: String, required: true },
    targetType: { type: String, enum: ['all', 'plan', 'inactive', 'manual'], required: true },
    targetIds: [String],
    style: { type: String, enum: ['sliding', 'blinking', 'static'], default: 'sliding' },
    speed: { type: String, enum: ['slow', 'normal', 'fast'], default: 'normal' },
    enabled: { type: Boolean, default: true },
    color: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
    startTime: { type: String }, // ISO Date string
    endTime: { type: String } // ISO Date string
});

const PlanEquivalencyGroupSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    pkrPlanId: { type: String },
    eurPlanId: { type: String },
    usdPlanId: { type: String },
});

const HomepageContentSchema = new mongoose.Schema({
    heroTitle: { type: String, default: "Invest in Your Future, Grow Your Network" },
    heroSubtitle: { type: String, default: "SmartEarning provides a secure platform to manage your investments and leverage your network for greater earning potential." },
    feature1Title: { type: String, default: "Secure Investments" },
    feature1Desc: { type: String, default: "Your funds and data are protected with industry-standard security measures." },
    feature2Title: { type: String, default: "Powerful MLM System" },
    feature2Desc: { type: String, default: "Earn commissions not just from your referrals, but from their referrals too." },
    feature3Title: { type: String, default: "Real-Time Tracking" },
    feature3Desc: { type: String, default: "Monitor your earnings, network growth, and transactions with our intuitive dashboard." },
    videoTitle: { type: String, default: "See How It Works" },
    videoDesc: { type: String, default: "Discover the power of our platform in this short overview. Watch how you can leverage your network to achieve your financial goals." },
    multiCurrencyTitle: { type: String, default: "Global Reach, Local Convenience" },
    multiCurrencyDesc: { type: String, default: "Our platform is built for a global audience. Invest, earn, and withdraw in the currency that works for you." },
    mlmTitle: { type: String, default: "Understanding Our Earning System" },
    mlmDesc: { type: String, default: "Our platform uses a Multi-Level Marketing (MLM) structure, which allows you to earn commissions from multiple levels of your network." },
    ctaTitle: { type: String, default: "Ready to Start Your Journey?" },
    ctaDesc: { type: String, default: "Join a community of forward-thinkers. Sign up today and unlock your earning potential." }
}, { _id: false });


const SettingSchema = new mongoose.Schema({
    isUserTransferEnabled: {
        type: Boolean,
        default: true,
    },
    transferConfig: {
        enabled: { type: Boolean, default: true },
        tiers: [TransferTierSchema],
        allowCrossCurrency: { type: Boolean, default: false }
    },
    exchangeRates: {
        USD: { type: Number, default: 1 }, 
        EUR: { type: Number, default: 0.92 },
        PKR: { type: Number, default: 278.00 }
    },
    restrictWithdrawalAmount: {
        type: Boolean,
        default: false,
    },
    requirePlanMatchForCommission: {
        type: Boolean,
        default: false,
    },
    requireActivePlanForCommission: {
        type: Boolean,
        default: false,
    },
    oneTimeCommissionPerGroup: {
        type: Boolean,
        default: false,
    },
    recurringCommissionPlanIds: {
        type: [String],
        default: [],
    },
    requireUplineEligibility: {
        type: Boolean,
        default: false,
    },
    withdrawalFrequency: {
        enabled: { type: Boolean, default: false },
        value: { type: Number, default: 1 },
        unit: { 
            type: String, 
            enum: ['hours', 'days', 'weeks', 'months'],
            default: 'days'
        }
    },
    demoProfiles: [DemoProfileSchema],
    demoActivityTemplates: [DemoActivityTemplateSchema],
    notices: [NoticeSchema],
    tickerSpeed: { type: Number, default: 6 },
    tickerContentSource: {
        type: String,
        enum: ['hybrid', 'real_only', 'demo_only'],
        default: 'hybrid',
    },
    tickerRealActivities: {
        deposits: { type: Boolean, default: true },
        withdrawals: { type: Boolean, default: true },
        registrations: { type: Boolean, default: true },
        commissions: { type: Boolean, default: true },
        transfers: { type: Boolean, default: true },
        planPurchases: { type: Boolean, default: true }
    },
    tickerRealActivityConfig: {
        minAmount: { type: Number, default: 0 },
        privacyMode: { type: Boolean, default: false },
        excludedCurrencies: { type: [String], default: [] }
    },
    tickerHiddenEventIds: {
        type: [String],
        default: []
    },
    tickerRealActivityTemplates: {
        deposits: { type: [String], default: ['<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>'] },
        withdrawals: { type: [String], default: ['<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>'] },
        registrations: { type: [String], default: ['<strong class="font-semibold">{name}</strong> from {country} just joined!'] },
        commissions: { type: [String], default: ['<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong> commission ({source})'] },
        transfers: { type: [String], default: ['<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong> to {recipient}'] },
        planPurchases: { type: [String], default: ['<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({amount})'] }
    },
    tickerDemoAmountRanges: {
        EUR: { min: { type: Number, default: 50 }, max: { type: Number, default: 500 } },
        PKR: { min: { type: Number, default: 5000 }, max: { type: Number, default: 50000 } },
        USD: { min: { type: Number, default: 50 }, max: { type: Number, default: 500 } },
    },
    planEquivalencyGroups: [PlanEquivalencyGroupSchema],
    homepageVideoUrl: {
        type: String,
        default: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1'
    },
    homepageContent: {
        type: HomepageContentSchema,
        default: () => ({})
    },
    featuredPlanIds: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true
});


const defaultDemoProfiles = [
    {"_id":"1","name":"John S.","country":"United States","currency":"USD"},
    {"_id":"2","name":"Maria G.","country":"Germany","currency":"EUR"},
    {"_id":"3","name":"Ali K.","country":"Pakistan","currency":"PKR"},
    {"_id":"4","name":"Emily R.","country":"Canada","currency":"USD"},
    {"_id":"5","name":"Fatima Z.","country":"Pakistan","currency":"PKR"},
    {"_id":"6","name":"Lucas M.","country":"France","currency":"EUR"},
    {"_id":"7","name":"Michael B.","country":"United Kingdom","currency":"USD"},
    {"_id":"8","name":"Ahmed R.","country":"Pakistan","currency":"PKR"},
    {"_id":"9","name":"Sophia L.","country":"Australia","currency":"USD"},
    {"_id":"10","name":"Aisha M.","country":"Pakistan","currency":"PKR"},
];

const defaultDemoTemplates = [
    {"_id":"t1","template":"{name} from {country} is now part of the community!","type":"joined","enabled":true},
    {"_id":"t36","template":"A new deposit of {amount} was made by {name}.","type":"deposit","enabled":true},
    {"_id":"t71","template":"{name} just cashed out {amount}!","type":"withdrawal","enabled":true},
    {"_id":"t106","template":"{name} just upgraded to the {plan} plan!","type":"plan","enabled":true},
    {"_id":"t141","template":"{name} sent funds to another member.","type":"transfer","enabled":false},
];

const defaultSettingsObject = {
    isUserTransferEnabled: true,
    transferConfig: {
        enabled: true,
        tiers: [
            { minAmount: 1, maxAmount: 10000, feeType: 'percentage', feeValue: 1.5, currency: 'EUR', enabled: true },
            { minAmount: 100, maxAmount: 50000, feeType: 'fixed', feeValue: 150, currency: 'PKR', enabled: true },
            { minAmount: 10, maxAmount: 5000, feeType: 'fixed', feeValue: 2, currency: 'USD', enabled: true }
        ],
        allowCrossCurrency: false,
    },
    exchangeRates: { USD: 1, EUR: 0.92, PKR: 278.00 },
    restrictWithdrawalAmount: false,
    requirePlanMatchForCommission: false,
    requireActivePlanForCommission: false,
    oneTimeCommissionPerGroup: false,
    recurringCommissionPlanIds: [],
    requireUplineEligibility: false,
    withdrawalFrequency: { enabled: false, value: 1, unit: 'days' },
    demoProfiles: defaultDemoProfiles,
    demoActivityTemplates: defaultDemoTemplates,
    notices: [], // Default empty notices
    tickerSpeed: 6,
    tickerContentSource: 'hybrid',
    tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
    tickerRealActivityConfig: { minAmount: 0, privacyMode: false, excludedCurrencies: [] },
    tickerHiddenEventIds: [],
    tickerRealActivityTemplates: {
        deposits: [
            '<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>',
            'New deposit of <strong>{amount}</strong> from <strong class="font-semibold">{name}</strong>',
            '<strong class="font-semibold">{name}</strong> just added <strong>{amount}</strong> to their wallet',
            'Funds received! <strong class="font-semibold">{name}</strong>: <strong>{amount}</strong>',
            '<strong>{amount}</strong> deposit confirmed for <strong class="font-semibold">{name}</strong>'
        ],
        withdrawals: [
            '<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>',
            'Payout of <strong>{amount}</strong> sent to <strong class="font-semibold">{name}</strong>',
            '<strong class="font-semibold">{name}</strong> just cashed out <strong>{amount}</strong>',
            'Withdrawal processed: <strong class="font-semibold">{name}</strong> (<strong>{amount}</strong>)',
            'Congratulations <strong class="font-semibold">{name}</strong> on your withdrawal of <strong>{amount}</strong>'
        ],
        registrations: [
            '<strong class="font-semibold">{name}</strong> from {country} just joined!',
            'Welcome <strong class="font-semibold">{name}</strong> from {country} to the community',
            'New member alert: <strong class="font-semibold">{name}</strong> ({country})',
            '<strong class="font-semibold">{name}</strong> has registered from {country}',
            'Our community is growing! Welcome <strong class="font-semibold">{name}</strong>'
        ],
        commissions: [
            '<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong> commission ({source})',
            '<strong>{amount}</strong> commission for <strong class="font-semibold">{name}</strong> ({source})',
            '<strong class="font-semibold">{name}</strong> just made <strong>{amount}</strong> from referral',
            'Referral bonus! <strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong>',
            '<strong>{amount}</strong> added to <strong class="font-semibold">{name}</strong>\'s wallet ({source})'
        ],
        transfers: [
            '<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong> to {recipient}',
            'Fund transfer: <strong class="font-semibold">{name}</strong> sent <strong>{amount}</strong>',
            '<strong class="font-semibold">{name}</strong> sent <strong>{amount}</strong> to a friend',
            '<strong>{amount}</strong> transferred by <strong class="font-semibold">{name}</strong>',
            'Internal transfer of <strong>{amount}</strong> completed by <strong class="font-semibold">{name}</strong>'
        ],
        planPurchases: [
            '<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({amount})',
            '<strong class="font-semibold">{name}</strong> upgraded to <strong>{plan}</strong>',
            'New <strong>{plan}</strong> activation by <strong class="font-semibold">{name}</strong>',
            '<strong class="font-semibold">{name}</strong> started earning with <strong>{plan}</strong>',
            'Investment made: <strong class="font-semibold">{name}</strong> bought <strong>{plan}</strong>'
        ]
    },
    tickerDemoAmountRanges: {
        EUR: { min: 50, max: 500 },
        PKR: { min: 5000, max: 50000 },
        USD: { min: 50, max: 500 },
    },
    planEquivalencyGroups: [],
    homepageVideoUrl: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1',
    homepageContent: {
        heroTitle: "Invest in Your Future, Grow Your Network",
        heroSubtitle: "SmartEarning provides a secure platform to manage your investments and leverage your network for greater earning potential.",
        feature1Title: "Secure Investments",
        feature1Desc: "Your funds and data are protected with industry-standard security measures.",
        feature2Title: "Powerful MLM System",
        feature2Desc: "Earn commissions not just from your referrals, but from their referrals too.",
        feature3Title: "Real-Time Tracking",
        feature3Desc: "Monitor your earnings, network growth, and transactions with our intuitive dashboard.",
        videoTitle: "See How It Works",
        videoDesc: "Discover the power of our platform in this short overview. Watch how you can leverage your network to achieve your financial goals.",
        multiCurrencyTitle: "Global Reach, Local Convenience",
        multiCurrencyDesc: "Our platform is built for a global audience. Invest, earn, and withdraw in the currency that works for you.",
        mlmTitle: "Understanding Our Earning System",
        mlmDesc: "Our platform uses a Multi-Level Marketing (MLM) structure, which allows you to earn commissions from multiple levels of your network.",
        ctaTitle: "Ready to Start Your Journey?",
        ctaDesc: "Join a community of forward-thinkers. Sign up today and unlock your earning potential."
    },
    featuredPlanIds: [],
};

// Ensure a default settings document is created if one doesn't exist
SettingSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    let needsSave = false;

    if (!settings) {
        settings = await this.create(defaultSettingsObject);
        return settings;
    }

    // Self-healing logic
    if (!settings.demoProfiles || settings.demoProfiles.length === 0) {
        settings.demoProfiles = defaultDemoProfiles;
        needsSave = true;
    }
    if (!settings.demoActivityTemplates || settings.demoActivityTemplates.length === 0) {
        settings.demoActivityTemplates = defaultDemoTemplates;
        needsSave = true;
    }
    if (!settings.notices) {
        settings.notices = [];
        needsSave = true;
    }
    if (!settings.tickerRealActivityTemplates) {
        settings.tickerRealActivityTemplates = defaultSettingsObject.tickerRealActivityTemplates;
        needsSave = true;
    } else {
        if(!Array.isArray(settings.tickerRealActivityTemplates.deposits)) {
             settings.tickerRealActivityTemplates = defaultSettingsObject.tickerRealActivityTemplates;
             needsSave = true;
        }
    }
    if (!settings.tickerRealActivityConfig) {
        settings.tickerRealActivityConfig = defaultSettingsObject.tickerRealActivityConfig;
        needsSave = true;
    }
    if (!settings.tickerHiddenEventIds) {
        settings.tickerHiddenEventIds = [];
        needsSave = true;
    }

    if (needsSave) {
        await settings.save();
    }

    return settings;
};

export default mongoose.model('Setting', SettingSchema);
