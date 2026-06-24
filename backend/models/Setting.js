
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
    answer: { type: String, required: true },
    showOnHomepage: { type: Boolean, default: false }
}, { _id: false });

const HomepagePaymentLogoSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, required: true }
}, { _id: false });

const HomepageContentSchema = new mongoose.Schema({
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
    videoTitle: { type: String, default: "See How It Works" },
    videoDesc: { type: String, default: "Discover the power of our platform in this short overview. Watch how you can leverage your network to achieve your financial goals." },
    multiCurrencyTitle: { type: String, default: "Global Reach, Local Convenience" },
    multiCurrencyDesc: { type: String, default: "Our platform is built for a global audience. Invest, earn, and withdraw in the currency that works for you." },
    mlmTitle: { type: String, default: "Understanding Our Earning System" },
    mlmDesc: { type: String, default: "Our platform uses a Multi-Level Marketing (MLM) structure, which allows you to earn commissions from multiple levels of your network." },
    paymentMethodsTitle: { type: String, default: "Supported Payment Partners" },
    paymentMethodsDesc: { type: String, default: "We support a variety of secure payment gateways for your convenience." },
    paymentMethodsDisplayType: { type: String, enum: ['static', 'sliding', 'pulsing'], default: 'static' },
    paymentMethodsColorStyle: { type: String, enum: ['color', 'grayscale'], default: 'color' },
    ctaTitle: { type: String, default: "Ready to Start Your Journey?" },
    ctaDesc: { type: String, default: "Join a community of forward-thinkers. Sign up today and unlock your earning potential." }
}, { _id: false });

const defaultFaqs = [
    { 
        question: "How do I earn commissions through the level system?", 
        answer: "SmartEarning uses a multi-level marketing structure. You earn 'Direct Commissions' (Level 1) from people you personally invite using your link. Additionally, you earn 'Indirect Commissions' (Level 2 and beyond) from referrals made by your team members, creating multiple streams of passive income.",
        showOnHomepage: true
    },
    { 
        question: "Why is my commission status showing as 'Held' or 'Pending'?", 
        answer: "Commissions are placed on 'Held' status if you do not currently own an active investment plan that is equivalent to the plan purchased by your referral. This ensures a fair ecosystem where active participants benefit from network growth. Once you purchase the required plan, all held funds are instantly released to your wallet.",
        showOnHomepage: true
    },
    { 
        question: "What happens when a plan's referral 'Slot Limit' is reached?", 
        answer: "Each investment plan has a specific number of 'Direct Slots' available for Level 1 commissions. If you reach this limit, new direct referrals will trigger an 'Overflow' event. In this case, the commission is skipped for that specific plan tier. To continue earning from new direct referrals, you should upgrade to a higher-tier plan which offers more slots or unlimited capacity.",
        showOnHomepage: true
    },
    { 
        question: "How do I release my held commissions?", 
        answer: "Navigate to your 'My Network' section and click on the 'Held Commission' tab. You will see exactly which plans are required to unlock your funds. Simply purchase the required plan from the 'Investment Plans' section, and the system will automatically credit the held balance to your available wallet.",
        showOnHomepage: true
    },
    { 
        question: "What are 'Mandatory Tasks' for withdrawal eligibility?", 
        answer: "To maintain a healthy and active community, some plans require users to complete simple engagement tasks (like following a social page or watching a short verification video) before a withdrawal can be processed. These can be found under the 'My Tasks' menu and are usually one-time or cycle-based requirements.",
        showOnHomepage: true
    },
    { 
        question: "Can I refer members from different countries/currencies?", 
        answer: "Absolutely! SmartEarning is global. Our 'Plan Equivalency' system handles cross-currency referrals (USD, EUR, PKR) seamlessly. If you are a PKR user and your referral buys a USD plan, you will still earn your commission, automatically converted to PKR at our current platform exchange rate.",
        showOnHomepage: true
    },
    { 
        question: "What is the 'Withdrawal Security Guard'?", 
        answer: "The Security Guard is a verification layer that prevents bot activity and ensures platform stability. If you see a 'Security Verification Required' message on the withdrawal page, it means there are pending mandatory tasks in your 'My Tasks' section that must be completed first.",
        showOnHomepage: false
    },
    { 
        question: "How long does it take for deposits and withdrawals to be processed?", 
        answer: "Deposits are typically verified within 30 minutes to 6 hours. Withdrawals are processed daily and usually reach your account within 24 hours. For P2P matched transactions, the speed depends on the matching member making the payment directly to you.",
        showOnHomepage: false
    },
    { 
        question: "Are there any fees for internal wallet transfers?", 
        answer: "Yes, internal transfers between members are supported and incur a small processing fee. The fee depends on the amount and currency tier. You can see the exact breakdown on the 'Transfer Funds' page before you confirm any transaction.",
        showOnHomepage: false
    }
];

const SettingSchema = new mongoose.Schema({
    dataVersion: { type: Number, default: Date.now }, // Moved from global memory to persistent DB
    isUserTransferEnabled: { type: Boolean, default: true },
    isTasksEnabled: { type: Boolean, default: true },
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
    restrictWithdrawalAmount: { type: Boolean, default: false },
    restrictDepositAmount: { type: Boolean, default: false },
    requirePlanMatchForCommission: { type: Boolean, default: false },
    requireActivePlanForCommission: { type: Boolean, default: false },
    oneTimeCommissionPerGroup: { type: Boolean, default: false },
    showRejectedCommissionTransaction: { type: Boolean, default: true },
    notifySponsorOnCommissionLimit: { type: Boolean, default: true },
    recurringCommissionPlanIds: { type: [String], default: [] },
    requireUplineEligibility: { type: Boolean, default: false },
    withdrawalFrequency: {
        enabled: { type: Boolean, default: false },
        value: { type: Number, default: 1 },
        unit: { type: String, enum: ['hours', 'days', 'weeks', 'months'], default: 'days' }
    },
    planSortType: { type: String, enum: ['price-asc', 'price-desc', 'manual'], default: 'price-asc' },
    manualPlanOrder: { type: [String], default: [] },
    demoProfiles: [DemoProfileSchema],
    demoActivityTemplates: [DemoActivityTemplateSchema],
    notices: [NoticeSchema],
    faqs: { type: [FaqSchema], default: defaultFaqs },
    tickerSpeed: { type: Number, default: 6 },
    tickerContentSource: { type: String, enum: ['hybrid', 'real_only', 'demo_only'], default: 'hybrid' },
    tickerRealActivities: {
        deposits: { type: Boolean, default: true },
        withdrawals: { type: Boolean, default: true },
        registrations: { type: Boolean, default: true },
        commissions: { type: Boolean, default: true },
        transfers: { type: Boolean, default: true },
        planPurchases: { type: Boolean, default: true }
    },
    tickerRealActivityConfig: { minAmount: { type: Number, default: 0 }, privacyMode: { type: Boolean, default: false }, excludedCurrencies: { type: [String], default: [] } },
    tickerHiddenEventIds: { type: [String], default: [] },
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
    homepageVideoUrl: { type: String, default: 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1&loop=1&playlist=LXb3EKWsInQ&controls=0&showinfo=0&autohide=1' },
    homepageContent: { type: HomepageContentSchema, default: () => ({}) },
    homepagePaymentLogos: { type: [HomepagePaymentLogoSchema], default: [] },
    featuredPlanIds: { type: [String], default: [] },
    whatsappNumber: { type: String, default: "" },
}, { timestamps: true });

SettingSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    let needsSave = false;
    if (!settings) {
        settings = await this.create({});
        return settings;
    }
    if (!settings.faqs || settings.faqs.length === 0) {
        settings.faqs = defaultFaqs;
        needsSave = true;
    }
    if (needsSave) { await settings.save(); }
    return settings;
};

// Static method to bump the version
SettingSchema.statics.bumpVersion = async function() {
    await this.findOneAndUpdate({}, { dataVersion: Date.now() }, { upsert: true });
};

export default mongoose.model('Setting', SettingSchema);
