import axios from 'axios';
import Setting from '../models/Setting.js';
import Template from '../models/Template.js';
import User from '../models/User.js';
import TemplateLog from '../models/TemplateLog.js';
import Notification from '../models/Notification.js';
import { sendEmail, resolveApprovedSender, APPROVED_SENDERS, DEFAULT_SENDER_EMAIL } from '../services/emailService.js';

export { sendEmail, resolveApprovedSender, APPROVED_SENDERS, DEFAULT_SENDER_EMAIL };

/**
 * Universal automated message sender:
 * Routes emails to the centralized EmailService and WhatsApp messages to UltraMsg.
 */
export const sendAutomatedMessage = async ({
    toEmail,
    toPhone,
    subject,
    messageText,
    event = 'automated_message',
    sender = null,
    provider = null,
    userId = null,
    forceEmail = false
}) => {
    try {
        const settings = await Setting.getSettings();
        if (!settings) {
            console.error('Automation: Settings not found.');
            return {
                email: { attempted: false, success: false, error: 'Settings not found' },
                whatsapp: { attempted: false, success: false, error: 'Settings not found' }
            };
        }

        let emailSuccess = false;
        let emailError = null;
        let emailAttempted = false;
        let emailMessageId = null;

        // 1. Email Sending via Central EmailService
        // Allow sending if emailAutomationEnabled is true OR if forceEmail is requested (transactional/reset/verification)
        const isEmailAllowed = settings.emailAutomationEnabled || forceEmail || settings.emailProvider === 'resend';

        if (toEmail && isEmailAllowed) {
            emailAttempted = true;
            try {
                const emailResult = await sendEmail({
                    to: toEmail,
                    subject: subject || 'SmartExn Notification',
                    html: messageText,
                    event,
                    sender,
                    provider,
                    userId
                });

                emailSuccess = emailResult.success;
                emailError = emailResult.error || null;
                emailMessageId = emailResult.messageId || null;
            } catch (emailErr) {
                console.error('Automation: Failed to send email:', emailErr.message);
                emailError = emailErr.message;
            }
        } else if (toEmail && !isEmailAllowed) {
            emailAttempted = false;
            emailError = 'Email automation is currently disabled in settings';
        }

        let waSuccess = false;
        let waError = null;
        let waAttempted = false;

        // 2. WhatsApp Sending via UltraMsg
        if (settings.whatsappAutomationEnabled && toPhone) {
            waAttempted = true;
            try {
                // Format number: remove non-digits, and convert leading 0 to 92 for Pakistan
                let formattedPhone = toPhone.replace(/\D/g, '');
                if (formattedPhone.startsWith('0') && formattedPhone.length === 11) {
                    formattedPhone = '92' + formattedPhone.slice(1);
                }

                const instanceId = settings.whatsappInstanceId || 'instance183081';
                const token = settings.whatsappToken || '1q22bd6hwo7rc2ub';
                const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;

                await axios.post(url, {
                    token,
                    to: formattedPhone,
                    body: messageText
                });
                console.log(`Automation: WhatsApp message successfully sent to ${formattedPhone}`);
                waSuccess = true;
            } catch (waErrorCaptured) {
                const errMsg = waErrorCaptured.response?.data?.error?.message || waErrorCaptured.response?.data?.error || waErrorCaptured.response?.data || waErrorCaptured.message;
                console.error('Automation: Failed to send WhatsApp:', errMsg);
                waError = typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg);

                // Auto-disable WhatsApp automation if instance is stopped or suspended
                if (waError.includes('Stopped') || waError.includes('non-payment') || waError.includes('subscription')) {
                    try {
                        const settingsToUpdate = await Setting.findOne();
                        if (settingsToUpdate && settingsToUpdate.whatsappAutomationEnabled) {
                            settingsToUpdate.whatsappAutomationEnabled = false;
                            await settingsToUpdate.save();
                            console.warn('Automation: Auto-disabled WhatsApp automation because the UltraMsg instance is stopped/suspended due to non-payment.');

                            // Notify the admin(s)
                            const admins = await User.find({ role: 'admin' });
                            for (const admin of admins) {
                                await Notification.create({
                                    userId: admin._id,
                                    subject: '⚠️ WhatsApp Gateway Stopped',
                                    message: 'WhatsApp automation has been automatically disabled because your UltraMsg instance is stopped due to non-payment. Please check your UltraMsg subscription and re-enable WhatsApp automation once active.',
                                    isPopup: true
                                });
                            }
                        }
                    } catch (dbErr) {
                        console.error('Failed to auto-disable WhatsApp settings:', dbErr);
                    }
                }
            }
        }

        return {
            email: { attempted: emailAttempted, success: emailSuccess, error: emailError, messageId: emailMessageId },
            whatsapp: { attempted: waAttempted, success: waSuccess, error: waError }
        };
    } catch (globalError) {
        console.error('Automation error:', globalError);
        return {
            error: globalError.message,
            email: { attempted: false, success: false, error: globalError.message },
            whatsapp: { attempted: false, success: false, error: globalError.message }
        };
    }
};

/**
 * Dispatches template-based notifications to Email or WhatsApp.
 * Uses centralized EmailService for all email types with automatic sender and event mapping.
 */
export const sendTemplateNotification = async ({
    userId,
    templateKey,
    variables,
    sentBy = 'System',
    sender = null,
    provider = null
}) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`sendTemplateNotification: User with ID ${userId} not found`);
            return { success: false, error: `User with ID ${userId} not found` };
        }

        const template = await Template.findOne({ key: templateKey });
        if (!template) {
            console.error(`sendTemplateNotification: Template with key ${templateKey} not found`);
            return { success: false, error: `Template with key ${templateKey} not found` };
        }

        if (!template.isEnabled) {
            console.log(`sendTemplateNotification: Template ${templateKey} is disabled`);
            try {
                await TemplateLog.create({
                    userId: user._id,
                    username: user.username,
                    userEmail: user.email,
                    userPhone: user.phone || user.whatsapp,
                    templateKey: template.key,
                    templateName: template.name,
                    type: template.type,
                    recipient: template.type === 'email' ? user.email : (user.whatsapp || user.phone || 'N/A'),
                    subject: template.subject,
                    body: template.body,
                    status: 'Failed',
                    error: 'Template is disabled by Admin',
                    sentBy
                });
            } catch (logErr) {
                console.error('Failed to create disabled TemplateLog:', logErr);
            }
            return { success: false, error: 'Template is disabled by Admin' };
        }

        // Variable substitution helper
        const replaceVariables = (text) => {
            if (!text) return '';
            let result = text;
            const allVars = {
                username: user.username || '',
                fullName: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
                whatsapp: user.whatsapp || '',
                date: new Date().toLocaleString(),
                ...variables
            };

            for (const [key, val] of Object.entries(allVars)) {
                const regex = new RegExp(`{${key}}`, 'g');
                result = result.replace(regex, String(val));
            }
            return result;
        };

        const replacedSubject = replaceVariables(template.subject);
        const replacedBody = replaceVariables(template.body);

        let recipient = '';
        let sendResult = null;

        if (template.type === 'email') {
            recipient = user.email || 'N/A';
            sendResult = await sendEmail({
                to: user.email,
                subject: replacedSubject || 'Notification from SmartExn',
                html: replacedBody,
                event: template.key,
                sender,
                provider,
                userId: user._id,
                templateKey: template.key,
                templateName: template.name,
                sentBy
            });

            return sendResult;
        } else if (template.type === 'whatsapp') {
            recipient = user.whatsapp || user.phone || 'N/A';
            const waRes = await sendAutomatedMessage({
                toPhone: recipient,
                messageText: replacedBody
            });

            const status = waRes.whatsapp?.success ? 'Success' : 'Failed';
            const error = waRes.whatsapp?.error || null;

            try {
                await TemplateLog.create({
                    userId: user._id,
                    username: user.username,
                    userEmail: user.email,
                    userPhone: user.phone || user.whatsapp,
                    templateKey: template.key,
                    templateName: template.name,
                    type: 'whatsapp',
                    recipient,
                    body: replacedBody,
                    status,
                    error,
                    sentBy
                });
            } catch (logErr) {
                console.error('Failed to create TemplateLog for WhatsApp:', logErr);
            }

            return {
                success: status === 'Success',
                error
            };
        }
    } catch (err) {
        console.error('Failed to send template notification:', err);
        return { success: false, error: err.message };
    }
};
