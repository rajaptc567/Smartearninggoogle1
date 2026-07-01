import nodemailer from 'nodemailer';
import axios from 'axios';
import Setting from '../models/Setting.js';

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
                    text: messageText
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
