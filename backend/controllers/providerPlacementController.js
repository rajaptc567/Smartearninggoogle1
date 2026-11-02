import mongoose from 'mongoose';
import ProviderPlacement from '../models/ProviderPlacement.js';
import ProviderPlacementAuditLog from '../models/ProviderPlacementAuditLog.js';
import OfferwallProvider from '../models/OfferwallProvider.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import { evaluatePlacementEligibility } from '../utils/providerPlacementEligibility.js';
import { constructTheoremReachEntryUrl, constructCpxEntryUrl } from './postbackController.js';

/**
 * Helper to record audit log entries explicitly for admin mutations
 */
const recordAuditLog = async (placementId, adminUser, action, changes) => {
    try {
        await ProviderPlacementAuditLog.create({
            placementId,
            adminId: adminUser._id || adminUser.id,
            adminUsername: adminUser.username || adminUser.fullName || 'Admin',
            action,
            changes: changes || {}
        });
    } catch (err) {
        console.error('[Placement Audit Log Error]:', err.message);
        throw new Error(`Audit log write failed: ${err.message}`);
    }
};

/**
 * USER ENDPOINT: GET /available/:parentTabId
 * Retrieves placements eligible for the authenticated worker under a specific parent tab.
 */
export const getAvailablePlacements = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const user = await User.findById(req.user.id);
        if (!user || user.status === 'Blocked' || user.restrictions?.loginBlocked) {
            return res.status(403).json({ success: false, error: 'Account restricted or user not found' });
        }
        if (user.restrictions?.earning === true) {
            return res.status(403).json({ success: false, error: 'Account earning features are restricted' });
        }

        const { parentTabId } = req.params;
        if (!parentTabId) {
            return res.status(400).json({ success: false, error: 'Parent tab ID is required' });
        }

        // 1. Verify Parent Tab Enabled in Admin Settings
        const settings = await Setting.getSettings();
        const customTabs = Array.isArray(settings.customEarnTabs) ? settings.customEarnTabs : [];
        const targetMainTab = customTabs.find(t => t.id === parentTabId || (parentTabId === 'other_tasks' && t.id === 'other_tasks'));

        if (!targetMainTab || targetMainTab.enabled === false) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // Check module-page toggle for built-in other_tasks
        if (parentTabId === 'other_tasks') {
            const otherTasksControl = settings.modulePagesConfig?.workAndEarn?.otherTasks;
            if (otherTasksControl && (otherTasksControl.isEnabled === false || otherTasksControl.isHiddenInNav === true)) {
                return res.status(200).json({ success: true, count: 0, data: [] });
            }
        }

        // Build active sub-tabs map
        const activeSubTabs = Array.isArray(targetMainTab.subTabs)
            ? targetMainTab.subTabs.filter(st => st && st.enabled !== false)
            : [];
        const activeSubTabIds = activeSubTabs.map(st => st.id);

        if (activeSubTabIds.length === 0) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // 2. Fetch Placements where placementEnabled = true for this parent tab
        const placements = await ProviderPlacement.find({
            parentTabId,
            placementEnabled: true,
            subTabId: { $in: activeSubTabIds }
        }).lean();

        if (placements.length === 0) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // 3. Fetch Operational State for required providers
        const providerKeys = [...new Set(placements.map(p => p.providerKey))];
        const providers = await OfferwallProvider.find({
            providerKey: { $in: providerKeys },
            enabled: true,
            status: { $nin: ['DISABLED', 'SUSPENDED', 'NOT_STARTED'] }
        }).select('providerKey name category group status enabled badge icon description').lean();

        const providerMap = new Map(providers.map(p => [p.providerKey, p]));

        // 4. Filter Placements by Provider Operational State & Worker Eligibility
        const eligiblePlacements = [];
        for (const placement of placements) {
            const provider = providerMap.get(placement.providerKey);
            if (!provider || provider.enabled !== true) {
                continue;
            }

            // CPX Research special ACTIVE operational status requirement
            if (placement.providerKey === 'cpx_research' && provider.status !== 'ACTIVE') {
                continue;
            }

            // Evaluate worker eligibility (user targeting, country targeting, deterministic rollout)
            const evalResult = evaluatePlacementEligibility(user, placement);
            if (!evalResult.eligible) {
                continue;
            }

            const subTabConfig = activeSubTabs.find(st => st.id === placement.subTabId);

            eligiblePlacements.push({
                _id: placement._id,
                providerKey: placement.providerKey,
                parentTabId: placement.parentTabId,
                subTabId: placement.subTabId,
                subTabName: subTabConfig?.name || placement.subTabId,
                displayName: placement.displayName || provider.name,
                description: placement.descriptionOverride || provider.description || '',
                badge: placement.badgeOverride || provider.badge || subTabConfig?.badge || '',
                icon: provider.icon || '⚡',
                displayOrder: placement.displayOrder || 0,
                providerStatus: provider.status || 'ACTIVE'
            });
        }

        // Sort by displayOrder ascending, then displayName
        eligiblePlacements.sort((a, b) => (a.displayOrder - b.displayOrder) || a.displayName.localeCompare(b.displayName));

        return res.status(200).json({
            success: true,
            count: eligiblePlacements.length,
            data: eligiblePlacements
        });
    } catch (err) {
        console.error('[getAvailablePlacements Error]:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * USER ENDPOINT: POST /:placementId/launch
 * Re-checks worker eligibility & operational provider state, then generates validated provider session URL.
 */
export const launchProviderPlacement = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { placementId } = req.params;
        if (!placementId || !mongoose.isValidObjectId(placementId)) {
            return res.status(400).json({ success: false, error: 'Invalid placement identifier' });
        }

        const user = await User.findById(req.user.id);
        if (!user || user.status === 'Blocked' || user.restrictions?.loginBlocked) {
            return res.status(403).json({ success: false, error: 'Account restricted or user not found' });
        }
        if (user.restrictions?.earning === true) {
            return res.status(403).json({ success: false, error: 'Account earning features are restricted' });
        }

        const placement = await ProviderPlacement.findById(placementId);
        if (!placement || placement.placementEnabled !== true) {
            return res.status(400).json({ success: false, error: 'Placement is currently disabled or unavailable' });
        }

        // 1. Check Settings Tab Availability
        const settings = await Setting.getSettings();
        const customTabs = Array.isArray(settings.customEarnTabs) ? settings.customEarnTabs : [];
        const mainTab = customTabs.find(t => t.id === placement.parentTabId || (placement.parentTabId === 'other_tasks' && t.id === 'other_tasks'));
        if (!mainTab || mainTab.enabled === false) {
            return res.status(400).json({ success: false, error: 'Parent tab is disabled in system settings' });
        }

        if (placement.parentTabId === 'other_tasks') {
            const otherTasksControl = settings.modulePagesConfig?.workAndEarn?.otherTasks;
            if (otherTasksControl && (otherTasksControl.isEnabled === false || otherTasksControl.isHiddenInNav === true)) {
                return res.status(400).json({ success: false, error: 'Parent page is disabled in system settings' });
            }
        }

        const subTab = Array.isArray(mainTab.subTabs) ? mainTab.subTabs.find(st => st.id === placement.subTabId) : null;
        if (!subTab || subTab.enabled === false) {
            return res.status(400).json({ success: false, error: 'Sub-tab is disabled in system settings' });
        }

        // 2. Re-evaluate Worker Eligibility
        const evalResult = evaluatePlacementEligibility(user, placement);
        if (!evalResult.eligible) {
            return res.status(403).json({
                success: false,
                error: `You are not eligible for this placement (${evalResult.reason})`
            });
        }

        // 3. Verify Operational OfferwallProvider State
        const provider = await OfferwallProvider.findOne({ providerKey: placement.providerKey });
        if (!provider || provider.enabled !== true) {
            return res.status(400).json({ success: false, error: 'Offerwall provider is operationally disabled' });
        }

        if (['DISABLED', 'SUSPENDED', 'NOT_STARTED'].includes(provider.status)) {
            return res.status(400).json({ success: false, error: `Provider is currently unavailable (Status: ${provider.status})` });
        }

        if (placement.providerKey === 'cpx_research' && provider.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: 'CPX Research requires active provider verification' });
        }

        // 4. Generate Validated Provider Session
        let launchUrl = '';

        // Verification Checks (Email / WhatsApp)
        if (settings.emailVerificationRequired === true && !user.emailVerified) {
            return res.status(403).json({ success: false, error: 'Email verification is required to launch this provider' });
        }
        if (settings.whatsappVerificationRequired === true && !user.whatsappVerified) {
            return res.status(403).json({ success: false, error: 'WhatsApp verification is required to launch this provider' });
        }

        if (placement.providerKey === 'theoremreach') {
            const trResult = constructTheoremReachEntryUrl(provider, user._id.toString());
            if (trResult.url) {
                launchUrl = trResult.url;
            } else {
                return res.status(400).json({ success: false, error: trResult.error || 'TheoremReach configuration incomplete' });
            }
        } else if (placement.providerKey === 'cpx_research') {
            const cpxResult = constructCpxEntryUrl(provider, user._id.toString());
            if (cpxResult.url) {
                launchUrl = cpxResult.url;
            } else {
                return res.status(400).json({ success: false, error: cpxResult.error || 'CPX Research configuration incomplete' });
            }
        } else if (placement.providerKey === 'torox') {
            // Torox fails closed in the new placement system until secure reuse of existing session flow is implemented.
            return res.status(403).json({ 
                success: false, 
                error: 'Torox launch is currently restricted for this placement. Please use the main Offerwall page.' 
            });
        } else {
            // Generic provider URL construction
            if (!provider.iframeUrlTemplate) {
                return res.status(400).json({ success: false, error: 'Provider URL template is missing' });
            }
            if (!provider.appId || !provider.appId.trim()) {
                return res.status(400).json({ success: false, error: 'Provider App ID / Placement ID is not configured' });
            }
            launchUrl = provider.iframeUrlTemplate
                .replace(/\{userId\}/g, user._id.toString())
                .replace(/\{appId\}/g, provider.appId.trim())
                .replace(/\{subId\}/g, user._id.toString());
        }

        if (!launchUrl) {
            return res.status(400).json({ success: false, error: 'Failed to construct provider launch URL' });
        }

        // Strict URL Validation: Must be HTTPS, no embedded credentials, and from a trusted provider domain
        try {
            const parsedUrl = new URL(launchUrl);
            if (parsedUrl.protocol !== 'https:') {
                return res.status(403).json({ success: false, error: 'Insecure launch URL rejected. HTTPS is mandatory.' });
            }

            // Reject URLs with embedded credentials (security risk)
            if (parsedUrl.username || parsedUrl.password) {
                return res.status(403).json({ success: false, error: 'Launch URL with embedded credentials rejected for security.' });
            }

            const trustedHosts = [
                'offers.cpx-research.com',
                'cpx-research.com',
                'theoremreach.com',
                'wannads.com',
                'monlix.com',
                'lootably.com',
                'bitlabs.ai',
                'revlum.com'
            ];

            const host = parsedUrl.hostname.toLowerCase();
            const isTrusted = trustedHosts.some(trusted => host === trusted || host.endsWith('.' + trusted));
            
            if (!isTrusted) {
                return res.status(403).json({ 
                    success: false, 
                    error: `Untrusted provider domain (${host}) rejected for dynamic placement launch.` 
                });
            }
        } catch (err) {
            return res.status(400).json({ success: false, error: 'Malformed launch URL detected' });
        }

        return res.status(200).json({
            success: true,
            launchUrl,
            displayName: placement.displayName || provider.name,
            providerKey: placement.providerKey
        });
    } catch (err) {
        console.error('[launchProviderPlacement Error]:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: GET /admin
 * Returns all placements populated with safe provider info.
 */
export const getAllAdminPlacements = async (req, res) => {
    try {
        const placements = await ProviderPlacement.find()
            .populate('selectedUserIds', 'username fullName email')
            .populate('testUserIds', 'username fullName email')
            .sort({ parentTabId: 1, subTabId: 1, displayOrder: 1 })
            .lean();

        const providerKeys = [...new Set(placements.map(p => p.providerKey))];
        const providers = await OfferwallProvider.find({ providerKey: { $in: providerKeys } })
            .select('providerKey name category group status enabled icon badge description')
            .lean();

        const providerMap = new Map(providers.map(p => [p.providerKey, p]));

        const safePlacements = placements.map(p => ({
            ...p,
            providerInfo: providerMap.get(p.providerKey) || null
        }));

        return res.status(200).json({ success: true, count: safePlacements.length, data: safePlacements });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: GET /admin/catalog
 * Returns safe provider catalog (without secrets/credentials).
 */
export const getAdminCatalog = async (req, res) => {
    try {
        const catalog = await OfferwallProvider.find()
            .select('providerKey name category group enabled status approvalStatus integrationStatus icon badge description technicalReadinessScore approvalLikelihoodScore complianceNotes')
            .sort({ group: 1, name: 1 })
            .lean();

        return res.status(200).json({ success: true, count: catalog.length, data: catalog });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: POST /admin
 * Create a new placement record (defaults to placementEnabled: false).
 */
export const createAdminPlacement = async (req, res) => {
    try {
        const {
            providerKey,
            parentTabId,
            subTabId,
            displayName,
            descriptionOverride,
            badgeOverride,
            displayOrder,
            targetingMode,
            selectedUserIds,
            testUserIds,
            allowedCountries,
            excludedCountries,
            rolloutPercentage
        } = req.body;

        if (!providerKey || !parentTabId || !subTabId || !displayName) {
            return res.status(400).json({
                success: false,
                error: 'providerKey, parentTabId, subTabId, and displayName are required fields'
            });
        }

        // Verify provider exists in system
        const providerExists = await OfferwallProvider.exists({ providerKey: String(providerKey).toLowerCase().trim() });
        if (!providerExists) {
            return res.status(400).json({ success: false, error: `Offerwall provider '${providerKey}' does not exist` });
        }

        // Verify parent tab & sub-tab exist in settings
        const settings = await Setting.getSettings();
        const customTabs = Array.isArray(settings.customEarnTabs) ? settings.customEarnTabs : [];
        const mainTab = customTabs.find(t => t.id === parentTabId);
        if (!mainTab) {
            return res.status(400).json({ success: false, error: `Parent tab '${parentTabId}' is not configured in settings` });
        }

        const subTab = Array.isArray(mainTab.subTabs) ? mainTab.subTabs.find(st => st.id === subTabId) : null;
        if (!subTab) {
            return res.status(400).json({ success: false, error: `Sub-tab '${subTabId}' does not exist under parent tab '${parentTabId}'` });
        }

        // Validate rolloutPercentage is finite and within range
        const rolloutNum = Number(rolloutPercentage);
        if (rolloutPercentage !== undefined && (!Number.isFinite(rolloutNum) || rolloutNum < 0 || rolloutNum > 100)) {
            return res.status(400).json({ success: false, error: 'Rollout percentage must be a finite number between 0 and 100' });
        }

        const newPlacementData = {
            providerKey: String(providerKey).toLowerCase().trim(),
            parentTabId: String(parentTabId).trim(),
            subTabId: String(subTabId).trim(),
            displayName: String(displayName).trim(),
            descriptionOverride: descriptionOverride ? String(descriptionOverride).trim() : '',
            badgeOverride: badgeOverride ? String(badgeOverride).trim() : '',
            displayOrder: Number(displayOrder) || 0,
            placementEnabled: false, // CRITICAL DEFAULT: Always default to OFF
            targetingMode: targetingMode || 'all',
            selectedUserIds: Array.isArray(selectedUserIds) ? selectedUserIds.filter(id => mongoose.isValidObjectId(id)) : [],
            testUserIds: Array.isArray(testUserIds) ? testUserIds.filter(id => mongoose.isValidObjectId(id)) : [],
            allowedCountries: Array.isArray(allowedCountries) ? allowedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean) : [],
            excludedCountries: Array.isArray(excludedCountries) ? excludedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean) : [],
            rolloutPercentage: rolloutPercentage !== undefined ? rolloutNum : 100
        };

        const created = await ProviderPlacement.create(newPlacementData);

        // Record Audit Log
        await recordAuditLog(created._id, req.user, 'CREATED', {
            providerKey: created.providerKey,
            location: `${created.parentTabId} / ${created.subTabId}`,
            placementEnabled: created.placementEnabled,
            displayName: created.displayName
        });

        return res.status(201).json({ success: true, data: created });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'A placement for this provider already exists in the selected parent tab and sub-tab location'
            });
        }
        return res.status(400).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: PUT /admin/:placementId
 * Updates existing placement record.
 */
export const updateAdminPlacement = async (req, res) => {
    try {
        const { placementId } = req.params;
        if (!placementId || !mongoose.isValidObjectId(placementId)) {
            return res.status(400).json({ success: false, error: 'Invalid placement identifier' });
        }

        const existing = await ProviderPlacement.findById(placementId);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Placement record not found' });
        }

        const allowedFields = [
            'displayName', 'descriptionOverride', 'badgeOverride', 'displayOrder',
            'placementEnabled', 'targetingMode', 'selectedUserIds', 'testUserIds',
            'allowedCountries', 'excludedCountries', 'rolloutPercentage', 'rolloutSalt'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'rolloutPercentage') {
                    const rolloutNum = Number(req.body.rolloutPercentage);
                    if (!Number.isFinite(rolloutNum) || rolloutNum < 0 || rolloutNum > 100) {
                        return res.status(400).json({ success: false, error: 'Rollout percentage must be a finite number between 0 and 100' });
                    }
                    updates.rolloutPercentage = rolloutNum;
                } else if (field === 'allowedCountries' || field === 'excludedCountries') {
                    updates[field] = Array.isArray(req.body[field])
                        ? req.body[field].map(c => String(c).trim().toUpperCase()).filter(Boolean)
                        : [];
                } else if (field === 'selectedUserIds' || field === 'testUserIds') {
                    updates[field] = Array.isArray(req.body[field])
                        ? req.body[field].filter(id => mongoose.isValidObjectId(id))
                        : [];
                } else {
                    updates[field] = req.body[field];
                }
            }
        }

        const updated = await ProviderPlacement.findByIdAndUpdate(placementId, { $set: updates }, { new: true, runValidators: true });

        const isToggleAction = updates.placementEnabled !== undefined && updates.placementEnabled !== existing.placementEnabled;
        const actionType = isToggleAction ? 'TOGGLED' : 'UPDATED';

        await recordAuditLog(updated._id, req.user, actionType, {
            previousEnabled: existing.placementEnabled,
            newEnabled: updated.placementEnabled,
            updatedFields: Object.keys(updates)
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: DELETE /admin/:placementId
 * Deletes a placement while preserving historical audit log entries.
 */
export const deleteAdminPlacement = async (req, res) => {
    try {
        const { placementId } = req.params;
        if (!placementId || !mongoose.isValidObjectId(placementId)) {
            return res.status(400).json({ success: false, error: 'Invalid placement identifier' });
        }

        const existing = await ProviderPlacement.findById(placementId);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Placement record not found' });
        }

        await recordAuditLog(existing._id, req.user, 'DELETED', {
            deletedPlacement: {
                providerKey: existing.providerKey,
                parentTabId: existing.parentTabId,
                subTabId: existing.subTabId,
                displayName: existing.displayName
            }
        });

        await ProviderPlacement.findByIdAndDelete(placementId);

        return res.status(200).json({ success: true, message: 'Placement deleted successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: POST /admin/:placementId/preview
 * Previews worker eligibility for a selected test user without balance/transaction mutations.
 */
export const previewAdminPlacementEligibility = async (req, res) => {
    try {
        const { placementId } = req.params;
        const { testUserId } = req.body;

        if (!placementId || !mongoose.isValidObjectId(placementId)) {
            return res.status(400).json({ success: false, error: 'Invalid placement identifier' });
        }

        if (!testUserId || !mongoose.isValidObjectId(testUserId)) {
            return res.status(400).json({ success: false, error: 'Valid test user ID is required' });
        }

        const placement = await ProviderPlacement.findById(placementId);
        if (!placement) {
            return res.status(404).json({ success: false, error: 'Placement not found' });
        }

        const user = await User.findById(testUserId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Test user not found' });
        }

        const provider = await OfferwallProvider.findOne({ providerKey: placement.providerKey });

        const eligibility = evaluatePlacementEligibility(user, placement);

        return res.status(200).json({
            success: true,
            preview: {
                placementId: placement._id,
                testUser: {
                    id: user._id,
                    username: user.username,
                    country: user.country || 'Not Set'
                },
                placementEnabled: placement.placementEnabled,
                providerStatus: provider ? provider.status : 'NOT_FOUND',
                providerEnabled: provider ? provider.enabled : false,
                isEligible: eligibility.eligible,
                reason: eligibility.reason
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * ADMIN ENDPOINT: GET /admin/audit
 * Retrieves audit log entries.
 */
export const getAdminAuditLogs = async (req, res) => {
    try {
        const logs = await ProviderPlacementAuditLog.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};
