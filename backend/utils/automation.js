import nodemailer from 'nodemailer';
import axios from 'axios';
import Setting from '../models/Setting.js';
import Template from '../models/Template.js';
import User from '../models/User.js';
import TemplateLog from '../models/TemplateLog.js';

const generateEmailHtml = (subject, messageText) => {
    // If it already looks like full HTML, just return it
    if (messageText.includes('<html') || messageText.includes('<!DOCTYPE') || (messageText.includes('<div') && messageText.includes('style='))) {
        return messageText;
    }

    // Convert raw message text to formatted HTML
    let formattedBody = messageText;
    
    // Check if it already has basic HTML like <p> or <br>, if not convert \n to <br />
    if (!/<[a-z][\s\S]*>/i.test(messageText)) {
        // Plain text
        formattedBody = formattedBody.replace(/\n/g, '<br />');
        
        // Find URLs and convert them into beautiful buttons + plain link fallback
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formattedBody = formattedBody.replace(urlRegex, (url) => {
            let cleanUrl = url;
            let suffix = '';
            if (/[.,;:!?]$/.test(url)) {
                cleanUrl = url.slice(0, -1);
                suffix = url.slice(-1);
            }
            return `<div style="text-align: center; margin: 24px 0;">
                <a href="${cleanUrl}" target="_blank" style="background-color: #000000; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 500; display: inline-block; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">Reset Password</a>
            </div>
            <div style="font-size: 12px; color: #777777; text-align: center; word-break: break-all; margin-top: 8px;">
                Link: <a href="${cleanUrl}" style="color: #000000; text-decoration: underline;">${cleanUrl}</a>
            </div>` + suffix;
        });
    }

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject || 'Notification'}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
    <div style="width: 100%; background-color: #f4f5f7; padding: 40px 20px; box-sizing: border-box;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
            <div style="background-color: #1a1a1a; color: #ffffff; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">SmartEarning</h1>
            </div>
            <div style="padding: 32px; line-height: 1.6; font-size: 15px;">
                ${formattedBody}
            </div>
            <div style="background-color: #fafafa; border-top: 1px solid #edf2f7; padding: 20px; text-align: center; font-size: 12px; color: #888888;">
                <p style="margin: 0 0 8px 0;">This is an automated notification from SmartEarning system.</p>
                <p style="margin: 0;">If you have any questions, please contact <a href="mailto:support@smartexn.com" style="color: #555555; text-decoration: underline;">support@smartexn.com</a>.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
};

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
                // Safely determine auth credentials. If sender address is custom but password remains the default,
                // we fall back to studio56.pk@gmail.com with its matching default app password.
                const authUser = settings.emailSenderAddress && settings.emailSenderPassword && settings.emailSenderPassword !== 'zakr ambh tnsp mrzf'
                    ? settings.emailSenderAddress
                    : 'studio56.pk@gmail.com';
                
                const authPass = settings.emailSenderAddress && settings.emailSenderPassword && settings.emailSenderPassword !== 'zakr ambh tnsp mrzf'
                    ? settings.emailSenderPassword
                    : 'zakr ambh tnsp mrzf';

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: authUser,
                        pass: authPass
                    }
                });

                const mailOptions = {
                    from: `"SmartEarning Support" <${authUser}>`,
                    replyTo: settings.emailSenderAddress || authUser,
                    to: toEmail,
                    subject: subject || 'SmartEarning Notification',
                    text: messageText.replace(/<[^>]*>/g, ''), // Strip tags for text fallback
                    html: generateEmailHtml(subject, messageText)
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
