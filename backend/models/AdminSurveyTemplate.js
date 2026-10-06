import mongoose from 'mongoose';

const AdminSurveyTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a template name'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    category: {
        type: String,
        default: 'General Opinion Poll',
        trim: true
    },
    version: {
        type: Number,
        default: 1
    },
    enabled: {
        type: Boolean,
        default: true
    },
    estimatedTimeMinutes: {
        type: Number,
        default: 5
    },
    rewardConfig: {
        mode: {
            type: String,
            enum: ['no_reward', 'fixed', 'custom'],
            default: 'no_reward'
        },
        amount: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        }
    },
    requirementConfig: {
        mode: {
            type: String,
            enum: ['optional', 'mandatory_all', 'mandatory_before_withdrawal'],
            default: 'optional'
        }
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
    surveyConfig: {
        title: { type: String },
        description: { type: String },
        category: { type: String },
        version: { type: Number, default: 1 },
        estimatedTimeMinutes: { type: Number, default: 5 },
        questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
        sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
        consentRequired: { type: Boolean, default: false },
        consentText: { type: String, default: '' },
        qualityRules: { type: mongoose.Schema.Types.Mixed, default: {} },
        approvalMode: { type: String, default: 'auto' },
        globalLogicRules: { type: [mongoose.Schema.Types.Mixed], default: [] }
    },
    isMasterDefault: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

AdminSurveyTemplateSchema.index({ enabled: 1, createdAt: -1 });
AdminSurveyTemplateSchema.index({ name: 1 });

export default mongoose.model('AdminSurveyTemplate', AdminSurveyTemplateSchema);
