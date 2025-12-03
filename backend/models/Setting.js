
import mongoose from 'mongoose';

const TransferTierSchema = new mongoose.Schema({
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true },
    feeType: { type: String, enum: ['percentage', 'fixed'], required: true },
    feeValue: { type: Number, required: true },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'PKR'],
        required: true,
    },
    enabled: { type: Boolean, default: true }
}, { _id: false });

const DemoProfileSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    currency: { type: String, enum: ['USD', 'EUR', 'PKR'], required: true },
});

const DemoActivityTemplateSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    template: { type: String, required: true },
    type: { type: String, enum: ['withdrawal', 'transfer', 'joined', 'deposit', 'plan'], required: true },
    enabled: { type: Boolean, default: true },
});

const PlanEquivalencyGroupSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    usdPlanId: { type: String },
    pkrPlanId: { type: String },
    eurPlanId: { type: String },
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
        tiers: [TransferTierSchema]
    },
    exchangeRates: {
        USD: { type: Number, default: 278.50 },
        EUR: { type: Number, default: 256.22 },
        PKR: { type: Number, default: 1 }
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
    tickerSpeed: { type: Number, default: 6 },
    tickerContentSource: {
        type: String,
        enum: ['hybrid', 'real_only', 'demo_only'],
        default: 'hybrid',
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
    // Use a capped collection of size 1 to ensure only one settings document exists
    capped: { size: 1024, max: 1 }
});

// Ensure a default settings document is created if one doesn't exist
SettingSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({
            isUserTransferEnabled: true,
            transferConfig: {
                enabled: true,
                tiers: [
                    { minAmount: 1, maxAmount: 100, feeType: 'fixed', feeValue: 1, currency: 'USD', enabled: true },
                    { minAmount: 101, maxAmount: 10000, feeType: 'percentage', feeValue: 2, currency: 'USD', enabled: true },
                    { minAmount: 1, maxAmount: 10000, feeType: 'percentage', feeValue: 1.5, currency: 'EUR', enabled: true },
                    { minAmount: 100, maxAmount: 50000, feeType: 'fixed', feeValue: 150, currency: 'PKR', enabled: true }
                ]
            },
            exchangeRates: {
                USD: 278.50,
                EUR: 256.22,
                PKR: 1,
            },
            restrictWithdrawalAmount: false,
            requirePlanMatchForCommission: false,
            requireActivePlanForCommission: false,
            oneTimeCommissionPerGroup: false,
            recurringCommissionPlanIds: [],
            requireUplineEligibility: false,
            withdrawalFrequency: {
                enabled: false,
                value: 1,
                unit: 'days'
            },
            demoProfiles: [
                { _id: '1', name: 'John D.', country: 'United States', currency: 'USD' },
                { _id: '2', name: 'Maria S.', country: 'Germany', currency: 'EUR' },
                { _id: '3', name: 'Ali K.', country: 'Pakistan', currency: 'PKR' },
                { _id: '4', name: 'Fatima Z.', country: 'Pakistan', currency: 'PKR' },
                { _id: '5', name: 'Chloe M.', country: 'France', currency: 'EUR' },
                { _id: '6', name: 'David L.', country: 'Canada', currency: 'USD' },
            ],
            demoActivityTemplates: [
                { _id: 't1', template: '{name} from {country} just joined SmartEarning!', type: 'joined', enabled: true },
                { _id: 't2', template: '{name} made a new deposit of {amount}', type: 'deposit', enabled: true },
                { _id: 't3', template: '{name} successfully withdrew {amount}', type: 'withdrawal', enabled: true },
                { _id: 't4', template: '{name} upgraded to the {plan} plan', type: 'plan', enabled: true },
                { _id: 't5', template: '{name} sent funds to another member', type: 'transfer', enabled: false },
            ],
            tickerSpeed: 6,
            tickerContentSource: 'hybrid',
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
        });
    }
    return settings;
};

export default mongoose.model('Setting', SettingSchema);
