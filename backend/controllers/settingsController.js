
import Setting from '../models/Setting.js';
import nodemailer from 'nodemailer';

export const getSettings = async (req, res) => {
    try {
        const settings = await Setting.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(200).json({ success: false, data: {}, error: err.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const settings = await Setting.findOneAndUpdate({}, { 
            ...req.body, 
            dataVersion: Date.now() 
        }, {
            new: true,
            upsert: true,
            runValidators: true,
        });
        
        // Notify all clients via socket.io for instant real-time reflections
        const io = req.app.get('io');
        if (io) {
            io.emit('DATA_CHANGED');
        }
        
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// Standardized version polling to prevent infinite loops
export const getDataVersion = async (req, res) => {
    try {
        const settings = await Setting.findOne().select('dataVersion');
        res.status(200).json({ 
            success: true, 
            version: settings?.dataVersion || 1 
        });
    } catch (err) {
        // Return a stable version on error to prevent re-fetch loops
        res.status(200).json({ success: true, version: 1 });
    }
};

export const testEmailSettings = async (req, res) => {
    try {
        const { emailSenderAddress, emailSenderPassword, testRecipient } = req.body;
        if (!emailSenderAddress || !emailSenderPassword || !testRecipient) {
            return res.status(400).json({ success: false, error: 'All fields (sender, password, recipient) are required.' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailSenderAddress,
                pass: emailSenderPassword
            }
        });

        const mailOptions = {
            from: `"SmartEarning Test" <${emailSenderAddress}>`,
            to: testRecipient,
            subject: 'SmartEarning SMTP Test',
            text: 'Hello! If you are reading this, your Gmail Free SMTP Automation credentials are working perfectly! Congratulations.'
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: `Test email sent successfully to ${testRecipient}!` });
    } catch (err) {
        res.status(200).json({ success: false, error: err.message });
    }
};

