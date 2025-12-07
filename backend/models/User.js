
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
        required: [true, 'Please add a full name'],
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
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
    },
    whatsapp: {
        type: String,
    },
    country: {
        type: String,
        required: [true, 'Please add a country'],
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR'],
        required: true,
    },
    walletBalance: {
        type: Number,
        default: 0,
    },
    activePlan: {
        type: String,
        default: 'None', // Kept for backward compatibility/quick display of latest plan
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
    },
    sponsor: {
        type: String,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
}, {
    timestamps: { createdAt: 'registrationDate', updatedAt: true }
});

// Corrected pre-save hook for password hashing and data migration
UserSchema.pre('save', async function(next) {
    // Data Migration for country if it's missing (for very old docs)
    if (!this.country) {
        this.country = 'Pakistan'; // Assign a sensible default to Pakistan
    }

    // Auto-update currency IF country is modified OR if currency is missing.
    if (this.isModified('country') || !this.currency) {
        if (europeanCountries.map(c => c.toLowerCase()).includes(this.country.toLowerCase())) {
            this.currency = 'EUR';
        } else {
            // Default to PKR for Pakistan and rest of world
            this.currency = 'PKR';
        }
    }
    
    // Password Hashing
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    next();
});

// Method to match entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);
