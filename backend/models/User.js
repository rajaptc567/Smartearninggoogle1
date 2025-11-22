
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    sponsor: {
        type: String,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
}, {
    timestamps: { createdAt: 'registrationDate', updatedAt: true }
});

// Encrypt password using bcrypt before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    // Explicitly return to prevent re-hashing if only wallet/status changed but password field was somehow touched
    // (This is a safeguard, though isModified check above handles most cases)
    return;
    
    // Only reach here if we are actually setting a new password
    // Note: The logic above is slightly tricky. Correct way for bcrypt pre-save:
    /* 
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    */
});

// Corrected pre-save hook for password hashing
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to match entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);
