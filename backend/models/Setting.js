
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

const CustomFieldSchema = new mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'select', 'checkbox'], default: 'text' },
    required: { type: Boolean, default: false },
    options: { type: String, default: '' } // Comma-separated options for selects
}, { _id: false });

const SignUpConfigSchema = new mongoose.Schema({
    customTitle: { type: String, default: 'Create your Account' },
    fullNameRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'required' },
    usernameRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'required' },
    phoneRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'required' },
    whatsappRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'required' },
    countryRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'required' },
    sponsorRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'optional' },
    addressRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    cityRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    postalCodeRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    telegramRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    genderRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    dateOfBirthRule: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    requireCountryCodeInPhone: { type: Boolean, default: false },
    requireCountryCodeInWhatsapp: { type: Boolean, default: false },
    customFields: { type: [CustomFieldSchema], default: [] }
}, { _id: false });

const FaqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    showOnHomepage: { type: Boolean, default: false }
}, { _id: false });

const HomepagePaymentLogoSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    logoUrl: { type: String, default: '' }
}, { _id: false });

const SmartexnContentSchema = new mongoose.Schema({
    heroTitle: { type: String, default: "Unlock Your Earning Potential with SmartExn.com: Surveys, Tasks, Games, & Global Reach." },
    heroSubtitle: { type: String, default: "Join thousands of global earners or leverage our vast workforce to complete projects instantly. Your smart path to online success." },
    heroStartBtn: { type: String, default: "Start Earning Now" },
    heroPublishBtn: { type: String, default: "Publish Your Own Project" },
    dashboardPreviewImage: { type: String, default: "" },
    mobilePreviewImage: { type: String, default: "" },
    howItWorksTitle: { type: String, default: "How It Works" },
    step1Title: { type: String, default: "Sign Up" },
    step1Desc: { type: String, default: "Create your free account instantly" },
    step2Title: { type: String, default: "Choose Projects" },
    step2Desc: { type: String, default: "Surveys, data entry, game testing, creative work" },
    step3Title: { type: String, default: "Complete Tasks" },
    step3Desc: { type: String, default: "Follow simple instructions, get verified" },
    step4Title: { type: String, default: "Get Paid" },
    step4Desc: { type: String, default: "Receive fast payouts via multiple methods" },
    oppsTitle: { type: String, default: "Featured Earning Opportunities" },
    opp1Title: { type: String, default: "Paid Surveys & Feedback" },
    opp1Desc: { type: String, default: "In-depth surveys" },
    opp2Title: { type: String, default: "Micro-Jobs & Data" },
    opp2Desc: { type: String, default: "Data entry, tagging, small projects" },
    opp3Title: { type: String, default: "Play Games & Test Apps" },
    opp3Desc: { type: String, default: "Fun game testing, app reviews" },
    opp4Title: { type: String, default: "Creative & Freelance" },
    opp4Desc: { type: String, default: "Writing, design, small creative gigs" },
    bizTitle: { type: String, default: "Business & Advertisers" },
    bizPoint1Title: { type: String, default: "Access a Vast Global Workforce" },
    bizPoint1Desc: { type: String, default: "Access thousands of workers" },
    bizPoint2Title: { type: String, default: "Fast Quality Results" },
    bizPoint2Desc: { type: String, default: "Verified worker output" },
    bizPoint3Title: { type: String, default: "Easy Project Management" },
    bizPoint3Desc: { type: String, default: "Dashboard tools for tracking" },
    bizPoint4Title: { type: String, default: "Flexible Budgeting" },
    bizPoint4Desc: { type: String, default: "Options for any size project" },
    footerCopyright: { type: String, default: "© 2023 SmartExn.com. All rights reserved." }
}, { _id: false });

const HomepageContentSchema = new mongoose.Schema({
    smartexnContent: { type: SmartexnContentSchema, default: () => ({}) },
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
        question: "What is the Earning Area and how can I start earning without investment?",
        answer: "The Earning Area (found under 'My Tasks') is a completely free online gigs section where you can earn money without any upfront investment. You can earn by completing simple daily micro-tasks such as liking Facebook posts, subscribing to YouTube channels, watching short advertising videos, or writing reviews.",
        showOnHomepage: true
    },
    {
        question: "How long does it take for Earning Area task submissions to be approved?",
        answer: "Task submissions require proof of completion (usually a screenshot). Our verification moderators or the task sponsors typically review and approve these submissions within 12 to 24 hours. Once your proof is verified, your reward is immediately credited to your available wallet balance.",
        showOnHomepage: true
    },
    {
        question: "Are there limits on the number of daily tasks I can complete?",
        answer: "Yes. To maintain high-quality social engagements, each task is bound by frequency limits (such as 'Once', 'Daily', or 'Weekly') and cooldown periods. Premium members with active investment plans often gain access to additional exclusive and higher-paying tasks with larger completion limits.",
        showOnHomepage: true
    },
    {
        question: "Why did my task reward submission get rejected?",
        answer: "Submissions are rejected if the provided screenshot proof is invalid, blurred, or does not clearly show that you completed the required action (such as liking or subscribing). Submissions will also be rejected or reversed if you unfollow or undo the required action before or shortly after verification.",
        showOnHomepage: true
    },
    {
        question: "Can I withdraw earnings from the free Earning Area without buying an investment plan?",
        answer: "Yes, definitely! Earnings accumulated from completing tasks in the Earning Area belong entirely to you. You can withdraw them directly to your local bank account or mobile wallet as soon as you meet the minimum withdrawal limit, with absolutely no requirement to purchase an investment plan first.",
        showOnHomepage: true
    },
    {
        question: "Can I use my Earning Area balance to buy an investment plan?",
        answer: "Yes! Your Earning Area rewards go directly to your main wallet balance. Once you accumulate enough funds, you can use your balance to purchase any premium investment plan directly from the 'Investment Plans' tab, allowing you to transition from free earnings to high-yield passive income completely for free.",
        showOnHomepage: true
    },
    {
        question: "Do I earn MLM team commissions from my referrals' Earning Area tasks?",
        answer: "Yes! Our transparent referral income generator includes Earning Area tasks. You earn a percentage of all task rewards completed by your level 1 (direct) and level 2 (indirect) team members. If you build an active network of free earners, you will receive substantial daily passive commission payouts.",
        showOnHomepage: true
    },
    {
        question: "Can I promote my own social media pages or website in the Earning Area?",
        answer: "Yes! Our platform is a fully-featured automated micro-task marketplace. You can easily switch to the 'Task Creator' role, fund your advertising balance, and post tasks like YouTube subscribers, Facebook likes, web traffic, or Google reviews. Our active community of real users will complete your tasks with full verification screenshots.",
        showOnHomepage: true
    },
    {
        question: "Are there rules regarding VPNs or multiple accounts for completing tasks?",
        answer: "Yes, we have a strict anti-fraud policy. Using VPNs, proxy servers, automated clickers, or creating multiple accounts to complete tasks is strictly prohibited. Our system monitors IP signatures and browser user-agents. Any accounts detected violating these rules will be suspended permanently with all earnings forfeited.",
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
        allowCrossCurrency: { type: Boolean, default: false },
        allowManualRecipientEntry: { type: Boolean, default: true }
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
    whatsappFloatingEnabled: { type: Boolean, default: true },
    whatsappDepositProofEnabled: { type: Boolean, default: true },
    seoTitle: { type: String, default: "SmartExn | Online Micro-Tasks, Surveys & Global Gigs" },
    seoDescription: { type: String, default: "SmartEarning is a premier Multi-Level Marketing and passive investment ecosystem designed to help you secure stable growth." },
    seoKeywords: { type: String, default: "SmartEarning, investment, MLM, multi-level marketing, passive income" },
    privacyPolicyTitle: { type: String, default: "Privacy Policy" },
    privacyPolicyUpdated: { type: String, default: "Last updated: June 28, 2026" },
    privacyPolicyContent: { type: String, default: "" },
    refundPolicyTitle: { type: String, default: "Refund Policy" },
    refundPolicyUpdated: { type: String, default: "Last updated: June 28, 2026" },
    refundPolicyContent: { type: String, default: "" },
    termsOfUseTitle: { type: String, default: "Terms of Use" },
    termsOfUseUpdated: { type: String, default: "Last updated: June 28, 2026" },
    termsOfUseContent: { type: String, default: "" },
    emailAutomationEnabled: { type: Boolean, default: false },
    emailSenderAddress: { type: String, default: 'smartexn.com@gmail.com' },
    emailSenderPassword: { type: String, default: '' },
    whatsappAutomationEnabled: { type: Boolean, default: false },
    whatsappInstanceId: { type: String, default: 'instance183081' },
    whatsappToken: { type: String, default: '1q22bd6hwo7rc2ub' },
    autoWelcomeEnabled: { type: Boolean, default: false },
    autoPasswordResetEnabled: { type: Boolean, default: false },
    signUpConfig: { type: SignUpConfigSchema, default: () => ({}) },
    isUserTaskEnabled: { type: Boolean, default: true },
    userDashboardVersion: { type: String, enum: ['old', 'compact'], default: 'compact' },
    landingPageStyle: { type: String, enum: ['standard', 'smartexn'], default: 'smartexn' },
    userTaskAccessMode: { type: String, enum: ['all', 'manual', 'plan'], default: 'all' },
    userTaskAllowedUserIds: { type: [String], default: [] },
    userTaskAllowedPlanIds: { type: [String], default: [] },
    userTaskNotificationEnabled: { type: Boolean, default: true },
    userTaskNotificationMessage: { type: String, default: 'Want to earn extra rewards? Activate the required investment plan to unlock the User Task Hub and start earning today!' },
    userTaskConfig: {
        minQuantity: { type: Number, default: 5 },
        minRewardAmount: { type: Number, default: 0.10 },
        commissionPercent: { type: Number, default: 10 },
        campaignFeeEnabled: { type: Boolean, default: false },
        campaignFeeAmount: { type: Number, default: 1.00 }
    },
    proofControls: {
        screenshotEnabled: { type: Boolean, default: true },
        textEnabled: { type: Boolean, default: true },
        maxScreenshotSizeMB: { type: Number, default: 5 },
        allowedExtensions: { type: [String], default: ['jpg', 'jpeg', 'png', 'mp4', 'pdf'] },
        minBudget: { type: Number, default: 5 }
    },
    systemLimits: {
        minWorkerSlots: { type: Number, default: 10 },
        maxWorkerSlots: { type: Number, default: 10000 },
        approvalTimeoutDays: { type: Number, default: 3 },
        disputeTimeLimitHours: { type: Number, default: 48 },
        disputeReviewTimeoutDays: { type: Number, default: 3 },
        secondDisputeTimeLimitHours: { type: Number, default: 48 }
    },
    campaignLiveRules: {
        autoApproval: { type: Boolean, default: true }
    },
    taskCategoryPresets: {
        type: mongoose.Schema.Types.Mixed,
        default: {
            youtube: {
                subscriber: { minPayout: 0.02, minSlots: 50 },
                comments: { minPayout: 0.04, minSlots: 10 },
                likes: { minPayout: 0.01, minSlots: 10 },
                watchTimeTiers: [
                    { duration: '5 Seconds', minPayout: 0.005, minSlots: 100 },
                    { duration: '10 Seconds', minPayout: 0.010, minSlots: 100 },
                    { duration: '15 Seconds', minPayout: 0.015, minSlots: 50 },
                    { duration: '30 Seconds', minPayout: 0.025, minSlots: 50 },
                    { duration: '1 Minute', minPayout: 0.050, minSlots: 20 },
                    { duration: '5 Minutes', minPayout: 0.150, minSlots: 10 }
                ]
            },
            facebook: {
                likeFollow: { minPayout: 0.02, minSlots: 50 },
                videoLike: { minPayout: 0.01, minSlots: 50 },
                comments: { minPayout: 0.03, minSlots: 10 },
                watchTimeTiers: [
                    { duration: '30 Seconds', minPayout: 0.015, minSlots: 50 },
                    { duration: '1 Minute', minPayout: 0.030, minSlots: 30 },
                    { duration: '3 Minutes', minPayout: 0.080, minSlots: 20 }
                ]
            },
            instagram: {
                profileFollow: { minPayout: 0.015, minSlots: 50 },
                postLike: { minPayout: 0.008, minSlots: 100 },
                reelView: { minPayout: 0.005, minSlots: 100 },
                comments: { minPayout: 0.03, minSlots: 10 }
            },
            google: {
                reviews: { minPayout: 0.20, minSlots: 5 }
            },
            paidSignUp: {
                simpleSignUp: { minPayout: 0.10, minSlots: 10 },
                activePlanPurchase: { minPayout: 0.50, minSlots: 5 }
            }
        }
    },
    hubEnabled: { type: Boolean, default: true },
    hubMinDeposit: { type: Number, default: 5 },
    hubMaxDeposit: { type: Number, default: 1000 },
    hubMinWithdrawal: { type: Number, default: 1 },
    hubMaxWithdrawal: { type: Number, default: 1000 },
    hubAccessMode: { type: String, enum: ['all', 'manual', 'plan'], default: 'all' },
    hubAllowedUserIds: { type: [String], default: [] },
    hubAllowedPlanIds: { type: [String], default: [] },
    hubDepositMethods: { type: [String], default: [] },
    hubFaqs: { type: [FaqSchema], default: [] },
    hubPrivacyPolicyTitle: { type: String, default: "Hub Privacy Policy" },
    hubPrivacyPolicyUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubPrivacyPolicyContent: { type: String, default: "We respect your digital privacy. When you use the Micro Task Hub, we collect standard log data, your completed task proofs, and transaction logs. This information is strictly used to evaluate submission proofs and process withdrawals safely. We do not sell or lease your personal identifiers to marketing brokers. We employ advanced cryptographic protections to secure your balance logs and proof submissions." },
    hubTermsOfUseTitle: { type: String, default: "Hub Terms of Service" },
    hubTermsOfUseUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubTermsOfUseContent: { type: String, default: "By participating in the Micro Task & Gigs Hub, you agree to: (1) Provide only authentic and unaltered proofs of completed tasks; (2) Refrain from using VPNs, proxies, bot networks, or automated scrapers; (3) Abide by the minimum and maximum deposit/withdrawal thresholds. Fraudulent task submissions will result in immediate profile suspension and forfeiture of your earnings." },
    hubRefundPolicyTitle: { type: String, default: "Hub Refund Policy" },
    hubRefundPolicyUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubRefundPolicyContent: { type: String, default: "All approved payouts and withdrawals processed through the Micro Task Hub are final and irreversible. If a micro task campaign you launched has uncompleted slots, you can request a refund of the remaining budget to your main wallet by submitting a request to the support team." },
    hubCookiePolicyTitle: { type: String, default: "Hub Cookie Policy" },
    hubCookiePolicyUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubCookiePolicyContent: { type: String, default: "We use essential cookies and local storage tokens to keep you securely authenticated in the Micro Task Hub, remember your dashboard view preferences, and protect our forms from Cross-Site Request Forgery (CSRF) attempts. By accessing the Work & Earn module, you consent to our use of these technical cookies." },
    hubContactUsTitle: { type: String, default: "Hub Contact Us" },
    hubContactUsUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubContactUsContent: { type: String, default: "If you have questions, disputes, or issues regarding task completion or withdrawal processing inside the Hub, you can contact us directly by opening a dispute/support ticket inside the 'Disputes & Support' panel or email us at support@taskhub.payouts." },
    hubAboutUsTitle: { type: String, default: "Hub About Us" },
    hubAboutUsUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubAboutUsContent: { type: String, default: "The Work & Earn Micro Task Hub is a specialized division designed to bridge independent digital gig workers with platform campaigns. We facilitate frictionless nano-campaign verification, secure micro-wallets, and transparent social promotion payouts for members worldwide." },
    hubAntiFraudPolicyTitle: { type: String, default: "Hub Anti-Fraud Policy" },
    hubAntiFraudPolicyUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubAntiFraudPolicyContent: { type: String, default: "We enforce a zero-tolerance policy against fraudulent activities. This includes submitting fabricated screenshots, multiple accounts registration, mock API completions, or bot scripts. Any detected exploitation will lead to permanent IP blocking, task blacklist, and legal escalation if funds were maliciously obtained." },
    hubWithdrawalPolicyTitle: { type: String, default: "Hub Withdrawal Policy" },
    hubWithdrawalPolicyUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubWithdrawalPolicyContent: { type: String, default: "Withdrawals from the Micro Task Hub are processed directly to your approved payout methods. All payout requests must respect the minimum and maximum limit guidelines. Withdrawal processing times average 12-48 hours depending on manual queue verification." },
    hubDisclaimerTitle: { type: String, default: "Hub Disclaimer" },
    hubDisclaimerUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubDisclaimerContent: { type: String, default: "The Micro Task Hub does not guarantee a minimum hourly wage or continuous task availability. Earnings fluctuate based on active advertiser budgets and proof validation. All task completions are performed at the user's discretion and independent contractor responsibility." },
    hubDmcaPolicyTitle: { type: String, default: "Hub DMCA & Copyright Policy" },
    hubDmcaPolicyUpdated: { type: String, default: "Last updated: July 21, 2026" },
    hubDmcaPolicyContent: { type: String, default: "We respect the intellectual property of creators. If you find any tasks, campaigns, social profiles, or images hosted in our hub that infringe upon your copyrighted material, please send a DMCA Takedown Notice containing registration proofs to our support team for prompt review and deletion." },
    emailAutomationEnabled: { type: Boolean, default: false },
    emailSenderAddress: { type: String, default: 'smartexn.com@gmail.com' },
    emailSenderPassword: { type: String, default: '' },
    whatsappAutomationEnabled: { type: Boolean, default: false },
    whatsappInstanceId: { type: String, default: 'instance183081' },
    whatsappToken: { type: String, default: '' },
    emailVerificationRequired: { type: Boolean, default: false },
    whatsappVerificationRequired: { type: Boolean, default: false },
    workAndEarnWithdrawalRules: { type: mongoose.Schema.Types.Mixed, default: [] },
    workAndEarnPayoutTierConfig: { type: mongoose.Schema.Types.Mixed, default: null },
    ruleEvaluationLogs: { type: mongoose.Schema.Types.Mixed, default: [] },
    modulePagesConfig: { type: mongoose.Schema.Types.Mixed, default: null },
    workAndEarnConfig: { type: mongoose.Schema.Types.Mixed, default: null }
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
    } else {
        let updated = false;
        defaultFaqs.forEach(defFaq => {
            const exists = settings.faqs.some(f => f.question.toLowerCase() === defFaq.question.toLowerCase());
            if (!exists) {
                settings.faqs.push(defFaq);
                updated = true;
            }
        });
        if (updated) {
            needsSave = true;
        }
    }
    if (!settings.signUpConfig) {
        settings.signUpConfig = {};
        needsSave = true;
    }
    if (!settings.taskCategoryPresets) {
        settings.taskCategoryPresets = {
            youtube: {
                subscriber: { minPayout: 0.02, minSlots: 50 },
                comments: { minPayout: 0.04, minSlots: 10 },
                likes: { minPayout: 0.01, minSlots: 10 },
                watchTimeTiers: [
                    { duration: '5 Seconds', minPayout: 0.005, minSlots: 100 },
                    { duration: '10 Seconds', minPayout: 0.010, minSlots: 100 },
                    { duration: '15 Seconds', minPayout: 0.015, minSlots: 50 },
                    { duration: '30 Seconds', minPayout: 0.025, minSlots: 50 },
                    { duration: '1 Minute', minPayout: 0.050, minSlots: 20 },
                    { duration: '5 Minutes', minPayout: 0.150, minSlots: 10 }
                ]
            },
            facebook: {
                likeFollow: { minPayout: 0.02, minSlots: 50 },
                videoLike: { minPayout: 0.01, minSlots: 50 },
                comments: { minPayout: 0.03, minSlots: 10 },
                watchTimeTiers: [
                    { duration: '30 Seconds', minPayout: 0.015, minSlots: 50 },
                    { duration: '1 Minute', minPayout: 0.030, minSlots: 30 },
                    { duration: '3 Minutes', minPayout: 0.080, minSlots: 20 }
                ]
            },
            instagram: {
                profileFollow: { minPayout: 0.015, minSlots: 50 },
                postLike: { minPayout: 0.008, minSlots: 100 },
                reelView: { minPayout: 0.005, minSlots: 100 },
                comments: { minPayout: 0.03, minSlots: 10 }
            },
            google: {
                reviews: { minPayout: 0.20, minSlots: 5 }
            },
            paidSignUp: {
                simpleSignUp: { minPayout: 0.10, minSlots: 10 },
                activePlanPurchase: { minPayout: 0.50, minSlots: 5 }
            }
        };
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
