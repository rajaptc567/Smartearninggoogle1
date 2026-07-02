import nodemailer from 'nodemailer';
import axios from 'axios';
import Setting from '../models/Setting.js';
import Template from '../models/Template.js';
import User from '../models/User.js';
import TemplateLog from '../models/TemplateLog.js';

export const sendAutomatedMessage = async ({ toEmail, toPhone, subject, messageText }) => {
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

        // 1. Email Sending
        if (settings.emailAutomationEnabled && toEmail) {
            emailAttempted = true;
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: settings.emailSenderAddress || 'studio56.pk@gmail.com',
                        pass: settings.emailSenderPassword || 'zakr ambh tnsp mrzf'
                    }
                });

                const mailOptions = {
                    from: `"SmartEarning Support" <${settings.emailSenderAddress || 'studio56.pk@gmail.com'}>`,
                    to: toEmail,
                    subject: subject || 'SmartEarning Notification',
                    text: messageText.replace(/<[^>]*>/g, ''), // Strip tags for text fallback
                    html: messageText
                };

                await transporter.sendMail(mailOptions);
                console.log(`Automation: Email successfully sent to ${toEmail}`);
                emailSuccess = true;
            } catch (emailErrorCaptured) {
                console.error('Automation: Failed to send email:', emailErrorCaptured.message);
                emailError = emailErrorCaptured.message;
            }
        }

        let waSuccess = false;
        let waError = null;
        let waAttempted = false;

        // 2. WhatsApp Sending
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

                // Ultramsg uses urlencoded body or json
                await axios.post(url, {
                    token,
                    to: formattedPhone,
                    body: messageText
                });
                console.log(`Automation: WhatsApp message successfully sent to ${formattedPhone}`);
                waSuccess = true;
            } catch (waErrorCaptured) {
                const errMsg = waErrorCaptured.response?.data?.error?.message || waErrorCaptured.response?.data || waErrorCaptured.message;
                console.error('Automation: Failed to send WhatsApp:', errMsg);
                waError = typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg);
            }
        }

        return {
            email: { attempted: emailAttempted, success: emailSuccess, error: emailError },
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

export const sendTemplateNotification = async ({ userId, templateKey, variables, sentBy = 'System' }) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`sendTemplateNotification: User with ID ${userId} not found`);
            return;
        }

        const template = await Template.findOne({ key: templateKey });
        if (!template) {
            console.error(`sendTemplateNotification: Template with key ${templateKey} not found`);
            return;
        }

        if (!template.isEnabled) {
            console.log(`sendTemplateNotification: Template ${templateKey} is disabled`);
            // Log that the sending was skipped because template is disabled
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
            return;
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
        let status = 'Success';
        let error = null;

        if (template.type === 'email') {
            recipient = user.email || 'N/A';
            sendResult = await sendAutomatedMessage({
                toEmail: user.email,
                subject: replacedSubject || 'Notification from SmartEarning',
                messageText: replacedBody
            });
            if (sendResult.email) {
                if (sendResult.email.attempted) {
                    if (!sendResult.email.success) {
                        status = 'Failed';
                        error = sendResult.email.error || 'Failed to send email';
                    }
                } else {
                    status = 'Failed';
                    error = 'Email automation is disabled in settings';
                }
            } else {
                status = 'Failed';
                error = sendResult.error || 'Unknown email sending error';
            }
        } else if (template.type === 'whatsapp') {
            recipient = user.whatsapp || user.phone || 'N/A';
            sendResult = await sendAutomatedMessage({
                toPhone: recipient,
                messageText: replacedBody
            });
            if (sendResult.whatsapp) {
                if (sendResult.whatsapp.attempted) {
                    if (!sendResult.whatsapp.success) {
                        status = 'Failed';
                        error = sendResult.whatsapp.error || 'Failed to send WhatsApp';
                    }
                } else {
                    status = 'Failed';
                    error = 'WhatsApp automation is disabled in settings';
                }
            } else {
                status = 'Failed';
                error = sendResult.error || 'Unknown WhatsApp sending error';
            }
        }

        // Create log entry
        try {
            await TemplateLog.create({
                userId: user._id,
                username: user.username,
                userEmail: user.email,
                userPhone: user.phone || user.whatsapp,
                templateKey: template.key,
                templateName: template.name,
                type: template.type,
                recipient,
                subject: template.type === 'email' ? (replacedSubject || 'No Subject') : undefined,
                body: replacedBody,
                status,
                error,
                sentBy
            });
        } catch (logErr) {
            console.error('Failed to create TemplateLog:', logErr);
        }
    } catch (err) {
        console.error('Failed to send template notification:', err);
    }
};
