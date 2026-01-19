
import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['Deposit', 'Withdrawal', 'Commission', 'Manual Credit', 'Manual Debit', 'Withdrawal Request', 'Withdrawal Refund', 'Plan Purchase', 'Transfer Sent', 'Transfer Received', 'Transfer Request', 'Transfer Refund'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    level: {
        type: Number,
    },
    sourceUserId: { // The user who triggered the transaction (e.g., plan purchaser)
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
    },
    relatedPlanId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InvestmentPlan'
    },
    // For multi-currency commission tracking
    originalAmount: {
        type: Number,
    },
    originalCurrency: {
        type: String,
        enum: ['EUR', 'PKR', 'USD'],
    },
    exchangeRate: {
        type: Number,
    }
}, {
    timestamps: { createdAt: 'date', updatedAt: false }
});

/**
 * --- CONTENT IMMUTABILITY LOGIC ---
 * We block updates to financial core data but allow updates to status/notes.
 */
const FORBIDDEN_FIELDS = ['amount', 'currency', 'userId', 'type', 'level', 'sourceUserId', 'relatedPlanId'];

TransactionSchema.pre('save', function(next) {
    if (!this.isNew) {
        for (const field of FORBIDDEN_FIELDS) {
            if (this.isModified(field)) {
                return next(new Error(`Field '${field}' is immutable and cannot be changed after creation.`));
            }
        }
    }
    next();
});

const validateUpdate = function(next) {
    const update = this.getUpdate();
    // Check fields in $set or direct update object
    const actualUpdate = update.$set || update;
    
    const attemptedChanges = Object.keys(actualUpdate);
    const violations = attemptedChanges.filter(key => FORBIDDEN_FIELDS.includes(key));

    if (violations.length > 0) {
        return next(new Error(`Forbidden update: Financial core fields [${violations.join(', ')}] are immutable.`));
    }
    next();
};

TransactionSchema.pre('updateOne', validateUpdate);
TransactionSchema.pre('updateMany', validateUpdate);
TransactionSchema.pre('findOneAndUpdate', validateUpdate);

// Prevent Deletions
const preventDelete = function(next) {
    next(new Error('Prohibited Action: Financial records cannot be deleted.'));
};

TransactionSchema.pre('deleteOne', preventDelete);
TransactionSchema.pre('deleteMany', preventDelete);
TransactionSchema.pre('findOneAndDelete', preventDelete);

export default mongoose.model('Transaction', TransactionSchema);
