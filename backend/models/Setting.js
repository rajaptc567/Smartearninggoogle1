
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
        USD: { type: Number, default: 1 },
        EUR: { type: Number, default: 0.92 },
        PKR: { type: Number, default: 278.50 }
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
    tickerRealActivities: {
        deposits: { type: Boolean, default: true },
        withdrawals: { type: Boolean, default: true },
        registrations: { type: Boolean, default: true },
        commissions: { type: Boolean, default: true },
        transfers: { type: Boolean, default: true },
        planPurchases: { type: Boolean, default: true }
    },
    tickerDemoAmountRanges: {
        USD: { min: { type: Number, default: 50 }, max: { type: Number, default: 500 } },
        EUR: { min: { type: Number, default: 50 }, max: { type: Number, default: 500 } },
        PKR: { min: { type: Number, default: 5000 }, max: { type: Number, default: 50000 } },
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
    {"_id":"11","name":"Daniel K.","country":"Germany","currency":"EUR"},
    {"_id":"12","name":"Olivia C.","country":"United States","currency":"USD"},
    {"_id":"13","name":"Hassan J.","country":"Pakistan","currency":"PKR"},
    {"_id":"14","name":"Chloe T.","country":"France","currency":"EUR"},
    {"_id":"15","name":"William D.","country":"Canada","currency":"USD"},
    {"_id":"16","name":"Zainab A.","country":"Pakistan","currency":"PKR"},
    {"_id":"17","name":"James W.","country":"United Kingdom","currency":"USD"},
    {"_id":"18","name":"Bilal Q.","country":"Pakistan","currency":"PKR"},
    {"_id":"19","name":"Mia S.","country":"Australia","currency":"USD"},
    {"_id":"20","name":"Laura B.","country":"Germany","currency":"EUR"},
    {"_id":"21","name":"David J.","country":"United States","currency":"USD"},
    {"_id":"22","name":"Usman G.","country":"Pakistan","currency":"PKR"},
    {"_id":"23","name":"Arthur R.","country":"France","currency":"EUR"},
    {"_id":"24","name":"Charlotte N.","country":"Canada","currency":"USD"},
    {"_id":"25","name":"Sana I.","country":"Pakistan","currency":"PKR"},
    {"_id":"26","name":"Harry P.","country":"United Kingdom","currency":"USD"},
    {"_id":"27","name":"Omer S.","country":"Pakistan","currency":"PKR"},
    {"_id":"28","name":"Amelia T.","country":"Australia","currency":"USD"},
    {"_id":"29","name":"Jonas F.","country":"Germany","currency":"EUR"},
    {"_id":"30","name":"Ava M.","country":"United States","currency":"USD"},
    {"_id":"31","name":"Imran H.","country":"Pakistan","currency":"PKR"},
    {"_id":"32","name":"Manon L.","country":"France","currency":"EUR"},
    {"_id":"33","name":"Noah W.","country":"Canada","currency":"USD"},
    {"_id":"34","name":"Maryam B.","country":"Pakistan","currency":"PKR"},
    {"_id":"35","name":"George C.","country":"United Kingdom","currency":"USD"},
    {"_id":"36","name":"Saad A.","country":"Pakistan","currency":"PKR"},
    {"_id":"37","name":"Isla H.","country":"Australia","currency":"USD"},
    {"_id":"38","name":"Finn S.","country":"Germany","currency":"EUR"},
    {"_id":"39","name":"Liam P.","country":"United States","currency":"USD"},
    {"_id":"40","name":"Khadija N.","country":"Pakistan","currency":"PKR"},
    {"_id":"41","name":"Louis B.","country":"France","currency":"EUR"},
    {"_id":"42","name":"Emma G.","country":"Canada","currency":"USD"},
    {"_id":"43","name":"Ayesha T.","country":"Pakistan","currency":"PKR"},
    {"_id":"44","name":"Thomas H.","country":"United Kingdom","currency":"USD"},
    {"_id":"45","name":"Fahad M.","country":"Pakistan","currency":"PKR"},
    {"_id":"46","name":"Grace W.","country":"Australia","currency":"USD"},
    {"_id":"47","name":"Leon K.","country":"Germany","currency":"EUR"},
    {"_id":"48","name":"Benjamin T.","country":"United States","currency":"USD"},
    {"_id":"49","name":"Hamza Y.","country":"Pakistan","currency":"PKR"},
    {"_id":"50","name":"Camille D.","country":"France","currency":"EUR"},
    {"_id":"51","name":"Logan R.","country":"Canada","currency":"USD"},
    {"_id":"52","name":"Rabia S.","country":"Pakistan","currency":"PKR"},
    {"_id":"53","name":"Oscar E.","country":"United Kingdom","currency":"USD"},
    {"_id":"54","name":"Talha J.","country":"Pakistan","currency":"PKR"},
    {"_id":"55","name":"Ruby K.","country":"Australia","currency":"USD"},
    {"_id":"56","name":"Elias V.","country":"Germany","currency":"EUR"},
    {"_id":"57","name":"Henry A.","country":"United States","currency":"USD"},
    {"_id":"58","name":"Waqas F.","country":"Pakistan","currency":"PKR"},
    {"_id":"59","name":"Jules V.","country":"France","currency":"EUR"},
    {"_id":"60","name":"Hannah B.","country":"Canada","currency":"USD"},
    {"_id":"61","name":"Nida K.","country":"Pakistan","currency":"PKR"},
    {"_id":"62","name":"Freddie M.","country":"United Kingdom","currency":"USD"},
    {"_id":"63","name":"Yasir I.","country":"Pakistan","currency":"PKR"},
    {"_id":"64","name":"Zoe P.","country":"Australia","currency":"USD"},
    {"_id":"65","name":"Paul W.","country":"Germany","currency":"EUR"},
    {"_id":"66","name":"Alexander M.","country":"United States","currency":"USD"},
    {"_id":"67","name":"Danish Z.","country":"Pakistan","currency":"PKR"},
    {"_id":"68","name":"Adam M.","country":"France","currency":"EUR"},
    {"_id":"69","name":"Lily S.","country":"Canada","currency":"USD"},
    {"_id":"70","name":"Aqsa R.","country":"Pakistan","currency":"PKR"},
    {"_id":"71","name":"Alfie J.","country":"United Kingdom","currency":"USD"},
    {"_id":"72","name":"Kamran A.","country":"Pakistan","currency":"PKR"},
    {"_id":"73","name":"Chloe W.","country":"Australia","currency":"USD"},
    {"_id":"74","name":"Felix H.","country":"Germany","currency":"EUR"},
    {"_id":"75","name":"Samuel H.","country":"United States","currency":"USD"},
    {"_id":"76","name":"Salman B.","country":"Pakistan","currency":"PKR"},
    {"_id":"77","name":"Lea P.","country":"France","currency":"EUR"},
    {"_id":"78","name":"Evelyn L.","country":"Canada","currency":"USD"},
    {"_id":"79","name":"Saima N.","country":"Pakistan","currency":"PKR"},
    {"_id":"80","name":"Jacob R.","country":"United Kingdom","currency":"USD"},
    {"_id":"81","name":"Arslan Q.","country":"Pakistan","currency":"PKR"},
    {"_id":"82","name":"Ivy G.","country":"Australia","currency":"USD"},
    {"_id":"83","name":"Maximilian S.","country":"Germany","currency":"EUR"},
    {"_id":"84","name":"Jackson L.","country":"United States","currency":"USD"},
    {"_id":"85","name":"Rizwan T.","country":"Pakistan","currency":"PKR"},
    {"_id":"86","name":"Enzo C.","country":"France","currency":"EUR"},
    {"_id":"87","name":"Abigail F.","country":"Canada","currency":"USD"},
    {"_id":"88","name":"Hina J.","country":"Pakistan","currency":"PKR"},
    {"_id":"89","name":"Charlie G.","country":"United Kingdom","currency":"USD"},
    {"_id":"90","name":"Noman S.","country":"Pakistan","currency":"PKR"},
    {"_id":"91","name":"Matilda R.","country":"Australia","currency":"USD"},
    {"_id":"92","name":"Lina M.","country":"Germany","currency":"EUR"},
    {"_id":"93","name":"Sebastian C.","country":"United States","currency":"USD"},
    {"_id":"94","name":"Junaid I.","country":"Pakistan","currency":"PKR"},
    {"_id":"95","name":"Raphael G.","country":"France","currency":"EUR"},
    {"_id":"96","name":"Sofia D.","country":"Canada","currency":"USD"},
    {"_id":"97","name":"Farah K.","country":"Pakistan","currency":"PKR"},
    {"_id":"98","name":"Leo D.","country":"United Kingdom","currency":"USD"},
    {"_id":"99","name":"Adnan H.","country":"Pakistan","currency":"PKR"},
    {"_id":"100","name":"Ella J.","country":"Australia","currency":"USD"}
];

const defaultDemoTemplates = [
    {"_id":"t1","template":"{name} from {country} is now part of the community!","type":"joined","enabled":true},
    {"_id":"t2","template":"A warm welcome to our newest member, {name}!","type":"joined","enabled":true},
    {"_id":"t3","template":"Say hello to {name} from {country}!","type":"joined","enabled":true},
    {"_id":"t4","template":"Welcome aboard, {name}! Great to have you.","type":"joined","enabled":true},
    {"_id":"t5","template":"The community just got bigger! Welcome, {name}.","type":"joined","enabled":true},
    {"_id":"t6","template":"{name} just started their journey with us.","type":"joined","enabled":true},
    {"_id":"t7","template":"Let's give a big shoutout to {name} for joining!","type":"joined","enabled":true},
    {"_id":"t8","template":"New member alert: {name} from {country} is here.","type":"joined","enabled":true},
    {"_id":"t9","template":"Another success story begins! Welcome, {name}.","type":"joined","enabled":true},
    {"_id":"t10","template":"We're thrilled to welcome {name} to the family.","type":"joined","enabled":true},
    {"_id":"t11","template":"{name} has officially joined the platform.","type":"joined","enabled":true},
    {"_id":"t12","template":"A new member, {name}, has just registered.","type":"joined","enabled":true},
    {"_id":"t13","template":"Our network grows stronger with {name} from {country}.","type":"joined","enabled":true},
    {"_id":"t14","template":"Welcome to the team, {name}! Let's achieve great things.","type":"joined","enabled":true},
    {"_id":"t15","template":"The latest to join our ranks: {name}.","type":"joined","enabled":true},
    {"_id":"t16","template":"Excited to have {name} on board!","type":"joined","enabled":true},
    {"_id":"t17","template":"{name} from {country} is ready to start earning.","type":"joined","enabled":true},
    {"_id":"t18","template":"A big welcome to {name}! The journey starts now.","type":"joined","enabled":true},
    {"_id":"t19","template":"New registration: {name} is now a member.","type":"joined","enabled":true},
    {"_id":"t20","template":"The community is buzzing! Welcome, {name}.","type":"joined","enabled":true},
    {"_id":"t21","template":"Here's to new beginnings! Welcome, {name}.","type":"joined","enabled":true},
    {"_id":"t22","template":"{name} from {country} just signed up!","type":"joined","enabled":true},
    {"_id":"t23","template":"Let's all welcome our new member, {name}.","type":"joined","enabled":true},
    {"_id":"t24","template":"So glad you're here, {name}!","type":"joined","enabled":true},
    {"_id":"t25","template":"The SmartEarning family welcomes {name}.","type":"joined","enabled":true},
    {"_id":"t26","template":"Newest member on the block: {name} from {country}.","type":"joined","enabled":true},
    {"_id":"t27","template":"It's official! {name} is one of us now.","type":"joined","enabled":true},
    {"_id":"t28","template":"We're growing! A big welcome to {name}.","type":"joined","enabled":true},
    {"_id":"t29","template":"{name} just took the first step towards success.","type":"joined","enabled":true},
    {"_id":"t30","template":"Happy to announce {name} has joined us!","type":"joined","enabled":true},
    {"_id":"t31","template":"A new investor, {name}, has joined the platform.","type":"joined","enabled":true},
    {"_id":"t32","template":"The more the merrier! Welcome, {name}.","type":"joined","enabled":true},
    {"_id":"t33","template":"Say hi to {name} from {country}, our newest member!","type":"joined","enabled":true},
    {"_id":"t34","template":"Let's go! {name} has joined the community.","type":"joined","enabled":true},
    {"_id":"t35","template":"Another visionary joins! Welcome {name}.","type":"joined","enabled":true},
    {"_id":"t36","template":"A new deposit of {amount} was made by {name}.","type":"deposit","enabled":true},
    {"_id":"t37","template":"{name} from {country} added {amount} to their wallet.","type":"deposit","enabled":true},
    {"_id":"t38","template":"{name} just funded their account with {amount}.","type":"deposit","enabled":true},
    {"_id":"t39","template":"Funds incoming! {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t40","template":"Wallet topped up: {name} added {amount}.","type":"deposit","enabled":true},
    {"_id":"t41","template":"{amount} successfully deposited by {name}.","type":"deposit","enabled":true},
    {"_id":"t42","template":"{name} is ready to invest after depositing {amount}.","type":"deposit","enabled":true},
    {"_id":"t43","template":"Account funding successful for {name} ({amount}).","type":"deposit","enabled":true},
    {"_id":"t44","template":"New activity: {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t45","template":"{name} just made a deposit of {amount}.","type":"deposit","enabled":true},
    {"_id":"t46","template":"Funds secured! {name} from {country} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t47","template":"{amount} has been added to {name}'s account.","type":"deposit","enabled":true},
    {"_id":"t48","template":"Investment power-up! {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t49","template":"{name} is all set after a {amount} deposit.","type":"deposit","enabled":true},
    {"_id":"t50","template":"Deposit alert: {name} added {amount}.","type":"deposit","enabled":true},
    {"_id":"t51","template":"Transaction approved: {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t52","template":"{name} from {country} just powered up their wallet with {amount}.","type":"deposit","enabled":true},
    {"_id":"t53","template":"Ready for action! {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t54","template":"Another successful deposit: {amount} from {name}.","type":"deposit","enabled":true},
    {"_id":"t55","template":"{name}'s wallet is now {amount} richer.","type":"deposit","enabled":true},
    {"_id":"t56","template":"Funding complete for {name} with {amount}.","type":"deposit","enabled":true},
    {"_id":"t57","template":"{name} just increased their balance by {amount}.","type":"deposit","enabled":true},
    {"_id":"t58","template":"Deposit received: {amount} from {name} in {country}.","type":"deposit","enabled":true},
    {"_id":"t59","template":"Smart move! {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t60","template":"{name} has successfully added {amount} to their balance.","type":"deposit","enabled":true},
    {"_id":"t61","template":"New funds alert! {name} deposited {amount}.","type":"deposit","enabled":true},
    {"_id":"t62","template":"Account balance updated for {name} with a {amount} deposit.","type":"deposit","enabled":true},
    {"_id":"t63","template":"{name} is gearing up with a {amount} deposit.","type":"deposit","enabled":true},
    {"_id":"t64","template":"The latest deposit: {amount} from {name}.","type":"deposit","enabled":true},
    {"_id":"t65","template":"Way to go, {name}! {amount} deposited.","type":"deposit","enabled":true},
    {"_id":"t66","template":"{name} just added {amount} to start investing.","type":"deposit","enabled":true},
    {"_id":"t67","template":"Funds in! {name} from {country} made a deposit.","type":"deposit","enabled":true},
    {"_id":"t68","template":"Another member funding their future: {name} with {amount}.","type":"deposit","enabled":true},
    {"_id":"t69","template":"Deposit confirmed for {name}: {amount}.","type":"deposit","enabled":true},
    {"_id":"t70","template":"Account loaded! {name} added {amount}.","type":"deposit","enabled":true},
    {"_id":"t71","template":"{name} just cashed out {amount}!","type":"withdrawal","enabled":true},
    {"_id":"t72","template":"Successful withdrawal of {amount} for {name}.","type":"withdrawal","enabled":true},
    {"_id":"t73","template":"{name} from {country} received a payment of {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t74","template":"Payout successful! {name} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t75","template":"Earnings in the bank! {name} cashed out {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t76","template":"{amount} on its way to {name}. Congrats!","type":"withdrawal","enabled":true},
    {"_id":"t77","template":"{name} just made a successful withdrawal of {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t78","template":"Another happy member! {name} from {country} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t79","template":"Cash out alert: {amount} for {name}.","type":"withdrawal","enabled":true},
    {"_id":"t80","template":"Enjoy your earnings, {name}! ({amount})","type":"withdrawal","enabled":true},
    {"_id":"t81","template":"{name} just received their payment of {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t82","template":"Withdrawal approved for {name}: {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t83","template":"It pays to be with us! {name} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t84","template":"{name}'s hard work paid off: {amount} withdrawn.","type":"withdrawal","enabled":true},
    {"_id":"t85","template":"Another successful payout: {amount} to {name} from {country}.","type":"withdrawal","enabled":true},
    {"_id":"t86","template":"Funds transferred! {name} received {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t87","template":"Profit taking! {name} just withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t88","template":"{name} is enjoying the fruits of their labor with a {amount} withdrawal.","type":"withdrawal","enabled":true},
    {"_id":"t89","template":"Withdrawal alert: {name} cashed out.","type":"withdrawal","enabled":true},
    {"_id":"t90","template":"Another member seeing results: {name} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t91","template":"From wallet to bank: {name} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t92","template":"Great news! {name} from {country} has been paid {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t93","template":"It's payday for {name}! {amount} withdrawn.","type":"withdrawal","enabled":true},
    {"_id":"t94","template":"{name}'s withdrawal request of {amount} has been processed.","type":"withdrawal","enabled":true},
    {"_id":"t95","template":"Real earnings, real results. {name} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t96","template":"Payout alert for {name} of {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t97","template":"Success! {name} just received their earnings.","type":"withdrawal","enabled":true},
    {"_id":"t98","template":"{name} from {country} is happy with their {amount} withdrawal.","type":"withdrawal","enabled":true},
    {"_id":"t99","template":"Funds sent to {name} for {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t100","template":"The latest withdrawal: {amount} by {name}.","type":"withdrawal","enabled":true},
    {"_id":"t101","template":"Congratulations, {name}, on your successful withdrawal!","type":"withdrawal","enabled":true},
    {"_id":"t102","template":"{name} just secured their profit of {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t103","template":"Another payout processed: {name} from {country}.","type":"withdrawal","enabled":true},
    {"_id":"t104","template":"Ka-ching! {name} withdrew {amount}.","type":"withdrawal","enabled":true},
    {"_id":"t105","template":"Enjoy the rewards, {name}! {amount} cashed out.","type":"withdrawal","enabled":true},
    {"_id":"t106","template":"{name} just upgraded to the {plan} plan!","type":"plan","enabled":true},
    {"_id":"t107","template":"Welcome to the {plan} plan, {name}!","type":"plan","enabled":true},
    {"_id":"t108","template":"{name} from {country} has joined the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t109","template":"Big moves! {name} is now on the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t110","template":"{name} has unlocked new potential with the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t111","template":"Upgraded! {name} is now a {plan} member.","type":"plan","enabled":true},
    {"_id":"t112","template":"Congratulations, {name}, on upgrading to {plan}!","type":"plan","enabled":true},
    {"_id":"t113","template":"{name} from {country} just invested in the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t114","template":"New plan purchase: {name} chose the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t115","template":"{name} is leveling up with the {plan} plan!","type":"plan","enabled":true},
    {"_id":"t116","template":"Smart choice, {name}! Welcome to the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t117","template":"The {plan} plan just got a new member: {name}.","type":"plan","enabled":true},
    {"_id":"t118","template":"{name} has expanded their portfolio with the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t119","template":"Success journey continues for {name} with the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t120","template":"{name} is now on a higher tier: {plan}.","type":"plan","enabled":true},
    {"_id":"t121","template":"Plan activation: {plan} for {name} from {country}.","type":"plan","enabled":true},
    {"_id":"t122","template":"Another member upgrading for success: {name} to {plan}.","type":"plan","enabled":true},
    {"_id":"t123","template":"{name} just took their investment to the next level with {plan}.","type":"plan","enabled":true},
    {"_id":"t124","template":"Welcome, {name}, to the exclusive {plan} plan!","type":"plan","enabled":true},
    {"_id":"t125","template":"{name}'s new plan: {plan}. Great choice!","type":"plan","enabled":true},
    {"_id":"t126","template":"Plan purchase alert: {name} bought the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t127","template":"Let's congratulate {name} on their new {plan} plan!","type":"plan","enabled":true},
    {"_id":"t128","template":"{name} from {country} is now enjoying the benefits of the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t129","template":"New {plan} plan member: {name}!","type":"plan","enabled":true},
    {"_id":"t130","template":"{name} is aiming higher with the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t131","template":"The community welcomes {name} to the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t132","template":"Investment plan purchased: {plan} by {name}.","type":"plan","enabled":true},
    {"_id":"t133","template":"{name} just joined the ranks of our {plan} members.","type":"plan","enabled":true},
    {"_id":"t134","template":"A strategic upgrade by {name} to the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t135","template":"Well done, {name}, on choosing the {plan} plan!","type":"plan","enabled":true},
    {"_id":"t136","template":"New upgrade alert: {name} is now on {plan}.","type":"plan","enabled":true},
    {"_id":"t137","template":"Another step up! {name} from {country} upgraded.","type":"plan","enabled":true},
    {"_id":"t138","template":"Congratulations {name} on the {plan} plan purchase!","type":"plan","enabled":true},
    {"_id":"t139","template":"{name} is now a proud member of the {plan} plan.","type":"plan","enabled":true},
    {"_id":"t140","template":"Let's go! {name} upgraded their plan.","type":"plan","enabled":true},
    {"_id":"t141","template":"{name} sent funds to another member.","type":"transfer","enabled":false},
    {"_id":"t142","template":"Peer-to-peer transfer initiated by {name}.","type":"transfer","enabled":false},
    {"_id":"t143","template":"{name} just helped out a team member with a transfer.","type":"transfer","enabled":false},
    {"_id":"t144","template":"Funds transferred between members by {name}.","type":"transfer","enabled":false},
    {"_id":"t145","template":"{name} from {country} sent a P2P transfer.","type":"transfer","enabled":false},
    {"_id":"t146","template":"Internal transfer successful for {name}.","type":"transfer","enabled":false},
    {"_id":"t147","template":"Member-to-member transfer alert from {name}.","type":"transfer","enabled":false},
    {"_id":"t148","template":"{name} just transferred funds within the network.","type":"transfer","enabled":false},
    {"_id":"t149","template":"A quick transfer was made by {name}.","type":"transfer","enabled":false},
    {"_id":"t150","template":"Network support! {name} sent funds to a fellow member.","type":"transfer","enabled":false}
];

const defaultSettingsObject = {
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
    exchangeRates: { USD: 1, EUR: 0.92, PKR: 278.50 },
    restrictWithdrawalAmount: false,
    requirePlanMatchForCommission: false,
    requireActivePlanForCommission: false,
    oneTimeCommissionPerGroup: false,
    recurringCommissionPlanIds: [],
    requireUplineEligibility: false,
    withdrawalFrequency: { enabled: false, value: 1, unit: 'days' },
    demoProfiles: defaultDemoProfiles,
    demoActivityTemplates: defaultDemoTemplates,
    tickerSpeed: 6,
    tickerContentSource: 'hybrid',
    tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
    tickerDemoAmountRanges: {
        USD: { min: 50, max: 500 },
        EUR: { min: 50, max: 500 },
        PKR: { min: 5000, max: 50000 },
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

    // Self-healing: Check if demo data is missing and add it.
    if (!settings.demoProfiles || settings.demoProfiles.length === 0) {
        settings.demoProfiles = defaultDemoProfiles;
        needsSave = true;
    }
    if (!settings.demoActivityTemplates || settings.demoActivityTemplates.length === 0) {
        settings.demoActivityTemplates = defaultDemoTemplates;
        needsSave = true;
    }

    if (needsSave) {
        await settings.save();
    }

    return settings;
};

export default mongoose.model('Setting', SettingSchema);
