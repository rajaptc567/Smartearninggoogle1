import Template from '../models/Template.js';
import TemplateLog from '../models/TemplateLog.js';
import User from '../models/User.js';
import { sendTemplateNotification, sendAutomatedMessage } from '../utils/automation.js';

// @desc    Get all message templates (seeds if empty)
// @route   GET /api/v1/templates
export const getTemplates = async (req, res) => {
    try {
        const templates = await Template.getTemplates();
        res.status(200).json({ success: true, count: templates.length, data: templates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Bulk update message templates
// @route   PUT /api/v1/templates/bulk
export const bulkUpdateTemplates = async (req, res) => {
    try {
        const { keys, isEnabled } = req.body;
        if (!Array.isArray(keys) || keys.length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide an array of template keys' });
        }
        if (typeof isEnabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Please provide a boolean value for isEnabled' });
        }
        
        await Template.updateMany(
            { key: { $in: keys } },
            { $set: { isEnabled } }
        );
        
        const templates = await Template.getTemplates();
        res.status(200).json({ success: true, message: `Successfully updated ${keys.length} templates`, data: templates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update a specific message template
// @route   PUT /api/v1/templates/:key
export const updateTemplate = async (req, res) => {
    try {
        const { subject, body, isEnabled, graphicTheme } = req.body;
        const template = await Template.findOneAndUpdate(
            { key: req.params.key },
            { subject, body, isEnabled, graphicTheme },
            { new: true, runValidators: true }
        );
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.status(200).json({ success: true, data: template });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Reset all templates to system defaults
// @route   POST /api/v1/templates/reset
export const resetTemplates = async (req, res) => {
    try {
        await Template.deleteMany({});
        const templates = await Template.getTemplates();
        res.status(200).json({ success: true, message: 'All templates reset to defaults successfully', data: templates });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get sent template history logs
// @route   GET /api/v1/templates/history
export const getTemplatesHistory = async (req, res) => {
    try {
        const logs = await TemplateLog.find().sort({ date: -1 });
        res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Bulk delete sent template history logs
// @route   POST /api/v1/templates/history/bulk-delete
export const deleteTemplatesHistoryBulk = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide an array of log IDs to delete' });
        }
        await TemplateLog.deleteMany({ _id: { $in: ids } });
        res.status(200).json({ success: true, message: `Successfully deleted ${ids.length} history log(s)` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Manually send a template to bulk users
// @route   POST /api/v1/templates/manual-send
export const manualSendTemplate = async (req, res) => {
    try {
        const { userIds, templateKey, variables } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide an array of user IDs' });
        }
        if (!templateKey) {
            return res.status(400).json({ success: false, error: 'Please provide a template key' });
        }

        // Verify template exists
        const template = await Template.findOne({ key: templateKey });
        if (!template) {
            return res.status(404).json({ success: false, error: `Template with key '${templateKey}' not found` });
        }

        // Send to each user in a robust sequence/concurrent execution
        const sendPromises = userIds.map(userId => 
            sendTemplateNotification({ 
                userId, 
                templateKey, 
                variables: variables || {}, 
                sentBy: 'Admin' 
            })
        );
        await Promise.all(sendPromises);

        res.status(200).json({ success: true, message: `Successfully triggered sending template to ${userIds.length} user(s)` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Resend a template log entry
// @route   POST /api/v1/templates/history/:id/resend
export const resendTemplateLog = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await TemplateLog.findById(id);
        if (!log) {
            return res.status(404).json({ success: false, error: 'Template log not found' });
        }

        if (log.userId && log.templateKey) {
            await sendTemplateNotification({
                userId: log.userId,
                templateKey: log.templateKey,
                variables: {},
                sentBy: 'Admin'
            });
        } else {
            let sentSuccess = false;
            let errorMsg = null;
            if (log.type === 'email') {
                const resEmail = await sendAutomatedMessage({
                    toEmail: log.recipient,
                    subject: log.subject || 'Notification from SmartEarning',
                    messageText: log.body
                });
                sentSuccess = resEmail.email?.success || false;
                errorMsg = resEmail.email?.error || resEmail.error || null;
            } else {
                const resWa = await sendAutomatedMessage({
                    toPhone: log.recipient,
                    messageText: log.body
                });
                sentSuccess = resWa.whatsapp?.success || false;
                errorMsg = resWa.whatsapp?.error || resWa.error || null;
            }

            await TemplateLog.create({
                userId: log.userId,
                username: log.username || 'AdminResend',
                userEmail: log.userEmail,
                userPhone: log.userPhone,
                templateKey: log.templateKey || 'resend_custom',
                templateName: log.templateName || 'Resent Message',
                type: log.type,
                recipient: log.recipient,
                subject: log.subject,
                body: log.body,
                status: sentSuccess ? 'Success' : 'Failed',
                error: errorMsg,
                sentBy: 'Admin'
            });
        }

        const logs = await TemplateLog.find().sort({ date: -1 });
        res.status(200).json({ success: true, message: 'Resend triggered successfully', data: logs });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

