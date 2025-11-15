import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString()
    },
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
        select: false, // Don't return password by default when querying users
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
        default: 'None',
    },
    status: {
        type: String,
        enum: ['Active', 'Blocked', 'Pending', 'Approved', 'Rejected', 'Paid', 'Disabled', 'Matching'],
        default: 'Pending',
    },
    sponsor: {
        type: String, // Can be changed to mongoose.Schema.ObjectId with ref: 'User' for relational queries
    },
}, {
    _id: false,
    timestamps: { createdAt: 'registrationDate', updatedAt: true } // Use timestamps to auto-manage creation/update dates
});

export default mongoose.model('User', UserSchema);