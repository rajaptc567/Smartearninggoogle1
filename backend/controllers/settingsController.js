
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import EmailLog from '../models/EmailLog.js';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';
import { sendEmail, APPROVED_SENDERS } from '../services/emailService.js';

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
            'metaTitle', 'metaDescription', 'websiteSchemaDesc', 'headerSlogan', 'seoTitle', 'seoKeywords', 'seoDescription',
            'heroEyebrow', 'heroTitle', 'heroSubtitle', 'heroStartBtn', 'heroStartBtnCaption', 'heroPublishBtn', 'heroPublishBtnCaption',
            'heroTrust1', 'heroTrust2', 'heroTrust3', 'heroTrustPayouts', 'heroTrustTasks', 'heroTrustCountries', 'heroCaptionGlobal', 'heroCaptionEscrow',
            'howItWorksEyebrow', 'howItWorksTitle', 'howItWorksSubtitle',
            'step1Title', 'step1Desc', 'step1Footer', 'step2Title', 'step2Desc', 'step2Footer',
            'step3Title', 'step3Desc', 'step3Footer', 'step4Title', 'step4Desc', 'step4Footer',
            'oppsEyebrow', 'oppsTitle', 'oppsSubtitle',
            'opp1Title', 'opp1Desc', 'opp2Title', 'opp2Desc', 'opp3Title', 'opp3Desc', 'opp4Title', 'opp4Desc',
            'oppsDisclosureLabel', 'oppsDisclosureText',
            'bizEyebrow', 'bizTitle', 'bizSubtitle', 'bizCtaText', 'bizCtaBtn',
            'bizPoint1Title', 'bizPoint1Desc', 'bizPoint2Title', 'bizPoint2Desc', 'bizPoint3Title', 'bizPoint3Desc', 'bizPoint4Title', 'bizPoint4Desc',
            'escrowEyebrow', 'escrowTitle', 'escrowSubtitle',
            'escrowCard1Title', 'escrowCard1Desc', 'escrowCard2Title', 'escrowCard2Desc', 'escrowCard3Title', 'escrowCard3Desc',
            'paymentEyebrow', 'paymentTitle', 'paymentDesc',
            'paymentBadge1Title', 'paymentBadge1Desc', 'paymentBadge2Title', 'paymentBadge2Desc', 'paymentBadge3Title', 'paymentBadge3Desc',
            'faqEyebrow', 'faqTitle', 'faqSubtitle',
            'faq1Q', 'faq1A', 'faq2Q', 'faq2A', 'faq3Q', 'faq3A', 'faq4Q', 'faq4A', 'faq5Q', 'faq5A', 'faq6Q', 'faq6A', 'faqKnowledgeBtn',
            'finalCtaEyebrow', 'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaStartBtn', 'finalCtaPublishBtn',
            'footerTagline', 'footerCol1Title', 'footerCol2Title', 'footerCol3Title', 'footerCol4Title', 'footerCopyright', 'footerEscrowBadge'
        ];

        for (const key of allowedSmartexnKeys) {
            if (typeof rawSmartexn[key] === 'string' && rawSmartexn[key].trim()) {
                cleanSmartexn[key] = rawSmartexn[key].trim();
            }
        }

        // Clean and sanitize homepage payment logos - keep admin uploaded logo data and apply fallbacks when empty
        const rawLogos = Array.isArray(settings.homepagePaymentLogos) ? settings.homepagePaymentLogos : [];
        const sanitizedPaymentLogos = rawLogos
            .filter(item => item && typeof item === 'object' && (item.name || item.logoUrl))
            .map(item => {
                let logoUrl = typeof item.logoUrl === 'string' ? item.logoUrl.trim() : '';
                const name = typeof item.name === 'string' ? item.name.trim() : '';

                // If logoUrl is missing or empty, attempt standard fallback mapping by name
                if (!logoUrl && name) {
                    const lowerName = name.toLowerCase();
                    const matchedKey = Object.keys(STANDARD_FALLBACK_LOGOS).find(k => lowerName.includes(k));
                    if (matchedKey) {
                        logoUrl = STANDARD_FALLBACK_LOGOS[matchedKey];
                    }
                }

                return {
                    name,
                    logoUrl
                };
            });

        // Resolve public-facing role emails from emailSenders
        const publicEmailSenders = (settings.emailSenders && settings.emailSenders.length > 0)
            ? settings.emailSenders.map(s => ({ id: s.id, email: s.email, name: s.name, enabled: s.enabled }))
            : APPROVED_SENDERS;

        const supportSender = publicEmailSenders.find(s => s.id === 'support');
        const legalSender = publicEmailSenders.find(s => s.id === 'legal');
        const financeSender = publicEmailSenders.find(s => s.id === 'finance');
        const infoSender = publicEmailSenders.find(s => s.id === 'info');
        const securitySender = publicEmailSenders.find(s => s.id === 'security');
        const notificationsSender = publicEmailSenders.find(s => s.id === 'notifications');

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
                showUkSupportOffice: settings.showUkSupportOffice !== false && settings.homepageContent?.showUkSupportOffice !== false,
                showUkSupportOfficeInFooter: settings.showUkSupportOfficeInFooter !== false && settings.homepageContent?.showUkSupportOfficeInFooter !== false,
                paymentMethodsTitle: settings.homepageContent?.paymentMethodsTitle || "Global Payment & Withdrawal Partners",
                paymentMethodsDesc: settings.homepageContent?.paymentMethodsDesc || "Fast, secure deposits & instant withdrawals supported through top global networks, local e-wallets, and cryptocurrency channels.",
                paymentMethodsDisplayType: settings.homepageContent?.paymentMethodsDisplayType || 'static',
                paymentMethodsColorStyle: settings.homepageContent?.paymentMethodsColorStyle || 'color'
            },
            showUkSupportOffice: settings.showUkSupportOffice !== false && settings.homepageContent?.showUkSupportOffice !== false,
            showUkSupportOfficeInFooter: settings.showUkSupportOfficeInFooter !== false && settings.homepageContent?.showUkSupportOfficeInFooter !== false,
            publicSupportEmail: settings.publicSupportEmail || supportSender?.email || 'support@smartexn.com',
            supportOfficeBadge1: settings.supportOfficeBadge1 || 'Official Registered Support Desk',
            supportOfficeBadge2: settings.supportOfficeBadge2 || 'UK Customer Support',
            supportOfficeTitle: settings.supportOfficeTitle || 'UK Customer Support',
            supportOfficeSubtitle: settings.supportOfficeSubtitle || 'Have questions or need assistance before creating an account? Our dedicated UK headquarters desk provides direct support for workers, campaign creators, and international partners.',
            supportOfficeAddressLabel: settings.supportOfficeAddressLabel || 'Support Address:',
            supportOfficeAddress: settings.supportOfficeAddress || '71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom',
            supportOfficePhone: settings.supportOfficePhone || '+447846775662',
            supportOfficeEmail: settings.publicSupportEmail || supportSender?.email || settings.supportOfficeEmail || 'support@smartexn.com',
            supportOfficeHours: settings.supportOfficeHours || '15 – 60 Minutes',
            supportOfficeRegistrationNumber: settings.supportOfficeRegistrationNumber || '14529081',
            supportOfficeJurisdiction: settings.supportOfficeJurisdiction || 'England & Wales (Companies House Registered)',
            enableContactUsBox: settings.enableContactUsBox !== false,
            enableContactViaEmail: settings.enableContactViaEmail !== false,
            enableContactViaWhatsApp: settings.enableContactViaWhatsApp !== false,
            contactUsEmailAddress: settings.publicSupportEmail || supportSender?.email || settings.contactUsEmailAddress || 'support@smartexn.com',
            supportEmail: settings.publicSupportEmail || supportSender?.email || 'support@smartexn.com',
            legalEmail: legalSender?.email || 'legal@smartexn.com',
            financeEmail: financeSender?.email || 'finance@smartexn.com',
            infoEmail: infoSender?.email || 'info@smartexn.com',
            securityEmail: securitySender?.email || 'security@smartexn.com',
            notificationsEmail: notificationsSender?.email || 'notifications@smartexn.com',
            emailSenders: publicEmailSenders,
            contactUsWhatsAppNumber: settings.contactUsWhatsAppNumber || '+447846775662',
            contactUsBoxTitle: settings.contactUsBoxTitle || 'International Member Support & Contact Desk',
            contactUsBoxSubtitle: settings.contactUsBoxSubtitle || 'Have questions regarding your withdrawal, payout settlement, or account verification?',
            homepagePaymentLogos: sanitizedPaymentLogos,
            homepageVideoUrl: (typeof settings.homepageVideoUrl === 'string' && settings.homepageVideoUrl.length < 500) ? settings.homepageVideoUrl : '',
            exchangeRates: settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278.00 },
            whatsappNumber: settings.whatsappNumber || '',
            whatsappFloatingEnabled: settings.whatsappFloatingEnabled !== false,
            investmentModuleEnabled: settings.investmentModuleEnabled !== false && settings.isInvestmentModuleEnabled !== false,
            isInvestmentModuleEnabled: settings.investmentModuleEnabled !== false && settings.isInvestmentModuleEnabled !== false,
            investmentActivePlanBypassEnabled: Boolean(settings.investmentActivePlanBypassEnabled),
            investmentManualWhitelistEnabled: Boolean(settings.investmentManualWhitelistEnabled),
            isUserTaskEnabled: settings.isUserTaskEnabled !== false,
            isUserTransferEnabled: settings.isUserTransferEnabled !== false,
            isTasksEnabled: settings.isTasksEnabled !== false,
            surveyCampaignsEnabled: settings.surveyCampaignsEnabled !== false && settings.taskCategoryPresets?.survey?.enabled !== false,
            taskCategoryPresets: settings.taskCategoryPresets || null,
            surveyConfig: settings.surveyConfig || null,
            transferConfig: settings.transferConfig || { enabled: true, tiers: [], allowCrossCurrency: false, allowManualRecipientEntry: true },
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
            userQuickActionsConfig: settings.userQuickActionsConfig || null,
            myCampaignActionsConfig: settings.myCampaignActionsConfig || { deposit: true, transfer: true, analytics: true, convert: true },
            campaignConvertEnabled: settings.campaignConvertEnabled !== false,
            featuredPlanIds: settings.featuredPlanIds || [],
            faqs: homepageFaqs,
            privacyPolicyTitle: settings.privacyPolicyTitle,
            privacyPolicyUpdated: settings.privacyPolicyUpdated,
            refundPolicyTitle: settings.refundPolicyTitle,
            refundPolicyUpdated: settings.refundPolicyUpdated,
            termsOfUseTitle: settings.termsOfUseTitle,
            termsOfUseUpdated: settings.termsOfUseUpdated,
            signUpConfig: settings.signUpConfig || null,
            signUpConsentConfig: settings.signUpConsentConfig || null,
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

        const rawPublicEmail = (settingsObj.publicSupportEmail || '').trim();
        if (!rawPublicEmail || rawPublicEmail.toLowerCase() === 'smartexn.com@gmail.com') {
            settingsObj.publicSupportEmail = 'support@smartexn.com';
        }
        if (!settingsObj.supportOfficeEmail || settingsObj.supportOfficeEmail.toLowerCase() === 'smartexn.com@gmail.com') {
            settingsObj.supportOfficeEmail = 'support@smartexn.com';
        }
        if (!settingsObj.contactUsEmailAddress || settingsObj.contactUsEmailAddress.toLowerCase() === 'smartexn.com@gmail.com') {
            settingsObj.contactUsEmailAddress = 'support@smartexn.com';
        }
        if (settingsObj.emailSenderAddress && settingsObj.emailSenderAddress.toLowerCase() === 'smartexn.com@gmail.com') {
            settingsObj.emailSenderAddress = 'notifications@smartexn.com';
        }

        // Strip sensitive credentials from non-admin requests
        const isAuthorizedAdmin = req.user && (
            req.user.role === 'admin' || 
            req.user.role === 'super_admin' ||
            req.user.email === 'studio56.pk@gmail.com'
        );

        if (!isAuthorizedAdmin) {
            delete settingsObj.emailSenderPassword;
            delete settingsObj.whatsappToken;
            delete settingsObj.investmentManualWhitelistUserIds;
        }

        if (req.user) {
            const user = await User.findById(req.user.id);
            settingsObj.canAccessInvestment = canUserAccessInvestmentModule(user, settings);
        } else {
            settingsObj.canAccessInvestment = settings.investmentModuleEnabled !== false && settings.isInvestmentModuleEnabled !== false;
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

        // Synchronize master investment module toggle flags
        if (req.body.investmentModuleEnabled !== undefined) {
            req.body.isInvestmentModuleEnabled = req.body.investmentModuleEnabled;
        } else if (req.body.isInvestmentModuleEnabled !== undefined) {
            req.body.investmentModuleEnabled = req.body.isInvestmentModuleEnabled;
        }

        // Synchronize surveyCampaignsEnabled with taskCategoryPresets.survey.enabled
        if (req.body.surveyCampaignsEnabled !== undefined) {
            const currentPresets = req.body.taskCategoryPresets || prevSettings?.taskCategoryPresets || {};
            req.body.taskCategoryPresets = {
                ...currentPresets,
                survey: {
                    ...(currentPresets.survey || {}),
                    enabled: req.body.surveyCampaignsEnabled
                }
            };
        } else if (req.body.taskCategoryPresets?.survey?.enabled !== undefined) {
            req.body.surveyCampaignsEnabled = req.body.taskCategoryPresets.survey.enabled;
        }

        // Ensure myCampaignActionsConfig is properly handled and persisted (deposit, transfer, analytics, convert)
        if (req.body.myCampaignActionsConfig && typeof req.body.myCampaignActionsConfig === 'object') {
            const prevActions = prevSettings?.myCampaignActionsConfig || {};
            req.body.myCampaignActionsConfig = {
                deposit: req.body.myCampaignActionsConfig.deposit !== undefined 
                    ? Boolean(req.body.myCampaignActionsConfig.deposit) 
                    : (prevActions.deposit !== false),
                transfer: req.body.myCampaignActionsConfig.transfer !== undefined 
                    ? Boolean(req.body.myCampaignActionsConfig.transfer) 
                    : (prevActions.transfer !== false),
                analytics: req.body.myCampaignActionsConfig.analytics !== undefined 
                    ? Boolean(req.body.myCampaignActionsConfig.analytics) 
                    : (prevActions.analytics !== false),
                convert: req.body.myCampaignActionsConfig.convert !== undefined 
                    ? Boolean(req.body.myCampaignActionsConfig.convert) 
                    : (prevActions.convert !== false)
            };
        }

        if (req.body.campaignConvertEnabled !== undefined) {
            req.body.campaignConvertEnabled = Boolean(req.body.campaignConvertEnabled);
        }

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

        // Admin-Editable Email Senders Management (Preserve all 6 roles: info, support, notifications, legal, security, finance)
        const VALID_ROLES = ['info', 'support', 'notifications', 'legal', 'security', 'finance'];
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (Array.isArray(req.body.emailSenders)) {
            const currentSenders = prevSettings?.emailSenders || APPROVED_SENDERS;
            const updatedSenders = [];

            VALID_ROLES.forEach(roleId => {
                const incoming = req.body.emailSenders.find(s => s && String(s.id).toLowerCase() === roleId);
                const existing = currentSenders.find(s => s && String(s.id).toLowerCase() === roleId) || APPROVED_SENDERS.find(s => s.id === roleId);

                let email = existing?.email || `${roleId}@smartexn.com`;
                let name = existing?.name || `SmartExn ${roleId.charAt(0).toUpperCase() + roleId.slice(1)}`;
                let enabled = existing?.enabled !== false;

                if (incoming && typeof incoming === 'object') {
                    if (incoming.email && EMAIL_REGEX.test(String(incoming.email).trim())) {
                        email = String(incoming.email).trim().toLowerCase();
                    }
                    if (incoming.name && String(incoming.name).trim()) {
                        name = String(incoming.name).trim();
                    }
                    if (typeof incoming.enabled === 'boolean') {
                        enabled = incoming.enabled;
                    }
                }

                updatedSenders.push({
                    id: roleId,
                    email,
                    name,
                    enabled
                });
            });

            req.body.emailSenders = updatedSenders;
        }

        if (req.body.defaultSenderEmail) {
            const cleanDefault = String(req.body.defaultSenderEmail).trim().toLowerCase();
            const allowedEmails = (req.body.emailSenders || prevSettings?.emailSenders || APPROVED_SENDERS).map(s => s.email.toLowerCase());
            if (allowedEmails.includes(cleanDefault)) {
                req.body.defaultSenderEmail = cleanDefault;
            } else {
                delete req.body.defaultSenderEmail;
            }
        }

        // Validate provider option
        if (req.body.emailProvider && !['existing', 'resend'].includes(req.body.emailProvider)) {
            req.body.emailProvider = 'existing';
        }

        // Validate and sanitize publicSupportEmail
        if (req.body.publicSupportEmail !== undefined) {
            let cleanEmail = String(req.body.publicSupportEmail).trim().toLowerCase();
            if (cleanEmail === 'smartexn.com@gmail.com' || !cleanEmail) {
                cleanEmail = 'support@smartexn.com';
            }
            if (EMAIL_REGEX.test(cleanEmail)) {
                req.body.publicSupportEmail = cleanEmail;
                if (!req.body.supportOfficeEmail || req.body.supportOfficeEmail.toLowerCase() === 'smartexn.com@gmail.com') req.body.supportOfficeEmail = cleanEmail;
                if (!req.body.contactUsEmailAddress || req.body.contactUsEmailAddress.toLowerCase() === 'smartexn.com@gmail.com') req.body.contactUsEmailAddress = cleanEmail;
            } else {
                delete req.body.publicSupportEmail;
            }
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

// Admin Test Email Dispatch
export const sendTestEmail = async (req, res) => {
    try {
        const { toEmail, sender, provider } = req.body;
        if (!toEmail || !toEmail.includes('@')) {
            return res.status(400).json({ success: false, error: 'A valid destination email is required.' });
        }

        const settings = await Setting.getSettings();
        const activeProvider = provider || settings.emailProvider || 'existing';
        const testSender = sender || settings.defaultSenderEmail || 'notifications@smartexn.com';

        const result = await sendEmail({
            to: toEmail,
            subject: `SmartExn Email Service Test [${activeProvider.toUpperCase()}]`,
            sender: testSender,
            provider: activeProvider,
            event: 'test_email',
            sentBy: req.user?.username || 'Admin',
            html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
                    <h2 style="color: #0284c7; margin: 0; font-size: 20px;">SmartExn Email Service Verification</h2>
                </div>
                <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Hello,</p>
                <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">This test email confirms that your transactional email infrastructure is operating smoothly and successfully delivering messages.</p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 13px; line-height: 1.8;">
                    <div><strong>Active Provider:</strong> ${activeProvider === 'resend' ? 'Resend SMTP' : 'Existing Email Provider (Gmail)'}</div>
                    <div><strong>Dispatched From:</strong> ${testSender}</div>
                    <div><strong>Delivered To:</strong> ${toEmail}</div>
                    <div><strong>Dispatched By:</strong> ${req.user?.username || 'Admin'}</div>
                    <div><strong>Server Time:</strong> ${new Date().toUTCString()}</div>
                </div>
                <p style="font-size: 12px; color: #64748b; margin: 0;">This message was triggered by an authorized administrator from the SmartExn settings panel.</p>
            </div>
            `
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to send test email',
                provider: activeProvider,
                sender: result.sender
            });
        }

        return res.status(200).json({
            success: true,
            message: `Test email successfully sent via ${activeProvider.toUpperCase()}`,
            data: {
                messageId: result.messageId,
                provider: activeProvider,
                sender: result.sender
            }
        });
    } catch (err) {
        console.error('Error in sendTestEmail:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error while sending test email' });
    }
};

// Admin Email Logs Retrieval
export const getEmailLogs = async (req, res) => {
    try {
        const logs = await EmailLog.find().sort({ createdAt: -1 }).limit(100);
        res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
