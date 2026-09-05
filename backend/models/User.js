
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true,
        trim: true,
    },
    fullName: {
        type: String,
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email',
        ],
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false, 
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'finance', 'support', 'user'],
        default: 'user'
    },
    phone: {
        type: String,
    },
    whatsapp: {
        type: String,
    },
    country: {
        type: String,
    },
    address: {
        type: String,
    },
    city: {
        type: String,
    },
    postalCode: {
        type: String,
    },
    telegram: {
        type: String,
    },
    gender: {
        type: String,
    },
    dateOfBirth: {
        type: String,
    },
    currency: {
        type: String,
        default: 'USD',
        required: [true, 'Please specify currency'],
    },
    walletBalance: {
        type: Number,
        default: 0,
    },
    taskWalletBalance: {
        type: Number,
        default: 0,
    },
    taskEarningsBalance: {
        type: Number,
        default: 0,
    },
    chargebackLiabilityUSD: {
        type: Number,
        default: 0,
    },
    campaignWalletSources: {
        fromInvestmentUSD: { type: Number, default: 0 },
        fromTaskEarningsUSD: { type: Number, default: 0 },
        fromRefundsUSD: { type: Number, default: 0 }
    },
    heldUpgradeBalance: {
        type: Number,
        default: 0,
    },
    activePlan: {
        type: String,
        default: 'None',
    },
    activePlans: [{
        planId: { type: mongoose.Schema.ObjectId, ref: 'InvestmentPlan' },
        planName: String,
        price: Number,
        purchaseDate: { type: Date, default: Date.now }
    }],
    status: {
        type: String,
        enum: ['Active', 'Blocked', 'Pending', 'Paused'],
        default: 'Active',
    },
    restrictions: {
        deposit: { type: Boolean, default: false },
        withdrawal: { type: Boolean, default: false },
        transfer: { type: Boolean, default: false },
        earning: { type: Boolean, default: false },
        dispute: { type: Boolean, default: false },
        excludeFromTicker: { type: Boolean, default: false },
        loginBlocked: { type: Boolean, default: false }, // Foundation Step 1 Requirement
        purchaseBlocked: { type: Boolean, default: false }, // Foundation Step 1 Requirement
    },
    disputeLossCount: { type: Number, default: 0 },
    trustScore: { type: Number, default: 100 },
    penaltyCount: { type: Number, default: 0 },
    completedTasks: [{
        taskId: { type: mongoose.Schema.ObjectId, ref: 'Task' },
        proofUrl: String,
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Approved'
        },
        adminNotes: String,
        completedAt: { type: Date, default: Date.now },
        retryCount: { type: Number, default: 0 }
    }],
    sponsor: {
        type: String,
    },
    plannedActivationDate: {
        type: Date,
    },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationCode: {
        type: String,
    },
    whatsappVerified: {
        type: Boolean,
        default: false,
    },
    whatsappVerificationCode: {
        type: String,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
}, {
    timestamps: { createdAt: 'registrationDate', updatedAt: true }
});

UserSchema.pre('validate', function(next) {
    if (!this.country) {
        this.country = 'Pakistan';
    }

    if (!this.currency || this.isModified('country')) {
        if (this.country && this.country.toLowerCase() === 'pakistan') {
             this.currency = 'PKR';
        } else if (this.country && europeanCountries.map(c => c.toLowerCase()).includes(this.country.toLowerCase())) {
            this.currency = 'EUR';
        } else if (!this.currency) {
            this.currency = 'USD';
        }
    }

    next();
});

UserSchema.pre('save', async function(next) {
    if (!this.country) {
        this.country = 'Pakistan';
    }

    if (this.isModified('country') || !this.currency) {
        if (this.country && this.country.toLowerCase() === 'pakistan') {
             this.currency = 'PKR';
        } else if (this.country && europeanCountries.map(c => c.toLowerCase()).includes(this.country.toLowerCase())) {
            this.currency = 'EUR';
        } else {
            this.currency = 'USD';
        }
    }

    // Role Safety: Promote master email only if not already at sufficient privilege level
    if (this.email === 'studio56.pk@gmail.com' && this.role !== 'super_admin') {
        this.role = 'super_admin';
    } else if (this.username === 'admin' && this.role === 'user') {
        this.role = 'admin';
    }
    
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ sponsor: 1 });

export default mongoose.model('User', UserSchema);
