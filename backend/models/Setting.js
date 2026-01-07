
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

const FaqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true }
}, { _id: false });

// New Schema for Manual Payment Logos on Homepage
const HomepagePaymentLogoSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, required: true } // Can be URL or Base64
}, { _id: false });

const HomepageContentSchema = new mongoose.Schema({
    // Visibility Toggles
    showHero: { type: Boolean, default: true },
    showFeatures: { type: Boolean, default: true },
    showMultiCurrency: { type: Boolean, default: true },
    showInvestmentPlans: { type: Boolean, default: true },
    showMLM: { type: Boolean, default: true },
    showPaymentMethods: { type: Boolean, default: true },
    showVideoSection: { type: Boolean, default: true },
    showFAQ: { type: Boolean, default: true },
    showCTA: { type: Boolean, default: true },

    heroTitle: { type: String, default: "Invest in Your Future, Grow Your Network" },
    heroSubtitle: { type: String, default: "SmartEarning provides a secure platform to manage your investments and leverage your network for greater earning potential." },
    feature1Title: { type: String, default: "Secure Investments" },
    feature1Desc: { type: String, default: "Your funds and data are protected with industry-standard security measures." },
    feature2Title: { type: String, default: "Powerful MLM System" },
    feature2Desc: { type: String, default: "Earn commissions not just from your referrals, but from their referrals too." },
    feature3Title: { type: String, default: "Real-Time Tracking" },
    feature3Desc: { type: String, default: "Monitor your earnings, network growth, and transactions with our intuitive dashboard." },
    
    // Video Section
    videoTitle: { type: String, default: "See How It Works" },
    videoDesc: { type: String, default: "Discover the power of our platform in this short overview. Watch how you can leverage your network to achieve your financial goals." },
    
    multiCurrencyTitle: { type: String, default: "Global Reach, Local Convenience" },
    multiCurrencyDesc: { type: String, default: "Our platform is built for a global audience. Invest, earn, and withdraw in the currency that works for you." },
    mlmTitle: { type: String, default: "Understanding Our Earning System" },
    mlmDesc: { type: String, default: "Our platform uses a Multi-Level Marketing (MLM) structure, which allows you to earn commissions from multiple levels of your network." },
    
    // Payment Methods Configuration
    paymentMethodsTitle: { type: String, default: "Supported Payment Partners" },
    paymentMethodsDesc: { type: String, default: "We support a variety of secure payment gateways for your convenience." },
    paymentMethodsDisplayType: { type: String, enum: ['static', 'sliding', 'pulsing'], default: 'static' },
    paymentMethodsColorStyle: { type: String, enum: ['color', 'grayscale'], default: 'color' },

    ctaTitle: { type: String, default: "Ready to Start Your Journey?" },
    ctaDesc: { type: String, default: "Join a community of forward-thinkers. Sign up today and unlock your earning potential." }
}, { _id: false });

const defaultFaqs = [
    { question: "How do I deposit funds?", answer: "Log in to your dashboard and navigate to 'Deposit Funds'. Choose your preferred payment method (e.g., Bank Transfer, Easypaisa, JazzCash, Crypto), enter the amount, and follow the instructions. Upload your payment proof/receipt to verify the transaction. Your balance will be updated once approved by an admin." },
    { question: "How do I withdraw my earnings?", answer: "Go to the 'Withdraw Funds' section. Select a withdrawal method (Bank, Mobile Wallet, etc.), enter the amount you wish to withdraw, and provide your account details. Withdrawal requests are typically processed within 24-48 hours." },
    { question: "What payment methods are supported?", answer: "We support a variety of local and international methods including Easypaisa, JazzCash, Bank Transfers, PayPal, Stripe, Payoneer, and Cryptocurrency. Availability depends on your selected currency." },
    { question: "What is the minimum investment?", answer: "You can view the minimum investment amounts on the 'Investment Plans' page. We offer various plans to suit different budgets, starting from affordable entry levels." },
    { question: "How does the referral system work?", answer: "Share your unique referral link found on your Dashboard. You earn Direct Commissions when someone joins and invests through your link (Level 1), and Indirect Commissions from their subsequent referrals (Level 2 and beyond)." },
    { question: "Can I transfer funds to another user?", answer: "Yes, use the 'Transfer Funds' feature in your member area to send money to other members instantly. Note that a small fee may apply, and cross-currency transfers (e.g., USD to PKR) are supported with auto-conversion." }
];

const defaultDemoProfiles = [
    { _id: 'dp1', name: 'Maria', country: 'Germany', currency: 'EUR' },
    { _id: 'dp2', name: 'Bob', country: 'France', currency: 'EUR' },
    { _id: 'dp3', name: 'Ahmed', country: 'Pakistan', currency: 'PKR' },
    { _id: 'dp4', name: 'Sarah', country: 'UK', currency: 'USD' }
];

const defaultDemoTemplates = [
    { _id: 'dt1', template: '{name} from {country} just joined!', type: 'joined', enabled: true },
    { _id: 'dt2', template: '{name} deposited {amount}.', type: 'deposit', enabled: true },
    { _id: 'dt3', template: '{name} withdrew {amount}.', type: 'withdrawal', enabled: true },
    { _id: 'dt4', template: '{name} purchased {plan}.', type: 'plan', enabled: true }
];

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
    showRejectedCommissionTransaction: {
        type: Boolean,
        default: true,
    },
    notifySponsorOnCommissionLimit: {
        type: Boolean,
        default: true,
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
    planSortType: {
        type: String,
        enum: ['price-asc', 'price-desc', 'manual'],
        default: 'price-asc',
    },
    manualPlanOrder: {
        type: [String],
        default: [],
    },
    demoProfiles: [DemoProfileSchema],
    demoActivityTemplates: [DemoActivityTemplateSchema],
    notices: [NoticeSchema],
    faqs: {
        type: [FaqSchema],
        default: defaultFaqs
    },
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
    homepagePaymentLogos: {
        type: [HomepagePaymentLogoSchema],
        default: []
    },
    featuredPlanIds: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true
});

// Ensure a default settings document is created if one doesn't exist
SettingSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    let needsSave = false;

    if (!settings) {
        settings = await this.create({});
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
    if (!settings.faqs || settings.faqs.length === 0) {
        settings.faqs = defaultFaqs;
        needsSave = true;
    }
    
    // Default payment method settings if missing
    if (!settings.homepageContent) {
        settings.homepageContent = {};
        needsSave = true;
    }
    // Initialize new boolean flags if they don't exist
    const visibilityFlags = ['showHero', 'showFeatures', 'showMultiCurrency', 'showInvestmentPlans', 'showMLM', 'showPaymentMethods', 'showVideoSection', 'showFAQ', 'showCTA'];
    visibilityFlags.forEach(flag => {
        if (settings.homepageContent[flag] === undefined) {
            settings.homepageContent[flag] = true;
            needsSave = true;
        }
    });

    if (!settings.homepageContent.paymentMethodsDisplayType) {
        settings.homepageContent.paymentMethodsDisplayType = 'static';
        needsSave = true;
    }
    if (!settings.homepageContent.paymentMethodsColorStyle) {
        settings.homepageContent.paymentMethodsColorStyle = 'color';
        needsSave = true;
    }
    
    // Seed default logos if array is missing/empty (first time migration)
    if (!settings.homepagePaymentLogos || settings.homepagePaymentLogos.length === 0) {
        settings.homepagePaymentLogos = [
            { name: 'Easypaisa', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/archive/8/82/20210207125345%21Easypaisa_logo.png' },
            { name: 'JazzCash', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/JazzCash_logo.png' },
            { name: 'Bank Transfer', logoUrl: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png' },
            { name: 'PayPal', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg' },
            { name: 'Stripe', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' },
            { name: 'Bitcoin', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/1200px-Bitcoin.svg.png' },
            { name: 'Payoneer', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Payoneer_logo.svg' }
        ];
        needsSave = true;
    }

    if (!settings.tickerRealActivityTemplates) {
        // Reset to defaults if missing or malformed
        settings.tickerRealActivityTemplates = {
            deposits: ['<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>'],
            withdrawals: ['<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>'],
            registrations: ['<strong class="font-semibold">{name}</strong> from {country} just joined!'],
            commissions: ['<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong> commission ({source})'],
            transfers: ['<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong> to {recipient}'] ,
            planPurchases: ['<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({amount})']
        };
        needsSave = true;
    } else {
        if(!Array.isArray(settings.tickerRealActivityTemplates.deposits)) {
             settings.tickerRealActivityTemplates = {
                deposits: ['<strong class="font-semibold">{name}</strong> deposited <strong>{amount}</strong>'],
                withdrawals: ['<strong class="font-semibold">{name}</strong> withdrew <strong>{amount}</strong>'],
                registrations: ['<strong class="font-semibold">{name}</strong> from {country} just joined!'],
                commissions: ['<strong class="font-semibold">{name}</strong> earned <strong>{amount}</strong> commission ({source})'],
                transfers: ['<strong class="font-semibold">{name}</strong> transferred <strong>{amount}</strong> to {recipient}'] ,
                planPurchases: ['<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({amount})']
             };
             needsSave = true;
        }
    }
    if (!settings.tickerRealActivityConfig) {
        settings.tickerRealActivityConfig = { minAmount: 0, privacyMode: false, excludedCurrencies: [] };
        needsSave = true;
    }
    if (!settings.tickerHiddenEventIds) {
        settings.tickerHiddenEventIds = [];
        needsSave = true;
    }
    
    if (settings.showRejectedCommissionTransaction === undefined) {
        settings.showRejectedCommissionTransaction = true;
        needsSave = true;
    }
    
    if (settings.notifySponsorOnCommissionLimit === undefined) {
        settings.notifySponsorOnCommissionLimit = true;
        needsSave = true;
    }

    if (needsSave) {
        await settings.save();
    }

    return settings;
};

export default mongoose.model('Setting', SettingSchema);
