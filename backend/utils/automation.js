import nodemailer from 'nodemailer';
import axios from 'axios';
import Setting from '../models/Setting.js';
import Template from '../models/Template.js';
import User from '../models/User.js';

export const sendAutomatedMessage = async ({ toEmail, toPhone, subject, messageText }) => {
    try {
        const settings = await Setting.getSettings();
        if (!settings) {
            console.error('Automation: Settings not found.');
            return;
        }

        // 1. Email Sending
        if (settings.emailAutomationEnabled && toEmail) {
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
            } catch (emailError) {
                console.error('Automation: Failed to send email:', emailError.message);
            }
        }

        // 2. WhatsApp Sending
        if (settings.whatsappAutomationEnabled && toPhone) {
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
            } catch (waError) {
                console.error('Automation: Failed to send WhatsApp:', waError.response?.data || waError.message);
            }
        }
    } catch (globalError) {
        console.error('Automation error:', globalError);
    }
};

export const sendTemplateNotification = async ({ userId, templateKey, variables }) => {
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

        if (template.type === 'email') {
            await sendAutomatedMessage({
                toEmail: user.email,
                subject: replacedSubject || 'Notification from SmartEarning',
                messageText: replacedBody
            });
        } else if (template.type === 'whatsapp') {
            await sendAutomatedMessage({
                toPhone: user.whatsapp || user.phone,
                messageText: replacedBody
            });
        }
    } catch (err) {
        console.error('Failed to send template notification:', err);
    }
};
