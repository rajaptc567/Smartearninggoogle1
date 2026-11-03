import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

const ProviderPlacementSchema = new mongoose.Schema({
    providerKey: {
        type: String,
        required: [true, 'Provider key is required'],
        trim: true,
        lowercase: true,
        index: true
    },
    placementEnabled: {
        type: Boolean,
        default: false // CRITICAL: Must default to false. Never created ON automatically.
    },
    parentTabId: {
        type: String,
        required: [true, 'Parent tab ID is required'],
        trim: true,
        index: true
    },
    subTabId: {
        type: String,
        default: '',
        trim: true,
        index: true
    },
    launchDisplayMode: {
        type: String,
        enum: ['inline', 'modal'],
        default: 'modal'
    },
    displayName: {
        type: String,
        required: [true, 'Display name is required'],
        trim: true
    },
    descriptionOverride: {
        type: String,
        default: '',
        trim: true
    },
    badgeOverride: {
        type: String,
        default: '',
        trim: true
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    targetingMode: {
        type: String,
        enum: ['all', 'selected_users', 'test_users'],
        default: 'all'
    },
    selectedUserIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    testUserIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    allowedCountries: [{
        type: String,
        trim: true,
        uppercase: true
    }],
    excludedCountries: [{
        type: String,
        trim: true,
        uppercase: true
    }],
    offerwallVisibility: {
        type: Boolean,
        default: false
    },
    availableTasksVisibility: {
        type: Boolean,
        default: false
    },
    rolloutPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    rolloutSalt: {
        type: String,
        default: () => randomBytes(8).toString('hex')
    },
    trustedLaunchDomains: [{
        type: String,
        trim: true,
        lowercase: true
    }]
}, {
    timestamps: true
});

// Compound unique index ensuring safe multi-placement per provider across different tab/sub-tab locations
ProviderPlacementSchema.index({ providerKey: 1, parentTabId: 1, subTabId: 1 }, { unique: true });

export default mongoose.model('ProviderPlacement', ProviderPlacementSchema);
