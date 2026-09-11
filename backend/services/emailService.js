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

// Role-to-event routing map for SmartExn system notifications
export const EVENT_TO_ROLE = {
    // Security & Auth -> security
    password_reset: 'security',
    password_reset_email: 'security',
    password_reset_otp: 'security',
    security: 'security',
    auth: 'security',
    email_verification: 'security',
    transactional_otp: 'security',

    // Support & Disputes -> support
    support: 'support',
    dispute: 'support',
    disputes: 'support',
    dispute_opened_email: 'support',
    dispute_resolved_worker_email: 'support',
    dispute_resolved_employer_email: 'support',
    DISPUTE_OPENED: 'support',
    DISPUTE_REPLIED: 'support',

    // Finance & Billing -> finance
    finance: 'finance',
    deposit: 'finance',
    deposit_pending_email: 'finance',
    deposit_success_email: 'finance',
    deposit_rejected_email: 'finance',
    withdrawal: 'finance',
    transfer: 'finance',
    transfer_request_email: 'finance',
    transfer_pending_email: 'finance',
    transfer_sent_email: 'finance',
    transfer_received_email: 'finance',
    transfer_rejected_email: 'finance',
    investment: 'finance',
    plan_activated_email: 'finance',
    INVESTMENT_PROFIT_CREDITED: 'finance',
    wallet_adjusted_email: 'finance',
    commission: 'finance',
    commission_locked_email: 'finance',
    commission_unlocked_email: 'finance',
    commission_missed_email: 'finance',

    // Tasks & Campaigns -> notifications
    task: 'notifications',
    tasks: 'notifications',
    notifications: 'notifications',
    campaign: 'notifications',
    campaigns: 'notifications',
    TASK_PROOF_SUBMITTED: 'notifications',
    TASK_PROOF_APPROVED: 'notifications',
    TASK_PROOF_REJECTED: 'notifications',
    CAMPAIGN_SUBMITTED_FOR_APPROVAL: 'notifications',
    task_campaign_created_email: 'notifications',
    task_campaign_approved_email: 'notifications',
    task_campaign_rejected_email: 'notifications',
    task_submission_received_email: 'notifications',
    task_submission_approved_email: 'notifications',
    task_submission_rejected_email: 'notifications',

    // Legal & Compliance -> legal
    legal: 'legal',
    compliance: 'legal',
    dmca: 'legal',
    terms: 'legal',

    // General & Announcements -> info
    info: 'info',
    general: 'info',
    welcome: 'info',
    welcome_message_email: 'info',
    general_announcement_email: 'info',
    test_email: 'notifications'
};

/**
 * Resolves an approved sender address with safety validation and fallbacks.
 * Enforces:
 * 1. Read admin-saved configurations from Settings (email, name, enabled state).
 * 2. Route events by semantic role (security, finance, notifications, support, legal, info).
 * 3. Never allow arbitrary unverified external From addresses.
 * 4. If a selected sender is disabled/unavailable, use the configured default sender.
 */
export const resolveApprovedSender = (requestedSender, eventKey, settings) => {
    const configuredSenders = (settings && Array.isArray(settings.emailSenders) && settings.emailSenders.length > 0)
        ? settings.emailSenders
        : APPROVED_SENDERS;

    const defaultSenderEmail = (settings && settings.defaultSenderEmail) || DEFAULT_SENDER_EMAIL;

    let targetSender = null;

    // 1. If an explicit sender (role id or email address) was requested
    if (requestedSender) {
        const cleanRequested = String(requestedSender).trim().toLowerCase();
        // Check by role ID first (e.g., 'info', 'support', 'finance')
        targetSender = configuredSenders.find(s => String(s.id).toLowerCase() === cleanRequested);
        // If not found by role ID, check by email address
        if (!targetSender) {
            targetSender = configuredSenders.find(s => String(s.email).toLowerCase() === cleanRequested);
        }
    }

    // 2. If no explicit sender was passed, resolve by event routing
    if (!targetSender && eventKey) {
        // Check custom event override in settings if present
        const customEventMapping = (settings && settings.eventSenders) || {};
        const mappedTarget = customEventMapping[eventKey];

        if (mappedTarget) {
            const cleanMapped = String(mappedTarget).trim().toLowerCase();
            targetSender = configuredSenders.find(s => String(s.id).toLowerCase() === cleanMapped || String(s.email).toLowerCase() === cleanMapped);
        }

        // Standard semantic event-to-role routing
        if (!targetSender) {
            let role = EVENT_TO_ROLE[eventKey];
            if (!role) {
                // Heuristic regex keyword fallback
                const keyLower = String(eventKey).toLowerCase();
                if (/password|security|auth|verification|otp/i.test(keyLower)) {
                    role = 'security';
                } else if (/finance|deposit|withdrawal|transfer|investment|plan|wallet|commission|payout/i.test(keyLower)) {
                    role = 'finance';
                } else if (/task|campaign|notification/i.test(keyLower)) {
                    role = 'notifications';
                } else if (/dispute|support|ticket/i.test(keyLower)) {
                    role = 'support';
                } else if (/legal|compliance|dmca|terms/i.test(keyLower)) {
                    role = 'legal';
                } else if (/welcome|info|general|announcement/i.test(keyLower)) {
                    role = 'info';
                } else {
                    role = 'notifications';
                }
            }

            if (role) {
                targetSender = configuredSenders.find(s => String(s.id).toLowerCase() === role);
            }
        }
    }

    // 3. If target sender found and enabled, return it
    if (targetSender && targetSender.enabled !== false) {
        return {
            email: targetSender.email,
            name: targetSender.name || 'SmartExn'
        };
    }

    // 4. Fallback 1: Configured default sender from settings
    const defaultSender = configuredSenders.find(s => String(s.email).toLowerCase() === String(defaultSenderEmail).toLowerCase());
    if (defaultSender && defaultSender.enabled !== false) {
        return {
            email: defaultSender.email,
            name: defaultSender.name || 'SmartExn'
        };
    }

    // 5. Fallback 2: First enabled approved sender in configured list
    const firstEnabled = configuredSenders.find(s => s.enabled !== false);
    if (firstEnabled) {
        return {
            email: firstEnabled.email,
            name: firstEnabled.name || 'SmartExn'
        };
    }

    // 6. Absolute safety fallback
    return {
        email: DEFAULT_SENDER_EMAIL,
        name: 'SmartExn Notifications'
    };
};

// In-memory idempotency cache for automatic event handling (expires after 60s)
const recentSends = new Map();

// Cached access token for Gmail OAuth
let cachedGmailAccessToken = null;
let gmailAccessTokenExpiresAt = 0;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes an async delivery function with up to maxRetries for transient HTTP failures.
 * Never retries configuration or authentication failures.
 */
const executeWithRetry = async (fn, maxRetries = 2) => {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            // Do NOT retry authentication or configuration errors
            if (err.isConfigError || err.isAuthError || err.status === 400 || err.status === 401 || err.status === 403) {
                throw err;
            }
            if (attempt === maxRetries) {
                throw err;
            }
            const delay = (attempt + 1) * 350;
            console.warn(`[EmailService] Transient delivery failure (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message}. Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
    throw lastError;
};

/**
 * Send email via Resend HTTPS Email API (POST https://api.resend.com/emails)
 * Avoids outbound SMTP port blocking on Render Free.
 */
const sendViaResendHttp = async ({ from, to, subject, html, text }) => {
    const apiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASSWORD && process.env.SMTP_PASSWORD.startsWith('re_') ? process.env.SMTP_PASSWORD : null);
    if (!apiKey) {
        const err = new Error('Resend API key missing: please define RESEND_API_KEY in environment variables');
        err.isConfigError = true;
        throw err;
    }

    const payload = {
        from,
        to: Array.isArray(to) ? to : [to],
        subject: subject || 'Notification from SmartExn',
        html: html || text || '',
        text: text || (html ? html.replace(/<[^>]*>/g, '') : '')
    };

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMsg = data?.message || data?.error || `Resend API returned HTTP ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        if (response.status === 401 || response.status === 403) {
            err.isAuthError = true;
        }
        throw err;
    }

    return {
        messageId: data?.id || `resend_${Date.now()}`
    };
};

/**
 * Retrieve a fresh OAuth access token for Gmail API using server environment credentials
 */
const getGmailAccessToken = async () => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        const err = new Error('Gmail OAuth credentials missing: please define GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in environment variables');
        err.isConfigError = true;
        throw err;
    }

    // Return cached token if valid (with 60-second buffer)
    if (cachedGmailAccessToken && Date.now() < (gmailAccessTokenExpiresAt - 60000)) {
        return cachedGmailAccessToken;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
        const desc = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
        const err = new Error(`Gmail OAuth token refresh failed: ${desc}`);
        err.status = tokenRes.status;
        err.isAuthError = true;
        throw err;
    }

    cachedGmailAccessToken = tokenData.access_token;
    gmailAccessTokenExpiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);
    return cachedGmailAccessToken;
};

/**
 * Send email via Gmail HTTPS API / OAuth users.messages.send
 * Avoids outbound SMTP port blocking on Render Free.
 */
const sendViaGmailHttp = async ({ from, to, subject, html, text, replyTo }) => {
    const accessToken = await getGmailAccessToken();
    const gmailUser = process.env.GMAIL_USER || 'me';

    // Construct standard RFC 2822 email payload
    const boundary = `__boundary_${Date.now()}_${Math.random().toString(36).substring(2)}__`;
    const cleanSubject = (subject || 'Notification from SmartExn').replace(/[\r\n]/g, ' ');
    const encodedSubject = `=?UTF-8?B?${Buffer.from(cleanSubject, 'utf-8').toString('base64')}?=`;

    const headers = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`
    ];

    if (replyTo && replyTo !== from) {
        headers.push(`Reply-To: ${replyTo}`);
    }

    const plainContent = text || (html ? html.replace(/<[^>]*>/g, '') : '');
    const htmlContent = html || text || '';

    const messageLines = [
        headers.join('\r\n'),
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(plainContent, 'utf-8').toString('base64'),
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(htmlContent, 'utf-8').toString('base64'),
        '',
        `--${boundary}--`
    ];

    const rawMime = messageLines.join('\r\n');
    // base64url encoding (RFC 4648 §5) required by Gmail REST API
    const base64UrlRaw = Buffer.from(rawMime, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const sendRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(gmailUser)}/messages/send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: base64UrlRaw })
    });

    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
        const errorDesc = sendData?.error?.message || `Gmail API HTTP ${sendRes.status}`;
        const err = new Error(`Gmail API sending error: ${errorDesc}`);
        err.status = sendRes.status;
        if (sendRes.status === 401 || sendRes.status === 403) {
            err.isAuthError = true;
            cachedGmailAccessToken = null; // Invalidate cached token on auth error
        }
        throw err;
    }

    return {
        messageId: sendData?.id || `gmail_${Date.now()}`
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
        .replace(/re_[a-zA-Z0-9_]{20,}/g, 're_******') // Mask Resend API keys
        .replace(/ya29\.[a-zA-Z0-9_-]+/g, 'ya29.******') // Mask Google OAuth tokens
        .replace(/(pass(word)?|key|secret|token|refresh_token)\s*[:=]\s*["']?[^"'}\s]+["']?/gi, '$1=******');
};

/**
 * Centralized Email Sending Method
 * Handles provider selection, sender resolution, HTTPS delivery, logging, and error tracking.
 * Routes all emails via HTTPS APIs instead of blocked SMTP ports.
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

    // Identify manual admin action or resend to ensure real delivery attempt
    const isManualAction = Boolean(
        sentBy && (
            sentBy === 'Admin' ||
            sentBy === 'Manual' ||
            /admin|manual|resend/i.test(String(sentBy))
        )
    ) || event === 'manual_resend' || event === 'test_email';

    // Idempotency / duplicate protection for automatic event handling (within 60-second window)
    // Admin manual sends and resends always execute without suppression
    const idempotencyKey = `${to}:${event || templateKey || 'none'}:${userId || 'none'}:${subject || ''}`;
    if (!isManualAction) {
        const lastSent = recentSends.get(idempotencyKey);
        if (lastSent && (Date.now() - lastSent < 60000)) {
            console.log(`[EmailService] Duplicate automatic email suppressed within 60s window for ${idempotencyKey}`);
            return {
                success: true,
                messageId: `idempotent_${lastSent}`,
                provider: activeProvider,
                sender: resolvedSender.email,
                duplicateSuppressed: true
            };
        }
    }

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
        let deliveryResult = null;

        if (activeProvider === 'resend') {
            console.log('[EmailService] RESEND_RUNTIME_CONFIG', {
                RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY || (process.env.SMTP_PASSWORD && process.env.SMTP_PASSWORD.startsWith('re_'))),
                API_MODE: 'HTTPS_REST'
            });

            const fromAddress = `"${resolvedSender.name}" <${resolvedSender.email}>`;
            deliveryResult = await executeWithRetry(() => sendViaResendHttp({
                from: fromAddress,
                to,
                subject,
                html,
                text
            }), 2);
        } else {
            console.log('[EmailService] GMAIL_RUNTIME_CONFIG', {
                GMAIL_CLIENT_ID: Boolean(process.env.GMAIL_CLIENT_ID),
                GMAIL_CLIENT_SECRET: Boolean(process.env.GMAIL_CLIENT_SECRET),
                GMAIL_REFRESH_TOKEN: Boolean(process.env.GMAIL_REFRESH_TOKEN),
                GMAIL_USER: Boolean(process.env.GMAIL_USER),
                API_MODE: 'HTTPS_OAUTH_REST'
            });

            const resolvedConfigSender = settings && settings.emailSenderAddress && settings.emailSenderAddress.toLowerCase() !== 'smartexn.com@gmail.com'
                ? settings.emailSenderAddress
                : 'support@smartexn.com';
            const gmailSenderEmail = process.env.GMAIL_USER || resolvedConfigSender;
            const fromAddress = `"${resolvedSender.name}" <${gmailSenderEmail}>`;

            deliveryResult = await executeWithRetry(() => sendViaGmailHttp({
                from: fromAddress,
                to,
                subject,
                html,
                text,
                replyTo: resolvedSender.email
            }), 2);
        }

        const messageId = deliveryResult?.messageId || `msg_${Date.now()}`;

        console.log(`[EmailService] Email delivered successfully via ${activeProvider.toUpperCase()} HTTPS API [${messageId}] to: ${to} (Sender: ${resolvedSender.email})`);

        // Record successful send timestamp for automatic idempotency tracking
        if (!isManualAction) {
            recentSends.set(idempotencyKey, Date.now());
            if (recentSends.size > 1000) {
                const cutoff = Date.now() - 120000;
                for (const [k, v] of recentSends.entries()) {
                    if (v < cutoff) recentSends.delete(k);
                }
            }
        }

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
        let errorMsg = sendError.message || 'Unknown email sending failure';

        // Translate and format specific provider errors for clear diagnostics without exposing secrets
        if (activeProvider === 'resend') {
            if (sendError.isConfigError || errorMsg.includes('Resend API key missing')) {
                errorMsg = 'Resend API key missing: please define RESEND_API_KEY in environment variables';
            } else if (sendError.isAuthError || sendError.status === 401 || sendError.status === 403 || /api key is invalid|unauthorized|forbidden/i.test(errorMsg)) {
                errorMsg = 'Resend API authentication failed. Check your RESEND_API_KEY and domain verification status in Resend dashboard.';
            }
        } else if (activeProvider === 'existing') {
            if (sendError.isConfigError || errorMsg.includes('Gmail OAuth credentials missing')) {
                errorMsg = 'Gmail OAuth credentials missing: please define GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in environment variables';
            } else if (sendError.isAuthError || sendError.status === 401 || sendError.status === 403 || /invalid_grant|unauthorized|invalid_client/i.test(errorMsg)) {
                errorMsg = 'Gmail OAuth authentication failed. Verify GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and refresh token validity in Google Cloud Console.';
            }
        }

        console.error(`[EmailService] Failed to send email via ${activeProvider.toUpperCase()} HTTPS to ${to}:`, errorMsg);

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
