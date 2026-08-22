
import Setting from '../models/Setting.js';

/**
 * Public lightweight settings endpoint:
 * Returns only the necessary branding, SEO, exchange rates, and homepage configs.
 * Eliminates all multi-megabyte audit logs, legal text walls, demo profiles, and private tokens.
 */
export const getPublicSettings = async (req, res) => {
    try {
        const settings = await Setting.getSettings();
        
        // Filter faqs to only homepage faqs
        const homepageFaqs = Array.isArray(settings.faqs)
            ? settings.faqs.filter(f => f.showOnHomepage).map(f => ({ question: f.question, answer: f.answer }))
            : [];

        // Build compact public response (~3-5 KB)
        const publicData = {
            seoTitle: settings.seoTitle || "SmartExn | Online Micro-Tasks, Surveys & Global Gigs",
            seoDescription: settings.seoDescription || "SmartExn is a premier micro-task crowdsourcing marketplace.",
            seoKeywords: settings.seoKeywords || "micro-tasks, surveys, gig economy, earn online",
            landingPageStyle: settings.landingPageStyle || 'smartexn',
            homepageContent: settings.homepageContent || {},
            homepagePaymentLogos: settings.homepagePaymentLogos || [],
            homepageVideoUrl: settings.homepageVideoUrl || '',
            exchangeRates: settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278.00 },
            whatsappNumber: settings.whatsappNumber || '',
            whatsappFloatingEnabled: settings.whatsappFloatingEnabled !== false,
            isUserTaskEnabled: settings.isUserTaskEnabled !== false,
            hubEnabled: settings.hubEnabled !== false,
            featuredPlanIds: settings.featuredPlanIds || [],
            faqs: homepageFaqs,
            privacyPolicyTitle: settings.privacyPolicyTitle,
            privacyPolicyUpdated: settings.privacyPolicyUpdated,
            refundPolicyTitle: settings.refundPolicyTitle,
            refundPolicyUpdated: settings.refundPolicyUpdated,
            termsOfUseTitle: settings.termsOfUseTitle,
            termsOfUseUpdated: settings.termsOfUseUpdated,
            dataVersion: settings.dataVersion || 1,
            isInitialPageLoaderEnabled: false // Do not block initial public paint with loader
        };

        // Public caching headers
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.status(200).json({ success: true, data: publicData });
    } catch (err) {
        return res.status(200).json({ success: false, data: {}, error: err.message });
    }
};

export const getSettings = async (req, res) => {
    try {
        if (req.query.public === 'true') {
            return getPublicSettings(req, res);
        }

        const settings = await Setting.getSettings();
        const settingsObj = settings.toObject ? settings.toObject() : { ...settings };

        // Strip massive evaluation logs from regular settings GET to prevent megabyte payload bloat
        delete settingsObj.ruleEvaluationLogs;

        // Strip sensitive credentials from non-super-admin requests
        if (!req.user || req.user.role !== 'super_admin') {
            delete settingsObj.emailSenderPassword;
            delete settingsObj.whatsappToken;
        }

        res.status(200).json({ success: true, data: settingsObj });
    } catch (err) {
        res.status(200).json({ success: false, data: {}, error: err.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const prevSettings = await Setting.findOne();
        const emailBecameRequired = req.body.emailVerificationRequired && (!prevSettings || !prevSettings.emailVerificationRequired);
        const whatsappBecameRequired = req.body.whatsappVerificationRequired && (!prevSettings || !prevSettings.whatsappVerificationRequired);

        const settings = await Setting.findOneAndUpdate({}, { 
            ...req.body, 
            dataVersion: Date.now() 
        }, {
            new: true,
            upsert: true,
            runValidators: true,
        });

        // If verification was newly enabled, mark all existing users as verified
        if (emailBecameRequired || whatsappBecameRequired) {
            try {
                const User = (await import('../models/User.js')).default;
                const updateFields = {};
                if (emailBecameRequired) updateFields.emailVerified = true;
                if (whatsappBecameRequired) updateFields.whatsappVerified = true;
                
                await User.updateMany({}, { $set: updateFields });
            } catch (userErr) {
                console.error('Failed to auto-verify existing users:', userErr);
            }
        }
        
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
