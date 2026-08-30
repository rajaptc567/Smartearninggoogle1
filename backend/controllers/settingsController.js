
import Setting from '../models/Setting.js';

// Clean standard fallback logos map for popular gateways
const STANDARD_FALLBACK_LOGOS = {
    'easypaisa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Easypaisa_logo.png/320px-Easypaisa_logo.png',
    'jazzcash': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Jazzcash_logo.png/320px-Jazzcash_logo.png',
    'bank transfer': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
    'paypal': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
    'stripe': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
    'payoneer': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Payoneer_logo.svg',
    'crypto': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    'usdt': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    'usdt (trc20)': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    'visa': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg',
    'mastercard': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg',
    'perfect money': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Perfect_Money_logo.png',
    'payeer': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Payeer_logo.png'
};

/**
 * Public lightweight settings endpoint:
 * Returns only the necessary branding, SEO, exchange rates, and homepage configs.
 * Eliminates all multi-megabyte audit logs, legal text walls, demo profiles, Base64 image blobs, and private tokens.
 */
export const getPublicSettings = async (req, res) => {
    try {
        const settings = await Setting.getSettings();
        
        // Filter faqs to only homepage faqs and extract only necessary fields
        const homepageFaqs = Array.isArray(settings.faqs)
            ? settings.faqs
                .filter(f => f.showOnHomepage)
                .slice(0, 10) // Limit to top homepage FAQs
                .map(f => ({ question: String(f.question || ''), answer: String(f.answer || '') }))
            : [];

        // Extract and strictly sanitize smartexnContent - exclude all Base64 images
        const rawSmartexn = (settings.homepageContent && settings.homepageContent.smartexnContent) || {};
        const cleanSmartexn = {};
        const allowedSmartexnKeys = [
            'heroTitle', 'heroSubtitle', 'heroStartBtn', 'heroPublishBtn',
            'howItWorksTitle', 'step1Title', 'step1Desc', 'step2Title', 'step2Desc',
            'step3Title', 'step3Desc', 'step4Title', 'step4Desc',
            'oppsTitle', 'opp1Title', 'opp1Desc', 'opp2Title', 'opp2Desc', 'opp3Title', 'opp3Desc', 'opp4Title', 'opp4Desc',
            'bizTitle', 'bizPoint1Title', 'bizPoint1Desc', 'bizPoint2Title', 'bizPoint2Desc', 'bizPoint3Title', 'bizPoint3Desc', 'bizPoint4Title', 'bizPoint4Desc',
            'footerCopyright'
        ];

        for (const key of allowedSmartexnKeys) {
            if (typeof rawSmartexn[key] === 'string' && rawSmartexn[key].trim()) {
                cleanSmartexn[key] = rawSmartexn[key].trim();
            }
        }

        // Clean and sanitize homepage payment logos - strip large Base64 blobs
        const rawLogos = Array.isArray(settings.homepagePaymentLogos) ? settings.homepagePaymentLogos : [];
        const sanitizedPaymentLogos = rawLogos.map(item => {
            let logoUrl = item.logoUrl || '';
            if (typeof logoUrl === 'string' && (logoUrl.startsWith('data:image/') || logoUrl.length > 500)) {
                const lowerName = (item.name || '').toLowerCase().trim();
                const matchedKey = Object.keys(STANDARD_FALLBACK_LOGOS).find(k => lowerName.includes(k));
                logoUrl = matchedKey ? STANDARD_FALLBACK_LOGOS[matchedKey] : '';
            }
            return {
                name: item.name || '',
                logoUrl
            };
        });

        // Build compact public response (~2-3 KB total payload)
        const publicData = {
            seoTitle: settings.seoTitle || "SmartExn | Online Micro-Tasks, Surveys & Global Gigs",
            seoDescription: settings.seoDescription || "SmartExn is a premier micro-task crowdsourcing marketplace.",
            seoKeywords: settings.seoKeywords || "micro-tasks, surveys, gig economy, earn online",
            landingPageStyle: settings.landingPageStyle || 'smartexn',
            homepageContent: {
                smartexnContent: cleanSmartexn,
                showHero: settings.homepageContent?.showHero !== false,
                showFeatures: settings.homepageContent?.showFeatures !== false,
                showPaymentMethods: settings.homepageContent?.showPaymentMethods !== false,
                showFAQ: settings.homepageContent?.showFAQ !== false,
                showCTA: settings.homepageContent?.showCTA !== false,
                paymentMethodsTitle: settings.homepageContent?.paymentMethodsTitle || "Global Payment & Withdrawal Partners",
                paymentMethodsDesc: settings.homepageContent?.paymentMethodsDesc || "Fast, secure deposits & instant withdrawals supported through top global networks, local e-wallets, and cryptocurrency channels.",
                paymentMethodsDisplayType: settings.homepageContent?.paymentMethodsDisplayType || 'static',
                paymentMethodsColorStyle: settings.homepageContent?.paymentMethodsColorStyle || 'color'
            },
            homepagePaymentLogos: sanitizedPaymentLogos,
            homepageVideoUrl: (typeof settings.homepageVideoUrl === 'string' && settings.homepageVideoUrl.length < 500) ? settings.homepageVideoUrl : '',
            exchangeRates: settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278.00 },
            whatsappNumber: settings.whatsappNumber || '',
            whatsappFloatingEnabled: settings.whatsappFloatingEnabled !== false,
            isUserTaskEnabled: settings.isUserTaskEnabled !== false,
            isUserTransferEnabled: settings.isUserTransferEnabled !== false,
            isTasksEnabled: settings.isTasksEnabled !== false,
            transferConfig: settings.transferConfig || { enabled: true, tiers: [], allowCrossCurrency: false },
            hubEnabled: settings.hubEnabled !== false,
            hubAccessMode: settings.hubAccessMode || 'all',
            hubAllowedUserIds: settings.hubAllowedUserIds || [],
            hubAllowedPlanIds: settings.hubAllowedPlanIds || [],
            hubMinDeposit: settings.hubMinDeposit ?? 5,
            hubMaxDeposit: settings.hubMaxDeposit ?? 1000,
            hubMinWithdrawal: settings.hubMinWithdrawal ?? 1,
            hubMaxWithdrawal: settings.hubMaxWithdrawal ?? 1000,
            hubDepositMethods: settings.hubDepositMethods || [],
            modulePagesConfig: settings.modulePagesConfig || null,
            workAndEarnConfig: settings.workAndEarnConfig || null,
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

        // Temporary development diagnostics to verify serialized payload size
        if (process.env.NODE_ENV !== 'production') {
            const serialized = JSON.stringify({ success: true, data: publicData });
            console.log(`[Diagnostic] /settings/public response payload: ${Buffer.byteLength(serialized, 'utf8')} bytes, keys: ${Object.keys(publicData).join(', ')}`);
        }

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

        // Strip sensitive credentials from non-admin requests
        const isAuthorizedAdmin = req.user && (
            req.user.role === 'admin' || 
            req.user.role === 'super_admin' || 
            req.user.email === 'studio56.pk@gmail.com' ||
            req.user.email === 'smartexn.com@gmail.com'
        );

        if (!isAuthorizedAdmin) {
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

        // Sanitize homepage payment logos to remove empty/invalid items
        if (Array.isArray(req.body.homepagePaymentLogos)) {
            req.body.homepagePaymentLogos = req.body.homepagePaymentLogos
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    name: String(item.name || '').trim(),
                    logoUrl: String(item.logoUrl || '').trim()
                }))
                .filter(item => item.name || item.logoUrl);
        }

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
