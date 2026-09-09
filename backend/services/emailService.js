import nodemailer from 'nodemailer';
import Setting from '../models/Setting.js';
import EmailLog from '../models/EmailLog.js';
import TemplateLog from '../models/TemplateLog.js';

// Approved SmartExn senders whitelist
export const APPROVED_SENDERS = [
    { id: 'info', email: 'info@smartexn.com', name: 'SmartExn Information', enabled: true },
    { id: 'support', email: 'support@smartexn.com', name: 'SmartExn Support', enabled: true },
    { id: 'notifications', email: 'notifications@smartexn.com', name: 'SmartExn Notifications', enabled: true },
    { id: 'legal', email: 'legal@smartexn.com', name: 'SmartExn Legal & Compliance', enabled: true },
    { id: 'security', email: 'security@smartexn.com', name: 'SmartExn Security Team', enabled: true },
    { id: 'finance', email: 'finance@smartexn.com', name: 'SmartExn Finance & Billing', enabled: true }
];

export const DEFAULT_SENDER_EMAIL = 'notifications@smartexn.com';

// Category / Event to default sender mapping
export const DEFAULT_EVENT_SENDERS = {
    // Security & Auth
    password_reset: 'security@smartexn.com',
    password_reset_email: 'security@smartexn.com',
    password_reset_otp: 'security@smartexn.com',
    security: 'security@smartexn.com',
    auth: 'security@smartexn.com',
    email_verification: 'security@smartexn.com',

    // Support & Disputes
    support: 'support@smartexn.com',
    dispute: 'support@smartexn.com',
    disputes: 'support@smartexn.com',
    dispute_opened_email: 'support@smartexn.com',
    dispute_resolved_worker_email: 'support@smartexn.com',
    dispute_resolved_employer_email: 'support@smartexn.com',
    DISPUTE_OPENED: 'support@smartexn.com',
    DISPUTE_REPLIED: 'support@smartexn.com',

    // Finance & Billing
    finance: 'finance@smartexn.com',
    deposit: 'finance@smartexn.com',
    deposit_pending_email: 'finance@smartexn.com',
    deposit_success_email: 'finance@smartexn.com',
    deposit_rejected_email: 'finance@smartexn.com',
    withdrawal: 'finance@smartexn.com',
    transfer: 'finance@smartexn.com',
    transfer_request_email: 'finance@smartexn.com',
    transfer_pending_email: 'finance@smartexn.com',
    transfer_sent_email: 'finance@smartexn.com',
    transfer_received_email: 'finance@smartexn.com',
    transfer_rejected_email: 'finance@smartexn.com',
    investment: 'finance@smartexn.com',
    plan_activated_email: 'finance@smartexn.com',
    INVESTMENT_PROFIT_CREDITED: 'finance@smartexn.com',
    wallet_adjusted_email: 'finance@smartexn.com',
    commission: 'finance@smartexn.com',
    commission_locked_email: 'finance@smartexn.com',
    commission_unlocked_email: 'finance@smartexn.com',
    commission_missed_email: 'finance@smartexn.com',

    // Tasks & Campaigns
    task: 'notifications@smartexn.com',
    tasks: 'notifications@smartexn.com',
    notifications: 'notifications@smartexn.com',
    campaign: 'notifications@smartexn.com',
    campaigns: 'notifications@smartexn.com',
    TASK_PROOF_SUBMITTED: 'notifications@smartexn.com',
    TASK_PROOF_APPROVED: 'notifications@smartexn.com',
    TASK_PROOF_REJECTED: 'notifications@smartexn.com',
    CAMPAIGN_SUBMITTED_FOR_APPROVAL: 'notifications@smartexn.com',
    task_campaign_created_email: 'notifications@smartexn.com',
    task_campaign_approved_email: 'notifications@smartexn.com',
    task_campaign_rejected_email: 'notifications@smartexn.com',
    task_submission_received_email: 'notifications@smartexn.com',
    task_submission_approved_email: 'notifications@smartexn.com',
    task_submission_rejected_email: 'notifications@smartexn.com',

    // Legal & Compliance
    legal: 'legal@smartexn.com',
    compliance: 'legal@smartexn.com',
    dmca: 'legal@smartexn.com',
    terms: 'legal@smartexn.com',

    // General & Announcements
    info: 'info@smartexn.com',
    general: 'info@smartexn.com',
    welcome: 'info@smartexn.com',
    welcome_message_email: 'info@smartexn.com',
    general_announcement_email: 'info@smartexn.com',
    test_email: 'notifications@smartexn.com'
};

/**
 * Resolves an approved sender address with safety validation and fallbacks.
 * Enforces:
 * 1. Never allow arbitrary external From addresses.
 * 2. If a selected sender is disabled/unavailable, use the configured default sender.
 */
export const resolveApprovedSender = (requestedSender, eventKey, settings) => {
    const configuredSenders = (settings && Array.isArray(settings.emailSenders) && settings.emailSenders.length > 0)
        ? settings.emailSenders
        : APPROVED_SENDERS;

    const defaultSenderEmail = (settings && settings.defaultSenderEmail) || DEFAULT_SENDER_EMAIL;

    // Check event-specific override if no specific sender was passed
    let targetEmail = requestedSender;
    if (!targetEmail && eventKey) {
        const customEventSenders = (settings && settings.eventSenders) || {};
        targetEmail = customEventSenders[eventKey] || DEFAULT_EVENT_SENDERS[eventKey];
    }

    if (!targetEmail) {
        targetEmail = defaultSenderEmail;
    }

    targetEmail = String(targetEmail).trim().toLowerCase();

    // Verify against configured approved senders
    const matchedSender = configuredSenders.find(s => s.email.toLowerCase() === targetEmail);

    // If approved and enabled, use it
    if (matchedSender && matchedSender.enabled !== false) {
        return {
            email: matchedSender.email,
            name: matchedSender.name || 'SmartExn'
        };
    }

    // Fallback 1: Configured default sender
    const defaultSender = configuredSenders.find(s => s.email.toLowerCase() === defaultSenderEmail.toLowerCase());
    if (defaultSender && defaultSender.enabled !== false) {
        return {
            email: defaultSender.email,
            name: defaultSender.name || 'SmartExn'
        };
    }

    // Fallback 2: First enabled approved sender
    const firstEnabled = configuredSenders.find(s => s.enabled !== false);
    if (firstEnabled) {
        return {
            email: firstEnabled.email,
            name: firstEnabled.name || 'SmartExn'
        };
    }

    // Absolute fallback to notifications@smartexn.com
    return {
        email: DEFAULT_SENDER_EMAIL,
        name: 'SmartExn Notifications'
    };
};

/**
 * Creates the appropriate nodemailer transporter based on provider settings.
 * Supports:
 * - 'existing': Gmail / Custom SMTP using settings.emailSenderAddress & settings.emailSenderPassword
 * - 'resend': Resend SMTP using SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD (or RESEND_API_KEY)
 */
const createTransporterForProvider = (provider, settings) => {
    if (provider === 'resend') {
        const host = process.env.SMTP_HOST || 'smtp.resend.com';
        const port = parseInt(process.env.SMTP_PORT || '465', 10);
        const secure = process.env.SMTP_SECURE !== 'false';
        const user = process.env.SMTP_USER || 'resend';
        const pass = process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY || '';

        if (!pass) {
            console.warn('[EmailService] Warning: Resend SMTP password/API key (SMTP_PASSWORD or RESEND_API_KEY) is not set in environment.');
        }

        return {
            transporter: nodemailer.createTransport({
                host,
                port,
                secure,
                auth: {
                    user,
                    pass
                }
            }),
            providerName: 'resend',
            fromSuffix: ''
        };
    }

    // Existing Provider (Gmail SMTP)
    const user = (settings && settings.emailSenderAddress) || 'smartexn.com@gmail.com';
    const pass = (settings && settings.emailSenderPassword) || '';

    return {
        transporter: nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass
            }
        }),
        providerName: 'existing',
        fromSuffix: user
    };
};

/**
 * Sanitize strings to ensure passwords, OTP codes, and API keys are not exposed in logs
 */
const sanitizeLogContent = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/\b\d{6}\b/g, '******') // Mask 6-digit OTP codes
        .replace(/token=[a-f0-9]{32,64}/gi, 'token=******') // Mask hex tokens
        .replace(/(pass(word)?|key|secret)\s*[:=]\s*["']?[^"'}\s]+["']?/gi, '$1=******');
};

/**
 * Centralized Email Sending Method
 * Handles provider selection, sender resolution, logging, and error tracking.
 */
export const sendEmail = async ({
    to,
    subject,
    html,
    text,
    event = 'transactional_email',
    sender = null,
    provider = null,
    userId = null,
    templateKey = null,
    templateName = null,
    sentBy = 'System'
}) => {
    const timestamp = new Date();
    let settings = null;
    try {
        settings = await Setting.getSettings();
    } catch (err) {
        console.error('[EmailService] Failed to load settings:', err.message);
    }

    // Determine active provider: argument override or DB setting (defaults to 'existing')
    const activeProvider = (provider === 'resend' || provider === 'existing')
        ? provider
        : ((settings && settings.emailProvider) || 'existing');

    // Resolve approved sender
    const resolvedSender = resolveApprovedSender(sender, event || templateKey, settings);

    // Validate recipient
    if (!to || !to.includes('@')) {
        const errorMsg = `Invalid recipient email address: "${to}"`;
        console.error(`[EmailService] ${errorMsg}`);
        
        await logEmailAttempt({
            event,
            sender: resolvedSender.email,
            recipient: to || 'missing_email',
            subject: subject || 'No Subject',
            provider: activeProvider,
            status: 'Failed',
            error: errorMsg,
            messageId: null,
            timestamp,
            userId,
            templateKey,
            templateName,
            sentBy,
            body: html || text || ''
        });

        return {
            success: false,
            error: errorMsg,
            provider: activeProvider,
            sender: resolvedSender.email
        };
    }

    try {
        const { transporter } = createTransporterForProvider(activeProvider, settings);

        // When using Resend, From is the resolved verified sender (e.g. "SmartExn Security" <security@smartexn.com>)
        // When using Existing Gmail, we use the resolved sender name and email
        const fromAddress = `"${resolvedSender.name}" <${resolvedSender.email}>`;

        const mailOptions = {
            from: fromAddress,
            to,
            subject: subject || 'Notification from SmartExn',
            text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
            html: html || text || ''
        };

        const sendResult = await transporter.sendMail(mailOptions);
        const messageId = sendResult?.messageId || `msg_${Date.now()}`;

        console.log(`[EmailService] Email sent successfully via ${activeProvider.toUpperCase()} [${messageId}] to: ${to} (Sender: ${fromAddress})`);

        await logEmailAttempt({
            event,
            sender: resolvedSender.email,
            recipient: to,
            subject: subject || 'No Subject',
            provider: activeProvider,
            status: 'Success',
            error: null,
            messageId,
            timestamp,
            userId,
            templateKey,
            templateName,
            sentBy,
            body: html || text || ''
        });

        return {
            success: true,
            messageId,
            provider: activeProvider,
            sender: resolvedSender.email
        };
    } catch (sendError) {
        const errorMsg = sendError.message || 'Unknown email sending failure';
        console.error(`[EmailService] Failed to send email via ${activeProvider.toUpperCase()} to ${to}:`, errorMsg);

        await logEmailAttempt({
            event,
            sender: resolvedSender.email,
            recipient: to,
            subject: subject || 'No Subject',
            provider: activeProvider,
            status: 'Failed',
            error: errorMsg,
            messageId: null,
            timestamp,
            userId,
            templateKey,
            templateName,
            sentBy,
            body: html || text || ''
        });

        return {
            success: false,
            error: errorMsg,
            provider: activeProvider,
            sender: resolvedSender.email
        };
    }
};

/**
 * Robust Logger for Email attempts
 * Writes to EmailLog and updates/creates TemplateLog without logging secrets.
 */
const logEmailAttempt = async ({
    event,
    sender,
    recipient,
    subject,
    provider,
    status,
    error,
    messageId,
    timestamp,
    userId,
    templateKey,
    templateName,
    sentBy,
    body
}) => {
    const cleanError = error ? sanitizeLogContent(error) : null;
    const cleanSubject = sanitizeLogContent(subject);

    // 1. Log to EmailLog
    try {
        await EmailLog.create({
            event,
            sender,
            recipient,
            subject: cleanSubject,
            provider,
            status,
            error: cleanError,
            messageId,
            timestamp,
            userId
        });
    } catch (eLogErr) {
        console.error('[EmailService] Failed to write EmailLog:', eLogErr.message);
    }

    // 2. Log to TemplateLog for admin dashboard visibility
    try {
        const sanitizedBody = sanitizeLogContent(body);
        await TemplateLog.create({
            userId,
            username: recipient.split('@')[0] || 'User',
            userEmail: recipient,
            templateKey: templateKey || event || 'email_notification',
            templateName: templateName || event || 'Direct Notification',
            type: 'email',
            recipient,
            subject: cleanSubject,
            body: sanitizedBody,
            status,
            error: cleanError ? `[${provider.toUpperCase()}] ${cleanError}` : undefined,
            sentBy: sentBy || 'System'
        });
    } catch (tLogErr) {
        console.error('[EmailService] Failed to write TemplateLog:', tLogErr.message);
    }
};

export default {
    sendEmail,
    resolveApprovedSender,
    APPROVED_SENDERS,
    DEFAULT_SENDER_EMAIL,
    DEFAULT_EVENT_SENDERS
};
