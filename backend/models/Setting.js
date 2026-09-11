
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
    // SEO & Meta
    metaTitle: { type: String, default: "SmartExn | Online Micro-Tasks, Surveys & Global Gigs" },
    metaDescription: { type: String, default: "Complete online micro-tasks, surveys and gigs on SmartExn, submit proof and earn rewards when approved. Businesses can create campaigns and reach a global task-based workforce." },
    websiteSchemaDesc: { type: String, default: "Online micro-tasks, surveys, gigs, and global crowdsourcing platform." },

    // Hero Section
    heroEyebrow: { type: String, default: "⚡ Global Crowdsourced Task & Gig Marketplace" },
    heroTitle: { type: String, default: "Earn Rewards with Online Micro-Tasks, Surveys & Gigs" },
    heroSubtitle: { type: String, default: "Complete available online tasks, surveys and gigs, submit the required proof, and earn rewards when your work is approved. Businesses can also create campaigns and reach a global task-based workforce." },
    heroStartBtn: { type: String, default: "Start Earning" },
    heroStartBtnCaption: { type: String, default: "Free to create an account" },
    heroPublishBtn: { type: String, default: "Create a Campaign" },
    heroPublishBtnCaption: { type: String, default: "Reach verified crowdsourced workers" },
    heroTrust1: { type: String, default: "Escrow-Based Payment Protection" },
    heroTrust2: { type: String, default: "Fast Proof Verification" },
    heroTrust3: { type: String, default: "Multi-Currency Payouts" },
    dashboardPreviewImage: { type: String, default: "" },
    mobilePreviewImage: { type: String, default: "" },

    // How It Works
    howItWorksEyebrow: { type: String, default: "Simple 4-Step Process" },
    howItWorksTitle: { type: String, default: "How SmartExn Works" },
    howItWorksSubtitle: { type: String, default: "A transparent, escrow-backed workflow connecting task workers with campaign creators." },
    step1Title: { type: String, default: "Sign Up for Free" },
    step1Desc: { type: String, default: "Create your free account as an earner or advertiser in less than a minute." },
    step1Footer: { type: String, default: "Zero registration fees" },
    step2Title: { type: String, default: "Choose Projects" },
    step2Desc: { type: String, default: "Browse available social tasks, surveys, app feedback gigs, and data tagging opportunities." },
    step2Footer: { type: String, default: "Clear instructions & rewards" },
    step3Title: { type: String, default: "Complete & Submit Proof" },
    step3Desc: { type: String, default: "Follow the exact steps and upload verification proofs (screenshots, usernames, or answers)." },
    step3Footer: { type: String, default: "Escrow-backed reward protection" },
    step4Title: { type: String, default: "Get Paid & Withdraw" },
    step4Desc: { type: String, default: "Receive rewards in your Task Earnings wallet and withdraw via supported payment gateways." },
    step4Footer: { type: String, default: "Fast processing & low minimums" },

    // Featured Opportunities
    oppsEyebrow: { type: String, default: "Versatile Earning Categories" },
    oppsTitle: { type: String, default: "Featured Earning Opportunities" },
    oppsSubtitle: { type: String, default: "Choose from a variety of legitimate micro-tasks and surveys matched to your skills and devices." },
    opp1Title: { type: String, default: "Paid Surveys & Opinion Studies" },
    opp1Desc: { type: String, default: "Share your feedback on consumer products, test interactive questionnaires, and earn upon successful completion." },
    opp2Title: { type: String, default: "Social & Content Engagement" },
    opp2Desc: { type: String, default: "Discover creator content, participate in community discussions, explore channels, and submit feedback subject to platform terms." },
    opp3Title: { type: String, default: "App Testing & Feedback" },
    opp3Desc: { type: String, default: "Install mobile applications, explore gameplay features, report usability and UX feedback, and claim rewards." },
    opp4Title: { type: String, default: "Data & AI Tasks" },
    opp4Desc: { type: String, default: "Image classification, data labeling, search relevance evaluation, AI response feedback, and structured micro-jobs." },
    oppsDisclosureLabel: { type: String, default: "Earnings Disclosure:" },
    oppsDisclosureText: { type: String, default: "Earnings vary depending on task availability, requirements, completion quality, and advertiser verification. SmartExn does not guarantee fixed or passive hourly income." },

    // Business & Advertisers
    bizEyebrow: { type: String, default: "Advertiser & Campaign Solutions" },
    bizTitle: { type: String, default: "For Businesses & Campaign Creators" },
    bizCtaBtn: { type: String, default: "Post a Campaign Now" },
    bizPoint1Title: { type: String, default: "Access a Vast Global Workforce" },
    bizPoint1Desc: { type: String, default: "Reach verified workers from our growing global task community ready to complete your custom tasks, feedback, or testing campaigns." },
    bizPoint2Title: { type: String, default: "100% Escrow & Refund Protection" },
    bizPoint2Desc: { type: String, default: "Your campaign funds are securely held in escrow. Pay only for verified, approved worker proofs. Unused balances are refunded." },
    bizPoint3Title: { type: String, default: "Custom Instructions & Proof Auditing" },
    bizPoint3Desc: { type: String, default: "Specify exact requirements, define custom validation questions, and inspect proof screenshots before releasing payment." },
    bizPoint4Title: { type: String, default: "Flexible Budgeting & Rapid Execution" },
    bizPoint4Desc: { type: String, default: "Launch campaigns starting with flexible slots, set custom worker reward rates, and achieve fast engagement." },

    // Escrow & Dispute Protection
    escrowEyebrow: { type: String, default: "Security, Verification & Dispute Protection" },
    escrowTitle: { type: String, default: "Platform Escrow & Dispute Protection" },
    escrowSubtitle: { type: String, default: "SmartExn reduces payment uncertainty through an escrow-based workflow and dispute resolution process." },
    escrowCard1Title: { type: String, default: "Escrow Payment Protection" },
    escrowCard1Desc: { type: String, default: "Workers who complete the task according to the campaign requirements can receive their reward once the submission is approved under SmartExn's campaign and dispute policies." },
    escrowCard2Title: { type: String, default: "Two-Level Dispute Resolution" },
    escrowCard2Desc: { type: String, default: "If a proof submission is incorrectly rejected, workers can initiate Level-1 review with the creator or escalate to Level-2 admin arbitration for impartial verification." },
    escrowCard3Title: { type: String, default: "Unused Budget Refunds" },
    escrowCard3Desc: { type: String, default: "Advertisers who stop or cancel an active campaign receive an instant, transparent refund of all unspent escrow budget directly back to their Campaign Wallet." },

    // Payment Partners section text & badges
    paymentEyebrow: { type: String, default: "⚡ Supported Multi-Currency Payment Networks" },
    paymentBadge1Title: { type: String, default: "✓ Secure HTTPS" },
    paymentBadge1Desc: { type: String, default: "Encrypted Sessions" },
    paymentBadge2Title: { type: String, default: "⚡ Direct Deposit" },
    paymentBadge2Desc: { type: String, default: "Processing" },
    paymentBadge3Title: { type: String, default: "🚀 Multi-Gateway" },
    paymentBadge3Desc: { type: String, default: "Payout Support" },

    // FAQs
    faqEyebrow: { type: String, default: "Got Questions?" },
    faqTitle: { type: String, default: "Frequently Asked Questions" },
    faqSubtitle: { type: String, default: "Learn more about completing tasks, creating campaigns, escrow protection, and payments." },
    faq1Q: { type: String, default: "What is SmartExn?" },
    faq1A: { type: String, default: "SmartExn is a global online marketplace where users complete micro-tasks, surveys, and digital gigs for rewards, while businesses and advertisers access a verified crowdsourced workforce to promote campaigns." },
    faq2Q: { type: String, default: "How do online micro-tasks and gigs work?" },
    faq2A: { type: String, default: "Workers browse available tasks, review clear step-by-step instructions, execute the required actions (such as social & content engagement, app feedback, or surveys), and submit verifiable proof. Once the campaign creator verifies the submission, rewards are credited." },
    faq3Q: { type: String, default: "How does Campaign Escrow protect workers and advertisers?" },
    faq3A: { type: String, default: "When an advertiser launches a campaign, the total reward budget is held securely in platform escrow. When workers complete tasks accurately, rewards are guaranteed upon approval. If a campaign is cancelled, any remaining unspent escrow budget is safely refunded to the advertiser." },
    faq4Q: { type: String, default: "What happens if a task submission is mistakenly rejected?" },
    faq4A: { type: String, default: "SmartExn features a fair two-level dispute desk. Workers can request Level-1 review directly with the campaign creator, or escalate to Level-2 admin arbitration for impartial verification." },
    faq5Q: { type: String, default: "How do withdrawals work and what gateways are supported?" },
    faq5A: { type: String, default: "Workers can withdraw approved task earnings via supported gateways including EasyPaisa, JazzCash, USDT (TRC20), bank transfer, and international payment methods according to platform verification rules." },
    faq6Q: { type: String, default: "Are earnings or income guaranteed on SmartExn?" },
    faq6A: { type: String, default: "No. Earnings vary depending on task availability, campaign requirements, completion quality, and advertiser verification. SmartExn does not promise fixed or passive hourly income." },
    faqKnowledgeBtn: { type: String, default: "Explore Complete Knowledge Base" },

    // Final CTA Section
    finalCtaTitle: { type: String, default: "Ready to Join the Global Task Marketplace?" },
    finalCtaSubtitle: { type: String, default: "Whether you want to earn rewards completing tasks or promote your business with a global workforce, SmartExn provides the secure platform you need." },
    finalCtaStartBtn: { type: String, default: "Start Earning Now" },
    finalCtaPublishBtn: { type: String, default: "Create a Campaign" },

    // Footer
    footerTagline: { type: String, default: "SmartExn connects international task earners with businesses and creators. Complete verified micro-tasks, surveys, and digital gigs through an escrow-based campaign protection system" },
    footerCopyright: { type: String, default: "© 2026 SmartExn.com. All rights reserved." },
    footerEscrowBadge: { type: String, default: "Escrow-Based Payment Protection" }
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
    showUkSupportOffice: { type: Boolean, default: true },
    showUkSupportOfficeInFooter: { type: Boolean, default: true },
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
    showUkSupportOffice: { type: Boolean, default: true },
    showUkSupportOfficeInFooter: { type: Boolean, default: true },
    investmentModuleEnabled: { type: Boolean, default: true },
    isInvestmentModuleEnabled: { type: Boolean, default: true },
    publicSupportEmail: { type: String, default: 'support@smartexn.com' },
    supportOfficeBadge1: { type: String, default: 'Official Registered Support Desk' },
    supportOfficeBadge2: { type: String, default: 'UK Customer Support' },
    supportOfficeTitle: { type: String, default: 'UK Customer Support' },
    supportOfficeSubtitle: { type: String, default: 'Have questions or need assistance before creating an account? Our dedicated UK headquarters desk provides direct support for workers, campaign creators, and international partners.' },
    supportOfficeAddressLabel: { type: String, default: 'Support Address:' },
    supportOfficeAddress: { type: String, default: '71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom' },
    supportOfficePhone: { type: String, default: '+447846775662' },
    supportOfficeEmail: { type: String, default: 'support@smartexn.com' },
    supportOfficeHours: { type: String, default: '15 – 60 Minutes' },
    supportOfficeRegistrationNumber: { type: String, default: '14529081' },
    supportOfficeJurisdiction: { type: String, default: 'England & Wales (Companies House Registered)' },
    enableContactUsBox: { type: Boolean, default: true },
    enableContactViaEmail: { type: Boolean, default: true },
    enableContactViaWhatsApp: { type: Boolean, default: true },
    contactUsEmailAddress: { type: String, default: 'support@smartexn.com' },
    contactUsWhatsAppNumber: { type: String, default: '+447846775662' },
    contactUsBoxTitle: { type: String, default: 'International Member Support & Contact Desk' },
    contactUsBoxSubtitle: { type: String, default: 'Have questions regarding your withdrawal, payout settlement, or account verification?' },
    cookiePolicyTitle: { type: String, default: "Cookie Policy" },
    cookiePolicyUpdated: { type: String, default: "Last updated: June 28, 2026" },
    cookiePolicyContent: { type: String, default: "" },
    contactUsTitle: { type: String, default: "Contact Us" },
    contactUsUpdated: { type: String, default: "Last updated: June 28, 2026" },
    contactUsContent: { type: String, default: "" },
    aboutUsTitle: { type: String, default: "About Us" },
    aboutUsUpdated: { type: String, default: "Last updated: June 28, 2026" },
    aboutUsContent: { type: String, default: "" },
    antiFraudPolicyTitle: { type: String, default: "Anti-Fraud Policy" },
    antiFraudPolicyUpdated: { type: String, default: "Last updated: June 28, 2026" },
    antiFraudPolicyContent: { type: String, default: "" },
    withdrawalPolicyTitle: { type: String, default: "Withdrawal Policy" },
    withdrawalPolicyUpdated: { type: String, default: "Last updated: June 28, 2026" },
    withdrawalPolicyContent: { type: String, default: "" },
    disclaimerTitle: { type: String, default: "Disclaimer" },
    disclaimerUpdated: { type: String, default: "Last updated: June 28, 2026" },
    disclaimerContent: { type: String, default: "" },
    dmcaPolicyTitle: { type: String, default: "DMCA & Copyright Policy" },
    dmcaPolicyUpdated: { type: String, default: "Last updated: June 28, 2026" },
    dmcaPolicyContent: { type: String, default: "" },
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
    emailSenderAddress: { type: String, default: 'notifications@smartexn.com' },
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
            },
            survey: {
                enabled: true,
                displayName: "Survey",
                generalSurvey: { minPayout: 0.10, minSlots: 10, enabled: true, displayName: "General Survey" },
                marketResearch: { minPayout: 0.25, minSlots: 10, enabled: true, displayName: "Market Research" },
                productFeedback: { minPayout: 0.20, minSlots: 10, enabled: true, displayName: "Product Feedback" },
                customerFeedback: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Customer Feedback" },
                brandAwareness: { minPayout: 0.20, minSlots: 10, enabled: true, displayName: "Brand Awareness" },
                websiteFeedback: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Website Feedback" },
                appFeedback: { minPayout: 0.20, minSlots: 10, enabled: true, displayName: "App Feedback" },
                serviceReview: { minPayout: 0.25, minSlots: 10, enabled: true, displayName: "Service Review" },
                opinionPoll: { minPayout: 0.08, minSlots: 20, enabled: true, displayName: "Opinion Poll" },
                consumerResearch: { minPayout: 0.30, minSlots: 5, enabled: true, displayName: "Consumer Research" },
                demographicSurvey: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Demographic Survey" },
                academicResearch: { minPayout: 0.35, minSlots: 5, enabled: true, displayName: "Academic Research" },
                leadQualification: { minPayout: 0.40, minSlots: 5, enabled: true, displayName: "Lead Qualification" },
                satisfactionSurvey: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Satisfaction Survey" },
                watchTimeTiers: [
                    { duration: '1-3 Minutes', minPayout: 0.10, minSlots: 10, enabled: true },
                    { duration: '4-7 Minutes', minPayout: 0.20, minSlots: 10, enabled: true },
                    { duration: '8-15 Minutes', minPayout: 0.45, minSlots: 5, enabled: true },
                    { duration: '16-30 Minutes', minPayout: 0.90, minSlots: 5, enabled: true },
                    { duration: '31+ Minutes', minPayout: 1.50, minSlots: 5, enabled: true }
                ]
            }
        }
    },
    surveyCampaignsEnabled: { type: Boolean, default: true },
    surveyConfig: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
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
    hubContactUsContent: { type: String, default: "If you have questions, disputes, or issues regarding task completion or withdrawal processing inside the Hub, you can contact us directly by opening a dispute/support ticket or contacting our Customer Support Office (UK): 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom. Phone/WhatsApp: +447846775662, Email: support@smartexn.com." },
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
    emailProvider: { type: String, enum: ['existing', 'resend'], default: 'existing' },
    emailSenders: {
        type: [
            {
                id: { type: String, required: true },
                email: { type: String, required: true },
                name: { type: String, required: true },
                enabled: { type: Boolean, default: true }
            }
        ],
        default: () => [
            { id: 'info', email: 'info@smartexn.com', name: 'SmartExn Information', enabled: true },
            { id: 'support', email: 'support@smartexn.com', name: 'SmartExn Support', enabled: true },
            { id: 'notifications', email: 'notifications@smartexn.com', name: 'SmartExn Notifications', enabled: true },
            { id: 'legal', email: 'legal@smartexn.com', name: 'SmartExn Legal & Compliance', enabled: true },
            { id: 'security', email: 'security@smartexn.com', name: 'SmartExn Security Team', enabled: true },
            { id: 'finance', email: 'finance@smartexn.com', name: 'SmartExn Finance & Billing', enabled: true }
        ]
    },
    defaultSenderEmail: { type: String, default: 'notifications@smartexn.com' },
    eventSenders: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({
            password_reset: 'security@smartexn.com',
            password_reset_email: 'security@smartexn.com',
            security: 'security@smartexn.com',
            disputes: 'support@smartexn.com',
            support: 'support@smartexn.com',
            finance: 'finance@smartexn.com',
            deposit: 'finance@smartexn.com',
            withdrawal: 'finance@smartexn.com',
            transfer: 'finance@smartexn.com',
            investment: 'finance@smartexn.com',
            tasks: 'notifications@smartexn.com',
            campaigns: 'notifications@smartexn.com',
            notifications: 'notifications@smartexn.com',
            legal: 'legal@smartexn.com',
            info: 'info@smartexn.com',
            welcome: 'info@smartexn.com'
        })
    },
    emailSenderAddress: { type: String, default: 'notifications@smartexn.com' },
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
    workAndEarnConfig: { type: mongoose.Schema.Types.Mixed, default: null },
    investmentModuleEnabled: { type: Boolean, default: true },
    isInvestmentModuleEnabled: { type: Boolean, default: true },
    investmentActivePlanBypassEnabled: { type: Boolean, default: false },
    investmentManualWhitelistEnabled: { type: Boolean, default: false },
    investmentManualWhitelistUserIds: { type: [String], default: [] }
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
    if (!settings.emailSenders || settings.emailSenders.length === 0) {
        settings.emailSenders = [
            { id: 'info', email: 'info@smartexn.com', name: 'SmartExn Information', enabled: true },
            { id: 'support', email: 'support@smartexn.com', name: 'SmartExn Support', enabled: true },
            { id: 'notifications', email: 'notifications@smartexn.com', name: 'SmartExn Notifications', enabled: true },
            { id: 'legal', email: 'legal@smartexn.com', name: 'SmartExn Legal & Compliance', enabled: true },
            { id: 'security', email: 'security@smartexn.com', name: 'SmartExn Security Team', enabled: true },
            { id: 'finance', email: 'finance@smartexn.com', name: 'SmartExn Finance & Billing', enabled: true }
        ];
        needsSave = true;
    }
    if (!settings.emailProvider) {
        settings.emailProvider = 'existing';
        needsSave = true;
    }
    if (!settings.defaultSenderEmail) {
        settings.defaultSenderEmail = 'notifications@smartexn.com';
        needsSave = true;
    }
    const rawPublicEmail = (settings.publicSupportEmail || '').trim();
    if (!rawPublicEmail || rawPublicEmail.toLowerCase() === 'smartexn.com@gmail.com') {
        settings.publicSupportEmail = 'support@smartexn.com';
        needsSave = true;
    }
    if (!settings.supportOfficeEmail || settings.supportOfficeEmail.toLowerCase() === 'smartexn.com@gmail.com') {
        settings.supportOfficeEmail = 'support@smartexn.com';
        needsSave = true;
    }
    if (!settings.contactUsEmailAddress || settings.contactUsEmailAddress.toLowerCase() === 'smartexn.com@gmail.com') {
        settings.contactUsEmailAddress = 'support@smartexn.com';
        needsSave = true;
    }
    if (settings.emailSenderAddress && settings.emailSenderAddress.toLowerCase() === 'smartexn.com@gmail.com') {
        settings.emailSenderAddress = 'support@smartexn.com';
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
    if (settings.investmentModuleEnabled === undefined) {
        settings.investmentModuleEnabled = settings.isInvestmentModuleEnabled !== undefined ? settings.isInvestmentModuleEnabled : true;
        settings.isInvestmentModuleEnabled = settings.investmentModuleEnabled;
        needsSave = true;
    }
    if (settings.investmentActivePlanBypassEnabled === undefined) {
        settings.investmentActivePlanBypassEnabled = false;
        needsSave = true;
    }
    if (settings.investmentManualWhitelistEnabled === undefined) {
        settings.investmentManualWhitelistEnabled = false;
        needsSave = true;
    }
    if (!Array.isArray(settings.investmentManualWhitelistUserIds)) {
        settings.investmentManualWhitelistUserIds = [];
        needsSave = true;
    }
    if (settings.surveyCampaignsEnabled === undefined) {
        settings.surveyCampaignsEnabled = true;
        needsSave = true;
    }
    if (!settings.taskCategoryPresets?.survey) {
        if (!settings.taskCategoryPresets) settings.taskCategoryPresets = {};
        settings.taskCategoryPresets.survey = {
            enabled: true,
            displayName: "Survey",
            generalSurvey: { minPayout: 0.10, minSlots: 10, enabled: true, displayName: "General Survey" },
            marketResearch: { minPayout: 0.25, minSlots: 10, enabled: true, displayName: "Market Research" },
            productFeedback: { minPayout: 0.20, minSlots: 10, enabled: true, displayName: "Product Feedback" },
            customerFeedback: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Customer Feedback" },
            brandAwareness: { minPayout: 0.20, minSlots: 10, enabled: true, displayName: "Brand Awareness" },
            websiteFeedback: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Website Feedback" },
            appFeedback: { minPayout: 0.20, minSlots: 10, enabled: true, displayName: "App Feedback" },
            serviceReview: { minPayout: 0.25, minSlots: 10, enabled: true, displayName: "Service Review" },
            opinionPoll: { minPayout: 0.08, minSlots: 20, enabled: true, displayName: "Opinion Poll" },
            consumerResearch: { minPayout: 0.30, minSlots: 5, enabled: true, displayName: "Consumer Research" },
            demographicSurvey: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Demographic Survey" },
            academicResearch: { minPayout: 0.35, minSlots: 5, enabled: true, displayName: "Academic Research" },
            leadQualification: { minPayout: 0.40, minSlots: 5, enabled: true, displayName: "Lead Qualification" },
            satisfactionSurvey: { minPayout: 0.15, minSlots: 10, enabled: true, displayName: "Satisfaction Survey" },
            watchTimeTiers: [
                { duration: '1-3 Minutes', minPayout: 0.10, minSlots: 10, enabled: true },
                { duration: '4-7 Minutes', minPayout: 0.20, minSlots: 10, enabled: true },
                { duration: '8-15 Minutes', minPayout: 0.45, minSlots: 5, enabled: true },
                { duration: '16-30 Minutes', minPayout: 0.90, minSlots: 5, enabled: true },
                { duration: '31+ Minutes', minPayout: 1.50, minSlots: 5, enabled: true }
            ]
        };
        needsSave = true;
    }
    if (!settings.surveyConfig) {
        settings.surveyConfig = {};
        needsSave = true;
    }
    if (!settings.surveyConfig.categories || settings.surveyConfig.categories.length === 0) {
        settings.surveyConfig.categories = [
            { id: 'cat_general', name: 'General Survey', slug: 'general-survey', description: 'Broad multi-topic opinion and feedback surveys', icon: '📋', status: 'active', sortOrder: 1, minReward: 0.10, defaultReward: 0.15, maxReward: 2.00, estimatedTimeMinutes: 3, minQuestions: 1, maxQuestions: 20, requireApproval: false },
            { id: 'cat_market', name: 'Market Research', slug: 'market-research', description: 'In-depth market trends, habits and consumer preferences', icon: '📊', status: 'active', sortOrder: 2, minReward: 0.25, defaultReward: 0.35, maxReward: 5.00, estimatedTimeMinutes: 7, minQuestions: 3, maxQuestions: 30, requireApproval: false },
            { id: 'cat_product', name: 'Product Feedback', slug: 'product-feedback', description: 'Product testing, feature suggestions and usability feedback', icon: '💡', status: 'active', sortOrder: 3, minReward: 0.20, defaultReward: 0.30, maxReward: 4.00, estimatedTimeMinutes: 5, minQuestions: 2, maxQuestions: 25, requireApproval: false },
            { id: 'cat_customer', name: 'Customer Feedback', slug: 'customer-feedback', description: 'Customer service, loyalty and brand experience reviews', icon: '⭐', status: 'active', sortOrder: 4, minReward: 0.15, defaultReward: 0.20, maxReward: 3.00, estimatedTimeMinutes: 4, minQuestions: 2, maxQuestions: 20, requireApproval: false },
            { id: 'cat_brand', name: 'Brand Awareness', slug: 'brand-awareness', description: 'Evaluate brand recognition, perception and messaging', icon: '🏷️', status: 'active', sortOrder: 5, minReward: 0.20, defaultReward: 0.25, maxReward: 3.50, estimatedTimeMinutes: 5, minQuestions: 2, maxQuestions: 20, requireApproval: false },
            { id: 'cat_website', name: 'Website Feedback', slug: 'website-feedback', description: 'Website navigation, UI/UX, responsiveness and checkout audits', icon: '🌐', status: 'active', sortOrder: 6, minReward: 0.15, defaultReward: 0.20, maxReward: 3.00, estimatedTimeMinutes: 4, minQuestions: 2, maxQuestions: 20, requireApproval: false },
            { id: 'cat_app', name: 'App Feedback', slug: 'app-feedback', description: 'Mobile application onboarding, usability and feature reviews', icon: '📱', status: 'active', sortOrder: 7, minReward: 0.20, defaultReward: 0.30, maxReward: 4.00, estimatedTimeMinutes: 6, minQuestions: 3, maxQuestions: 25, requireApproval: false },
            { id: 'cat_service', name: 'Service Review', slug: 'service-review', description: 'Evaluate services, delivery, support and satisfaction', icon: '🛎️', status: 'active', sortOrder: 8, minReward: 0.25, defaultReward: 0.35, maxReward: 4.00, estimatedTimeMinutes: 6, minQuestions: 2, maxQuestions: 25, requireApproval: false },
            { id: 'cat_poll', name: 'Opinion Poll', slug: 'opinion-poll', description: 'Fast single or double question community polls', icon: '🗳️', status: 'active', sortOrder: 9, minReward: 0.08, defaultReward: 0.10, maxReward: 1.50, estimatedTimeMinutes: 2, minQuestions: 1, maxQuestions: 10, requireApproval: false },
            { id: 'cat_consumer', name: 'Consumer Research', slug: 'consumer-research', description: 'Detailed shopping behavior, brand choices and lifestyle analysis', icon: '🛒', status: 'active', sortOrder: 10, minReward: 0.30, defaultReward: 0.45, maxReward: 6.00, estimatedTimeMinutes: 10, minQuestions: 5, maxQuestions: 35, requireApproval: false },
            { id: 'cat_demographic', name: 'Demographic Survey', slug: 'demographic-survey', description: 'Targeted demographic audience mapping and qualification', icon: '👥', status: 'active', sortOrder: 11, minReward: 0.15, defaultReward: 0.25, maxReward: 3.00, estimatedTimeMinutes: 5, minQuestions: 3, maxQuestions: 20, requireApproval: false },
            { id: 'cat_academic', name: 'Academic Research', slug: 'academic-research', description: 'University and scientific studies with structured response forms', icon: '🎓', status: 'active', sortOrder: 12, minReward: 0.35, defaultReward: 0.50, maxReward: 8.00, estimatedTimeMinutes: 12, minQuestions: 5, maxQuestions: 40, requireApproval: false },
            { id: 'cat_lead', name: 'Lead Qualification', slug: 'lead-qualification', description: 'Prospective client discovery and requirement screening', icon: '🎯', status: 'active', sortOrder: 13, minReward: 0.40, defaultReward: 0.60, maxReward: 10.00, estimatedTimeMinutes: 8, minQuestions: 3, maxQuestions: 25, requireApproval: false },
            { id: 'cat_satisfaction', name: 'Satisfaction Survey', slug: 'satisfaction-survey', description: 'CSAT, Net Promoter Score (NPS) and post-purchase surveys', icon: '😊', status: 'active', sortOrder: 14, minReward: 0.15, defaultReward: 0.22, maxReward: 3.00, estimatedTimeMinutes: 4, minQuestions: 2, maxQuestions: 20, requireApproval: false }
        ];
        needsSave = true;
    }
    if (!settings.surveyConfig.rateRules) {
        settings.surveyConfig.rateRules = {
            baseReward: 0.10,
            workerReward: 0.08,
            platformFee: 0.02,
            minCampaignBudget: 1.00,
            maxCampaignBudget: 10000,
            timeTiers: [
                { id: 'tt_1', duration: '1-3 Minutes', minutes: 3, advertiserRate: 0.15, workerReward: 0.10, platformFee: 0.05, minSlots: 10, enabled: true },
                { id: 'tt_2', duration: '4-7 Minutes', minutes: 7, advertiserRate: 0.30, workerReward: 0.22, platformFee: 0.08, minSlots: 10, enabled: true },
                { id: 'tt_3', duration: '8-15 Minutes', minutes: 15, advertiserRate: 0.60, workerReward: 0.45, platformFee: 0.15, minSlots: 5, enabled: true },
                { id: 'tt_4', duration: '16-30 Minutes', minutes: 30, advertiserRate: 1.20, workerReward: 0.90, platformFee: 0.30, minSlots: 5, enabled: true },
                { id: 'tt_5', duration: '31+ Minutes', minutes: 45, advertiserRate: 2.00, workerReward: 1.50, platformFee: 0.50, minSlots: 5, enabled: true }
            ],
            questionTiers: [
                { id: 'qt_1', range: '1-5 Questions', maxQuestions: 5, priceAdjustment: 0.00, enabled: true },
                { id: 'qt_2', range: '6-10 Questions', maxQuestions: 10, priceAdjustment: 0.05, enabled: true },
                { id: 'qt_3', range: '11-20 Questions', maxQuestions: 20, priceAdjustment: 0.15, enabled: true },
                { id: 'qt_4', range: '21-30 Questions', maxQuestions: 30, priceAdjustment: 0.30, enabled: true },
                { id: 'qt_5', range: '31+ Questions', maxQuestions: 100, priceAdjustment: 0.50, enabled: true }
            ],
            targetingPremium: 0.05,
            qualificationReward: 0.01,
            screeningRewardAmount: 0.01,
            allowScreeningReward: false
        };
        needsSave = true;
    }
    if (!settings.surveyConfig.templates) {
        settings.surveyConfig.templates = [
            {
                id: 'tmpl_csat',
                name: 'Customer Satisfaction (CSAT) Standard',
                category: 'Satisfaction Survey',
                description: 'Measure customer happiness, rating, and feedback recommendations',
                estimatedTimeMinutes: 4,
                questions: [
                    { id: 'q1', type: 'rating', title: 'Overall, how satisfied are you with our service?', required: true, minRating: 1, maxRating: 5, ratingScaleType: 'stars' },
                    { id: 'q2', type: 'opinion_scale', title: 'How likely are you to recommend us to a friend or colleague?', required: true, minRating: 1, maxRating: 10 },
                    { id: 'q3', type: 'single_choice', title: 'What is your primary use case for our platform?', required: true, options: ['Personal Use', 'Freelancing / Earning', 'Business / Advertising', 'Other'] },
                    { id: 'q4', type: 'long_text', title: 'What is one thing we could do better?', required: false }
                ]
            },
            {
                id: 'tmpl_market',
                name: 'Consumer Habits & Device Preferences',
                category: 'Market Research',
                description: 'Audience hardware, operating system, and digital routine survey',
                estimatedTimeMinutes: 5,
                questions: [
                    { id: 'q1', type: 'single_choice', title: 'Which operating system do you use most often?', required: true, options: ['Android', 'iOS / Apple', 'Windows', 'MacOS', 'Other'] },
                    { id: 'q2', type: 'multiple_choice', title: 'Which social media platforms do you check daily?', required: true, options: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'WhatsApp', 'X (Twitter)'] },
                    { id: 'q3', type: 'yes_no', title: 'Have you made an online purchase in the last 30 days?', required: true },
                    { id: 'q4', type: 'rating', title: 'Rate your confidence in digital shopping security', required: true, minRating: 1, maxRating: 5 }
                ]
            }
        ];
        needsSave = true;
    }
    if (!settings.surveyConfig.questionBank) {
        settings.surveyConfig.questionBank = [
            { id: 'qb_1', category: 'General', type: 'single_choice', title: 'Which device do you use predominantly for online work?', options: ['Smartphone', 'Laptop / PC', 'Tablet', 'Other'], tags: ['device', 'demographic'] },
            { id: 'qb_2', category: 'Attention Check', type: 'single_choice', title: 'Attention verification: Please select "Strongly Agree" to continue.', options: ['Strongly Disagree', 'Neutral', 'Strongly Agree', 'Disagree'], isAttentionCheck: true, expectedAnswer: 'Strongly Agree', tags: ['anti-fraud', 'attention'] },
            { id: 'qb_3', category: 'Demographics', type: 'single_choice', title: 'What is your current employment status?', options: ['Employed Full-Time', 'Part-Time', 'Freelancer / Gig Worker', 'Student', 'Unemployed'], tags: ['employment', 'demographics'] },
            { id: 'qb_4', category: 'Satisfaction', type: 'rating', title: 'How would you rate the responsiveness and speed of our website?', minRating: 1, maxRating: 5, tags: ['speed', 'ux'] },
            { id: 'qb_5', category: 'Feedback', type: 'long_text', title: 'Please share any specific suggestions or improvements you would like to see.', tags: ['text', 'feedback'] }
        ];
        needsSave = true;
    }
    if (!settings.surveyConfig.allowedCustomizations) {
        settings.surveyConfig.allowedCustomizations = {
            allowUserChangeReward: true,
            allowUserChangeCompletionTime: true,
            allowUserChangeTargeting: true,
            allowUserChangeQuestions: true,
            allowUserChangeResponsesCount: true
        };
        needsSave = true;
    }
    if (!settings.surveyConfig.securityRules) {
        settings.surveyConfig.securityRules = {
            minCompletionTimeRatio: 0.3,
            enforceAntiSpeeding: true,
            enforceOneResponsePerUser: true,
            allowAttentionChecks: true
        };
        needsSave = true;
    }
    if (!settings.surveyConfig.rotationRules) {
        settings.surveyConfig.rotationRules = {
            allowQuestionRotation: true,
            allowOptionRotation: true,
            globalRotationEnabled: false,
            globalOptionRotationEnabled: false
        };
        needsSave = true;
    }
    if (!settings.surveyConfig.defaultConsentText) {
        settings.surveyConfig.defaultConsentText = 'I agree to participate in this survey and confirm that my answers will be accurate, honest, and complete.';
        needsSave = true;
    }
    if (needsSave) {
        settings.markModified('surveyConfig');
        await settings.save();
    }
    if (needsSave) { await settings.save(); }
    return settings;
};

// Static method to bump the version
SettingSchema.statics.bumpVersion = async function() {
    await this.findOneAndUpdate({}, { dataVersion: Date.now() }, { upsert: true });
};

export default mongoose.model('Setting', SettingSchema);
