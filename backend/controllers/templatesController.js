import Template from '../models/Template.js';
import TemplateLog from '../models/TemplateLog.js';
import User from '../models/User.js';
import { sendTemplateNotification, sendAutomatedMessage } from '../utils/automation.js';
import { getAudienceCount, resolveAudienceUsers } from '../services/audienceFilterService.js';
import { sendEmail } from '../services/emailService.js';

// Helper to replace standard SmartExn placeholders in custom subject & body
const replacePlaceholders = (text, user, customVars = {}) => {
    if (!text) return '';
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    
    return String(text)
        .replace(/{username}/g, user.username || 'Member')
        .replace(/{fullName}/g, user.fullName || user.username || 'Valued Member')
        .replace(/{email}/g, user.email || '')
        .replace(/{phone}/g, user.phone || user.whatsapp || '')
        .replace(/{amount}/g, customVars.amount || '0.00')
        .replace(/{currency}/g, customVars.currency || user.currency || 'USD')
        .replace(/{txId}/g, customVars.txId || 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase())
        .replace(/{date}/g, customVars.date || dateFormatted)
        .replace(/{notes}/g, customVars.notes || 'Admin manual message');
};

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

// @desc    Get audience recipient count preview based on advanced filters
// @route   POST /api/v1/templates/audience/count
export const getAudienceEstimate = async (req, res) => {
    try {
        const { filters = {}, options = {} } = req.body;
        const result = await getAudienceCount(filters, options);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Resolve audience user list based on advanced filters
// @route   POST /api/v1/templates/audience/users
export const getAudienceList = async (req, res) => {
    try {
        const { filters = {}, options = {} } = req.body;
        const users = await resolveAudienceUsers(filters, options);
        res.status(200).json({ success: true, count: users.length, users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Manually send a template or custom message to bulk users with advanced audience filtering
// @route   POST /api/v1/templates/manual-send
export const manualSendTemplate = async (req, res) => {
    try {
        let { 
            mode = 'template', // 'template' | 'custom'
            userIds, 
            targetUserIds,
            filters, 
            templateKey, 
            customSubject, 
            customBody, 
            fromSender, 
            customEmail,
            variables = {} 
        } = req.body;

        // Fallbacks for flexible payload formats
        if (!userIds && targetUserIds) {
            userIds = targetUserIds;
        }
        if (customEmail && typeof customEmail === 'object') {
            if (!customSubject && customEmail.subject) customSubject = customEmail.subject;
            if (!customBody && customEmail.body) customBody = customEmail.body;
            if (!fromSender && customEmail.fromSender) fromSender = customEmail.fromSender;
        }

        // Resolve message mode: If mode is 'custom' or if templateKey is absent but custom content is provided
        let channel = (req.body.channel || 'email').toLowerCase();
        const isCustomMode = mode === 'custom' || (!templateKey && Boolean(customBody));

        let template = null;

        if (!isCustomMode) {
            if (!templateKey) {
                return res.status(400).json({ success: false, error: 'Please select a template to send, or switch to Custom Message mode.' });
            }
            template = await Template.findOne({ key: templateKey });
            if (!template) {
                return res.status(404).json({ success: false, error: `Template with key '${templateKey}' not found` });
            }
            channel = template.type === 'whatsapp' ? 'whatsapp' : (req.body.channel || 'email');
        } else {
            if (channel === 'whatsapp') {
                if (!customBody || !String(customBody).trim()) {
                    return res.status(400).json({ success: false, error: 'Please provide WhatsApp message Body content for the custom message.' });
                }
            } else {
                if (!customSubject || !String(customSubject).trim()) {
                    return res.status(400).json({ success: false, error: 'Please provide an email Subject for the custom message.' });
                }
                if (!customBody || !String(customBody).trim()) {
                    return res.status(400).json({ success: false, error: 'Please provide email Body content for the custom message.' });
                }
            }
        }

        // Resolve recipients: either via filters or explicit userIds
        let targetUsers = [];
        if (filters && typeof filters === 'object' && Object.keys(filters).length > 0) {
            // Apply audience filters
            const filterOptions = {
                channel,
                selectedUserIds: Array.isArray(userIds) && userIds.length > 0 ? userIds : undefined
            };
            targetUsers = await resolveAudienceUsers(filters, filterOptions);
        } else if (Array.isArray(userIds) && userIds.length > 0) {
            // Manual selection query ensuring channel requirements
            const query = { _id: { $in: userIds } };
            if (channel === 'email') {
                query.email = { $exists: true, $ne: '', $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i };
            } else if (channel === 'whatsapp') {
                query.$or = [
                    { phone: { $exists: true, $ne: '' } },
                    { whatsapp: { $exists: true, $ne: '' } }
                ];
            }
            targetUsers = await User.find(query).select('username fullName email phone whatsapp currency country status activePlan walletBalance taskWalletBalance').lean();
        } else {
            return res.status(400).json({ success: false, error: 'Please specify target recipients via audience filters or selected user IDs.' });
        }

        if (targetUsers.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: `No eligible recipients found matching the audience criteria for channel '${channel}'.` 
            });
        }

        let successCount = 0;
        let failureCount = 0;

        if (isCustomMode) {
            if (channel === 'whatsapp') {
                // Broadcast custom WhatsApp message
                const sendPromises = targetUsers.map(async (user) => {
                    const recipientPhone = user.phone || user.whatsapp;
                    const replacedBody = replacePlaceholders(customBody, user, variables);
                    // Strip HTML tags for clean WhatsApp text formatting
                    const plainText = replacedBody
                        .replace(/<br\s*[\/]?>/gi, '\n')
                        .replace(/<\/p>/gi, '\n\n')
                        .replace(/<[^>]*>?/gm, '')
                        .trim();

                    try {
                        const result = await sendAutomatedMessage({
                            toPhone: recipientPhone,
                            messageText: plainText,
                            event: 'admin_custom_whatsapp',
                            userId: user._id,
                            sentBy: 'Admin'
                        });

                        const waSuccess = Boolean(result.whatsapp?.success);
                        const waError = result.whatsapp?.error || result.error || null;

                        await TemplateLog.create({
                            userId: user._id,
                            username: user.username,
                            userEmail: user.email,
                            userPhone: recipientPhone,
                            templateKey: 'custom_message',
                            templateName: 'Custom Admin WhatsApp Broadcast',
                            type: 'whatsapp',
                            recipient: recipientPhone,
                            subject: 'Custom WhatsApp Broadcast',
                            body: plainText,
                            status: waSuccess ? 'Success' : 'Failed',
                            provider: 'ultramsg',
                            messageId: null,
                            error: waError,
                            sentBy: 'Admin',
                            variables
                        });

                        if (waSuccess) successCount++;
                        else failureCount++;
                    } catch (sendErr) {
                        failureCount++;
                        await TemplateLog.create({
                            userId: user._id,
                            username: user.username,
                            userEmail: user.email,
                            userPhone: recipientPhone,
                            templateKey: 'custom_message',
                            templateName: 'Custom Admin WhatsApp Broadcast',
                            type: 'whatsapp',
                            recipient: recipientPhone,
                            subject: 'Custom WhatsApp Broadcast',
                            body: plainText,
                            status: 'Failed',
                            provider: 'ultramsg',
                            error: sendErr.message,
                            sentBy: 'Admin',
                            variables
                        }).catch(() => {});
                    }
                });

                await Promise.all(sendPromises);
            } else {
                // Broadcast custom email message
                const sendPromises = targetUsers.map(async (user) => {
                    const replacedSubject = replacePlaceholders(customSubject, user, variables);
                    const replacedBody = replacePlaceholders(customBody, user, variables);
                    const plainText = replacedBody.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

                    try {
                        const result = await sendEmail({
                            to: user.email,
                            subject: replacedSubject,
                            html: replacedBody,
                            text: plainText,
                            event: 'admin_custom_bulk',
                            sender: fromSender || 'notifications',
                            userId: user._id,
                            sentBy: 'Admin',
                            templateName: 'Custom Admin Broadcast'
                        });

                        // Log custom message in TemplateLog for history tracking
                        await TemplateLog.create({
                            userId: user._id,
                            username: user.username,
                            userEmail: user.email,
                            userPhone: user.phone || user.whatsapp,
                            templateKey: 'custom_message',
                            templateName: 'Custom Admin Broadcast',
                            type: 'email',
                            recipient: user.email,
                            subject: replacedSubject,
                            body: replacedBody,
                            status: result.success ? 'Success' : 'Failed',
                            provider: result.provider || 'unknown',
                            messageId: result.messageId || null,
                            error: result.error || null,
                            sentBy: 'Admin',
                            variables
                        });

                        if (result.success) successCount++;
                        else failureCount++;
                    } catch (sendErr) {
                        failureCount++;
                        await TemplateLog.create({
                            userId: user._id,
                            username: user.username,
                            userEmail: user.email,
                            userPhone: user.phone || user.whatsapp,
                            templateKey: 'custom_message',
                            templateName: 'Custom Admin Broadcast',
                            type: 'email',
                            recipient: user.email,
                            subject: replacedSubject,
                            body: replacedBody,
                            status: 'Failed',
                            provider: 'system',
                            error: sendErr.message,
                            sentBy: 'Admin',
                            variables
                        }).catch(() => {});
                    }
                });

                await Promise.all(sendPromises);
            }
        } else {
            // Broadcast template notification
            const sendPromises = targetUsers.map(async (user) => {
                try {
                    const resNotification = await sendTemplateNotification({
                        userId: user._id,
                        templateKey,
                        variables,
                        sentBy: 'Admin'
                    });
                    if (resNotification && resNotification.success !== false) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                } catch (err) {
                    failureCount++;
                }
            });

            await Promise.all(sendPromises);
        }

        res.status(200).json({ 
            success: true, 
            message: `Successfully processed broadcast to ${targetUsers.length} recipient(s) (${successCount} succeeded, ${failureCount} failed).`,
            totalTargeted: targetUsers.length,
            successCount,
            failureCount
        });
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

        if (log.templateKey === 'custom_message') {
            if (log.type === 'whatsapp') {
                const plainText = (log.body || '').replace(/<[^>]*>?/gm, '').trim();
                const recipientPhone = log.recipient || log.userPhone;
                const resWa = await sendAutomatedMessage({
                    toPhone: recipientPhone,
                    messageText: plainText,
                    event: 'admin_custom_whatsapp_resend',
                    userId: log.userId,
                    sentBy: 'Admin'
                });

                const waSuccess = Boolean(resWa.whatsapp?.success);
                const waError = resWa.whatsapp?.error || resWa.error || null;

                await TemplateLog.create({
                    userId: log.userId,
                    username: log.username || 'AdminResend',
                    userEmail: log.userEmail,
                    userPhone: recipientPhone,
                    templateKey: 'custom_message',
                    templateName: 'Custom Admin WhatsApp Broadcast (Resend)',
                    type: 'whatsapp',
                    recipient: recipientPhone,
                    subject: log.subject || 'Custom WhatsApp Broadcast (Resend)',
                    body: plainText,
                    status: waSuccess ? 'Success' : 'Failed',
                    provider: 'ultramsg',
                    error: waError,
                    sentBy: 'Admin'
                });
            } else {
                const plainText = (log.body || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                const resEmail = await sendEmail({
                    to: log.recipient,
                    subject: log.subject || 'Admin Broadcast',
                    html: log.body,
                    text: plainText,
                    event: 'admin_custom_bulk',
                    sender: 'notifications',
                    userId: log.userId,
                    sentBy: 'Admin',
                    templateName: 'Custom Admin Broadcast (Resend)'
                });

                await TemplateLog.create({
                    userId: log.userId,
                    username: log.username || 'AdminResend',
                    userEmail: log.userEmail,
                    userPhone: log.userPhone,
                    templateKey: 'custom_message',
                    templateName: 'Custom Admin Broadcast (Resend)',
                    type: 'email',
                    recipient: log.recipient,
                    subject: log.subject,
                    body: log.body,
                    status: resEmail.success ? 'Success' : 'Failed',
                    provider: resEmail.provider || 'unknown',
                    error: resEmail.error || null,
                    sentBy: 'Admin'
                });
            }
        } else if (log.userId && log.templateKey) {
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

