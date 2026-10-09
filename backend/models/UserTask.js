import mongoose from 'mongoose';

const UserTaskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    creatorType: {
        type: String,
        enum: ['member', 'admin'],
        default: 'member'
    },
    fundingSourceType: {
        type: String,
        enum: ['member_wallet', 'admin_budget'],
        default: 'member_wallet'
    },
    adminBudgetAllocatedUSD: {
        type: Number,
        default: 0
    },
    adminBudgetRefundStatus: {
        type: String,
        enum: ['none', 'claimed', 'budget_refunded', 'settled'],
        default: 'none'
    },
    adminBudgetRefundClaimedAt: {
        type: Date,
        default: null
    },
    adminBudgetRefundAmountUSD: {
        type: Number,
        default: 0
    },
    category: {
        type: String,
        required: [true, 'Please select a task category']
    },
    subType: {
        type: String,
        required: [true, 'Please select task action type']
    },
    title: {
        type: String,
        required: [true, 'Please add a task title'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    link: {
        type: String,
        required: function() {
            return !this.isSurvey;
        },
        default: ''
    },
    targetQuantity: {
        type: Number,
        required: function() {
            return !this.isUnlimitedResponses;
        },
        default: 0,
        min: 0
    },
    isUnlimitedResponses: {
        type: Boolean,
        default: false
    },
    campaignFundingStatus: {
        type: String,
        enum: ['funded', 'low_balance', 'paused_insufficient_funds', 'resumed', 'exhausted', 'disabled'],
        default: 'funded'
    },
    campaignAvailableBalanceUSD: {
        type: Number,
        default: 0
    },
    campaignTotalFundedUSD: {
        type: Number,
        default: 0
    },
    campaignTotalSpentUSD: {
        type: Number,
        default: 0
    },
    lowBalanceThresholdPercent: {
        type: Number,
        default: 10
    },
    lowBalanceWarningSent: {
        type: Boolean,
        default: false
    },
    currentCompletions: {
        type: Number,
        default: 0
    },
    rewardPerTask: {
        type: Number,
        required: [true, 'Please specify reward amount per task'],
        validate: {
            validator: function(val) {
                if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return false;
                const isAdminSurvey = this?.isAdminResearchSurvey || (this?.getUpdate && (this.getUpdate()?.isAdminResearchSurvey || this.getUpdate()?.$set?.isAdminResearchSurvey));
                if (isAdminSurvey) {
                    return val >= 0;
                }
                return val >= 0.01;
            },
            message: 'Please specify a valid reward amount per task (minimum 0.01 for standard tasks, or 0 for internal research surveys)'
        }
    },
    totalBudget: {
        type: Number,
        required: true,
        min: 0
    },
    adminCommission: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'PKR']
    },
    requireTextProof: { type: Boolean, default: false },
    textProofInstruction: { type: String, default: '' },
    requireUsername: { type: Boolean, default: false },
    usernameInstruction: { type: String, default: '' },
    requireUserId: { type: Boolean, default: false },
    userIdInstruction: { type: String, default: '' },
    requireEmail: { type: Boolean, default: false },
    emailInstruction: { type: String, default: '' },
    requireScreenshot: { type: Boolean, default: true },
    screenshotInstruction: { type: String, default: 'Please upload screenshot proof of completion.' },
    requiredProofs: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'On Hold', 'Paid', 'Completed'],
        default: 'Pending'
    },
    history: [{
        action: { type: String, required: true },
        previousStatus: { type: String },
        newStatus: { type: String },
        timestamp: { type: Date, default: Date.now },
        performedBy: { type: String },
        details: { type: String }
    }],
    adminNotes: {
        type: String,
        default: ''
    },
    baseFeeCharged: {
        type: Number,
        default: 0
    },
    fundingSourceBreakdown: {
        fromInvestmentUSD: { type: Number, default: 0 },
        fromTaskEarningsUSD: { type: Number, default: 0 },
        fromRefundsUSD: { type: Number, default: 0 }
    },
    refundedBreakdown: {
        fromInvestmentUSD: { type: Number, default: 0 },
        fromTaskEarningsUSD: { type: Number, default: 0 },
        fromRefundsUSD: { type: Number, default: 0 }
    },
    reviewRequested: {
        type: Boolean,
        default: false
    },
    resubmittedForReview: {
        type: Boolean,
        default: false
    },
    userReviewMessage: {
        type: String,
        default: ''
    },
    completedUsers: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }],
    isSurvey: {
        type: Boolean,
        default: false
    },
    surveyEstimatedMinutes: {
        type: Number,
        default: 5
    },
    surveyQuestionsCount: {
        type: Number,
        default: 0
    },
    surveyConfig: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    surveyVersion: {
        type: Number,
        default: 1
    },
    recompletionPolicy: {
        policy: {
            type: String,
            enum: ['never', 'on_version_change', 'every_x_days'],
            default: 'never'
        },
        intervalDays: {
            type: Number,
            default: 30
        }
    },
    isAdminResearchSurvey: {
        type: Boolean,
        default: false
    },
    isMandatoryForAllUsers: {
        type: Boolean,
        default: false
    },
    requirementMode: {
        type: String,
        enum: ['optional', 'mandatory_all', 'mandatory_targeted', 'mandatory_before_withdrawal'],
        default: 'optional'
    },
    mandatoryDisplayBehavior: {
        type: String,
        enum: ['popup_only', 'highlighted_only', 'both'],
        default: 'popup_only'
    },
    sourceAdminSurveyTemplateId: {
        type: mongoose.Schema.ObjectId,
        ref: 'AdminSurveyTemplate',
        default: null
    },
    targeting: {
        countries: {
            type: [String],
            default: []
        },
        currencies: {
            type: [String],
            default: []
        },
        genders: {
            type: [String],
            default: []
        },
        minAge: {
            type: Number,
            default: null
        },
        maxAge: {
            type: Number,
            default: null
        },
        selectedUserIds: {
            type: [String],
            default: []
        },
        accountStatus: {
            type: String,
            enum: ['any', 'active', 'inactive'],
            default: 'any'
        },
        completionRules: [{
            taskId: { type: String, required: true },
            completed: { type: Boolean, required: true }
        }],
        profileRules: [{
            fieldKey: { type: String, required: true },
            operator: { type: String, required: true },
            value: { type: mongoose.Schema.Types.Mixed, required: true }
        }],
        surveyAnswerRules: [{
            taskId: { type: String, required: true },
            questionId: { type: String, required: true },
            operator: { type: String, required: true },
            value: { type: mongoose.Schema.Types.Mixed, required: true }
        }]
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

UserTaskSchema.index({ userId: 1, status: 1 });
UserTaskSchema.index({ category: 1, status: 1 });
UserTaskSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('UserTask', UserTaskSchema);
