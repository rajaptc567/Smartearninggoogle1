import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const CURRENCY_MAP = {
    'pakistan': 'PKR',
    'germany': 'EUR',
    'france': 'EUR',
    'italy': 'EUR',
    'spain': 'EUR',
    'austria': 'EUR',
    'netherlands': 'EUR',
    'belgium': 'EUR'
};

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: [true, 'Please add a full name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false, 
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
    },
    whatsapp: { type: String },
    country: {
        type: String,
        required: [true, 'Please add a country'],
        trim: true
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
    },
    walletBalance: {
        type: Number,
        default: 0, 
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
        login: { type: Boolean, default: false },
        purchase: { type: Boolean, default: false },
    },
    startedTasks: [{
        taskId: { type: mongoose.Schema.ObjectId, ref: 'Task' },
        startedAt: { type: Date, default: Date.now }
    }],
    completedTasks: [{
        taskId: { type: mongoose.Schema.ObjectId, ref: 'Task' },
        proofUrl: String,
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Approved' },
        completedAt: { type: Date, default: Date.now }
    }],
    sponsor: { type: String, trim: true },
    passwordResetToken: String,
    passwordResetExpires: Date,
}, {
    timestamps: { createdAt: 'registrationDate', updatedAt: true }
});

UserSchema.pre('save', async function(next) {
    if (this.isModified('country') || !this.currency) {
        const normalizedCountry = (this.country || 'Pakistan').trim().toLowerCase();
        this.currency = CURRENCY_MAP[normalizedCountry] || 'USD';
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

export default mongoose.model('User', UserSchema);