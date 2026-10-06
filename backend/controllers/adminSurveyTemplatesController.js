import AdminSurveyTemplate from '../models/AdminSurveyTemplate.js';
import { MASTER_MEMBER_SURVEY_TEMPLATE } from '../data/defaultAdminSurveyTemplates.js';

/**
 * Seed master template if collection is empty or missing master default
 */
const seedMasterTemplateIfEmpty = async (userId) => {
    try {
        const count = await AdminSurveyTemplate.countDocuments();
        if (count === 0) {
            const masterDoc = {
                ...MASTER_MEMBER_SURVEY_TEMPLATE,
                isMasterDefault: true,
                createdBy: userId || null
            };
            await AdminSurveyTemplate.create(masterDoc);
            console.log('[ADMIN SURVEY TEMPLATES] Default Master Member Survey Template seeded successfully.');
        }
    } catch (err) {
        console.error('[ADMIN SURVEY TEMPLATES] Failed to seed master template:', err.message);
    }
};

/**
 * @desc    Get all admin survey templates
 * @route   GET /api/v1/admin-survey-templates
 * @access  Private (Admin / Super Admin)
 */
export const getAdminSurveyTemplates = async (req, res) => {
    try {
        await seedMasterTemplateIfEmpty(req.user?.id);

        const filter = {};
        if (req.query.enabled !== undefined) {
            filter.enabled = req.query.enabled === 'true';
        }
        if (req.query.category) {
            filter.category = req.query.category;
        }

        const templates = await AdminSurveyTemplate.find(filter)
            .sort({ isMasterDefault: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: templates.length,
            data: templates
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to fetch admin survey templates'
        });
    }
};

/**
 * @desc    Get single admin survey template by ID
 * @route   GET /api/v1/admin-survey-templates/:id
 * @access  Private (Admin / Super Admin)
 */
export const getAdminSurveyTemplate = async (req, res) => {
    try {
        const template = await AdminSurveyTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Admin survey template not found'
            });
        }

        res.status(200).json({
            success: true,
            data: template
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to fetch template'
        });
    }
};

/**
 * @desc    Create new admin survey template
 * @route   POST /api/v1/admin-survey-templates
 * @access  Private (Admin / Super Admin)
 */
export const createAdminSurveyTemplate = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            version,
            enabled,
            estimatedTimeMinutes,
            rewardConfig,
            requirementConfig,
            recompletionPolicy,
            surveyConfig
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Template name is required'
            });
        }

        if (!surveyConfig || !Array.isArray(surveyConfig.questions) || surveyConfig.questions.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Survey configuration must include at least one question'
            });
        }

        // Default reward mode is 'no_reward' per requirement
        const safeRewardConfig = {
            mode: rewardConfig?.mode || 'no_reward',
            amount: Number(rewardConfig?.amount) >= 0 ? Number(rewardConfig.amount) : 0,
            currency: rewardConfig?.currency || 'USD'
        };

        // Default requirement mode is 'optional' per requirement
        const safeRequirementConfig = {
            mode: requirementConfig?.mode || 'optional'
        };

        // Default recompletion policy is 'never'
        const safeRecompletionPolicy = {
            policy: recompletionPolicy?.policy || 'never',
            intervalDays: Number(recompletionPolicy?.intervalDays) > 0 ? Number(recompletionPolicy.intervalDays) : 30
        };

        const newTemplate = await AdminSurveyTemplate.create({
            name: name.trim(),
            description: description?.trim() || '',
            category: category?.trim() || 'General Opinion Poll',
            version: Number(version) || 1,
            enabled: enabled !== false,
            estimatedTimeMinutes: Number(estimatedTimeMinutes) || 5,
            rewardConfig: safeRewardConfig,
            requirementConfig: safeRequirementConfig,
            recompletionPolicy: safeRecompletionPolicy,
            surveyConfig: {
                title: surveyConfig.title || name.trim(),
                description: surveyConfig.description || description?.trim() || '',
                category: surveyConfig.category || category?.trim() || 'General Opinion Poll',
                version: Number(surveyConfig.version) || Number(version) || 1,
                estimatedTimeMinutes: Number(surveyConfig.estimatedTimeMinutes) || Number(estimatedTimeMinutes) || 5,
                questions: surveyConfig.questions || [],
                sections: surveyConfig.sections || [],
                consentRequired: Boolean(surveyConfig.consentRequired),
                consentText: surveyConfig.consentText || '',
                qualityRules: surveyConfig.qualityRules || {},
                approvalMode: surveyConfig.approvalMode || 'auto',
                globalLogicRules: surveyConfig.globalLogicRules || []
            },
            isMasterDefault: false,
            createdBy: req.user?.id || null
        });

        res.status(201).json({
            success: true,
            data: newTemplate
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message || 'Failed to create template'
        });
    }
};

/**
 * @desc    Update admin survey template
 * @route   PUT /api/v1/admin-survey-templates/:id
 * @access  Private (Admin / Super Admin)
 */
export const updateAdminSurveyTemplate = async (req, res) => {
    try {
        const template = await AdminSurveyTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        const {
            name,
            description,
            category,
            version,
            enabled,
            estimatedTimeMinutes,
            rewardConfig,
            requirementConfig,
            recompletionPolicy,
            surveyConfig
        } = req.body;

        if (name !== undefined) template.name = name.trim();
        if (description !== undefined) template.description = description.trim();
        if (category !== undefined) template.category = category.trim();
        if (version !== undefined) template.version = Number(version) || template.version;
        if (enabled !== undefined) template.enabled = Boolean(enabled);
        if (estimatedTimeMinutes !== undefined) template.estimatedTimeMinutes = Number(estimatedTimeMinutes) || template.estimatedTimeMinutes;

        if (rewardConfig) {
            template.rewardConfig = {
                mode: rewardConfig.mode || template.rewardConfig?.mode || 'no_reward',
                amount: Number(rewardConfig.amount) >= 0 ? Number(rewardConfig.amount) : 0,
                currency: rewardConfig.currency || template.rewardConfig?.currency || 'USD'
            };
        }

        if (requirementConfig) {
            template.requirementConfig = {
                mode: requirementConfig.mode || template.requirementConfig?.mode || 'optional'
            };
        }

        if (recompletionPolicy) {
            template.recompletionPolicy = {
                policy: recompletionPolicy.policy || template.recompletionPolicy?.policy || 'never',
                intervalDays: Number(recompletionPolicy.intervalDays) > 0 ? Number(recompletionPolicy.intervalDays) : 30
            };
        }

        if (surveyConfig) {
            template.surveyConfig = {
                ...template.surveyConfig,
                ...surveyConfig,
                title: surveyConfig.title || template.name,
                questions: Array.isArray(surveyConfig.questions) ? surveyConfig.questions : template.surveyConfig.questions,
                sections: Array.isArray(surveyConfig.sections) ? surveyConfig.sections : template.surveyConfig.sections
            };
        }

        const updated = await template.save();

        res.status(200).json({
            success: true,
            data: updated
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message || 'Failed to update template'
        });
    }
};

/**
 * @desc    Toggle template enabled status
 * @route   PATCH /api/v1/admin-survey-templates/:id/toggle-enabled
 * @access  Private (Admin / Super Admin)
 */
export const toggleAdminSurveyTemplateEnabled = async (req, res) => {
    try {
        const template = await AdminSurveyTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        template.enabled = !template.enabled;
        await template.save();

        res.status(200).json({
            success: true,
            data: template
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to toggle template status'
        });
    }
};

/**
 * @desc    Duplicate admin survey template
 * @route   POST /api/v1/admin-survey-templates/:id/duplicate
 * @access  Private (Admin / Super Admin)
 */
export const duplicateAdminSurveyTemplate = async (req, res) => {
    try {
        const original = await AdminSurveyTemplate.findById(req.params.id);
        if (!original) {
            return res.status(404).json({
                success: false,
                error: 'Template to duplicate was not found'
            });
        }

        const duplicateData = original.toObject();
        delete duplicateData._id;
        delete duplicateData.createdAt;
        delete duplicateData.updatedAt;

        duplicateData.name = `${original.name} (Copy)`;
        duplicateData.isMasterDefault = false;
        duplicateData.createdBy = req.user?.id || null;

        const duplicated = await AdminSurveyTemplate.create(duplicateData);

        res.status(201).json({
            success: true,
            data: duplicated
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to duplicate template'
        });
    }
};

/**
 * @desc    Delete admin survey template
 * @route   DELETE /api/v1/admin-survey-templates/:id
 * @access  Private (Admin / Super Admin)
 */
export const deleteAdminSurveyTemplate = async (req, res) => {
    try {
        const template = await AdminSurveyTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }

        // Prevent accidental deletion of the master default template
        if (template.isMasterDefault && req.query.force !== 'true') {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete the master default survey template. You can disable it instead.'
            });
        }

        await AdminSurveyTemplate.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            data: {},
            message: 'Template deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to delete template'
        });
    }
};

/**
 * @desc    Reset master template to official default configuration
 * @route   POST /api/v1/admin-survey-templates/reset-defaults
 * @access  Private (Admin / Super Admin)
 */
export const resetDefaultAdminSurveyTemplates = async (req, res) => {
    try {
        // Upsert the authoritative master template
        const updated = await AdminSurveyTemplate.findOneAndUpdate(
            { isMasterDefault: true },
            {
                ...MASTER_MEMBER_SURVEY_TEMPLATE,
                isMasterDefault: true,
                createdBy: req.user?.id || null
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            data: updated,
            message: 'Master Member Survey Template restored to factory default'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to reset master template'
        });
    }
};
