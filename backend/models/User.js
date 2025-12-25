
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
        enum: ['EUR', 'PKR', 'USD'],
        required: [true, 'Currency is required'],
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

// Logic moved here to trigger BEFORE validation checks for 'required' fields
UserSchema.pre('validate', function(next) {
    // Data Migration for country if it's missing (for very old docs or incomplete registration data)
    if (!this.country) {
        this.country = 'Pakistan'; 
    }

    // Auto-update currency IF it's a new user OR if country changed OR if currency is missing.
    if (this.isNew || this.isModified('country') || !this.currency) {
        const countryLower = this.country.toLowerCase();
        
        if (countryLower === 'pakistan') {
             this.currency = 'PKR';
        } else if (europeanCountries.some(c => c.toLowerCase() === countryLower)) {
            this.currency = 'EUR';
        } else {
            // Default to USD for rest of world
            this.currency = 'USD';
        }
    }
    next();
});

UserSchema.pre('save', async function(next) {
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
