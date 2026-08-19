import { createNotification } from './api';

export interface NotificationEventRule {
    id: string;
    eventName: string;
    category: 'Work & Earn' | 'Investment' | 'Disputes' | 'Finance';
    description: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
    emailSubject: string;
    emailBody: string;
    whatsappTemplate: string;
    placeholders: string[];
}

export const DEFAULT_NOTIFICATION_RULES: Record<string, NotificationEventRule> = {
    TASK_PROOF_SUBMITTED: {
        id: 'TASK_PROOF_SUBMITTED',
        eventName: 'Task Proof Submitted',
        category: 'Work & Earn',
        description: 'Sent when a user submits a proof for a task or campaign gig.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Task Proof Submitted Successfully: {taskTitle}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Your submission for the task <strong>{taskTitle}</strong> has been received!</p>
<p><strong>Task Link:</strong> <a href="{taskLink}">{taskLink}</a></p>
<p><strong>Task Description:</strong> {taskDescription}</p>
<p><strong>Required Proof Format:</strong> {proofRequirements}</p>
<p><strong>Your Submitted Proof Details:</strong> {submittedProof}</p>
<p><strong>Status:</strong> Pending Review (Awaiting Creator / Admin approval)</p>
<p>Thank you for working with SmartEarning Hub!</p>`,
        whatsappTemplate: `📋 *Task Proof Submission Confirmed!*
Hello {userName}, your proof for *{taskTitle}* was received.
*Task Link:* {taskLink}
*Task Description:* {taskDescription}
*Required Proof:* {proofRequirements}
*Your Submitted Proof:* {submittedProof}
*Status:* Pending Review
We will notify you once reviewed.`,
        placeholders: ['{userName}', '{taskTitle}', '{taskLink}', '{taskDescription}', '{proofRequirements}', '{submittedProof}', '{submittedDate}']
    },

    TASK_PROOF_APPROVED: {
        id: 'TASK_PROOF_APPROVED',
        eventName: 'Task Proof Approved',
        category: 'Work & Earn',
        description: 'Sent when a user\'s task submission is approved and reward is credited.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Congratulations! Task Approved & Reward Credited: {taskTitle}',
        emailBody: `<h3>Great News {userName}!</h3>
<p>Your task submission for <strong>{taskTitle}</strong> has been <strong>APPROVED</strong>!</p>
<p><strong>Task Link:</strong> <a href="{taskLink}">{taskLink}</a></p>
<p><strong>Reward Amount Credited:</strong> <span style="color:#059669; font-weight:bold;">\${rewardAmount} USD</span></p>
<p><strong>New Available Wallet Balance:</strong> \${walletBalance} USD</p>
<p>Keep completing tasks to earn more cash!</p>`,
        whatsappTemplate: `🎉 *Task Approved & Reward Credited!*
Hi {userName}, your submission for *{taskTitle}* has been APPROVED!
*Task Link:* {taskLink}
*Reward Credited:* \${rewardAmount} USD
*Updated Wallet Balance:* \${walletBalance} USD
Thank you for your hard work!`,
        placeholders: ['{userName}', '{taskTitle}', '{taskLink}', '{rewardAmount}', '{walletBalance}', '{reviewerNotes}']
    },

    TASK_PROOF_REJECTED: {
        id: 'TASK_PROOF_REJECTED',
        eventName: 'Task Proof Rejected',
        category: 'Work & Earn',
        description: 'Sent when a user\'s task proof is rejected by creator or admin.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Notice Regarding Your Task Submission: {taskTitle}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Your submission for task <strong>{taskTitle}</strong> was <strong>REJECTED</strong>.</p>
<p><strong>Task Link:</strong> <a href="{taskLink}">{taskLink}</a></p>
<p><strong>Rejection Reason / Notes:</strong> {rejectionReason}</p>
<p><strong>Your Submitted Proof:</strong> {submittedProof}</p>
<p>If you believe this rejection is unfair, you can open a dispute from your <a href="{disputeLink}">Disputes & Support Portal</a>.</p>`,
        whatsappTemplate: `⚠️ *Task Submission Rejection Notice*
Hello {userName}, your submission for *{taskTitle}* was rejected.
*Task Link:* {taskLink}
*Rejection Reason:* {rejectionReason}
*Your Proof:* {submittedProof}
You may raise a dispute in Disputes & Support if needed.`,
        placeholders: ['{userName}', '{taskTitle}', '{taskLink}', '{rejectionReason}', '{submittedProof}', '{disputeLink}']
    },

    CAMPAIGN_SUBMITTED_FOR_APPROVAL: {
        id: 'CAMPAIGN_SUBMITTED_FOR_APPROVAL',
        eventName: 'Campaign Submitted for Admin Approval',
        category: 'Work & Earn',
        description: 'Sent when a campaign creator submits a new task campaign for admin approval.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'New Campaign Created & Pending Approval: {campaignTitle}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Your campaign <strong>{campaignTitle}</strong> has been submitted to Admin for verification.</p>
<p><strong>Campaign Link:</strong> <a href="{campaignLink}">{campaignLink}</a></p>
<p><strong>Total Budget Reserved:</strong> \${campaignBudget} USD</p>
<p><strong>Target Worker Spots:</strong> {targetSpots}</p>
<p><strong>Required Proof Instructions:</strong> {proofRequirements}</p>
<p>Status: Awaiting Admin Approval.</p>`,
        whatsappTemplate: `📢 *Campaign Submitted for Approval*
Hi {userName}, your campaign *{campaignTitle}* has been submitted!
*Campaign Link:* {campaignLink}
*Budget:* \${campaignBudget} USD
*Target Spots:* {targetSpots}
*Status:* Awaiting Admin Approval.`,
        placeholders: ['{userName}', '{campaignTitle}', '{campaignLink}', '{campaignBudget}', '{targetSpots}', '{proofRequirements}']
    },

    CAMPAIGN_STATUS_CHANGED: {
        id: 'CAMPAIGN_STATUS_CHANGED',
        eventName: 'Campaign Approval Status Update',
        category: 'Work & Earn',
        description: 'Sent when admin approves or rejects a creator\'s campaign.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Campaign Status Update: {campaignTitle} is {status}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Your campaign <strong>{campaignTitle}</strong> is now <strong>{status}</strong>.</p>
<p><strong>Campaign Link:</strong> <a href="{campaignLink}">{campaignLink}</a></p>
<p><strong>Admin Remarks:</strong> {adminNotes}</p>`,
        whatsappTemplate: `📢 *Campaign Status Update*
Hello {userName}, your campaign *{campaignTitle}* is now *{status}*.
*Campaign Link:* {campaignLink}
*Admin Remarks:* {adminNotes}`,
        placeholders: ['{userName}', '{campaignTitle}', '{campaignLink}', '{status}', '{adminNotes}']
    },

    DISPUTE_OPENED: {
        id: 'DISPUTE_OPENED',
        eventName: 'Dispute Ticket Opened',
        category: 'Disputes',
        description: 'Sent when a user or creator opens a dispute ticket.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Dispute Ticket Raised #{disputeId}: {disputeCategory}',
        emailBody: `<h3>Hello {userName},</h3>
<p>A new dispute ticket <strong>#{disputeId}</strong> was created.</p>
<p><strong>Category:</strong> {disputeCategory}</p>
<p><strong>Module:</strong> {moduleName}</p>
<p><strong>Reference Item:</strong> {referenceItem}</p>
<p><strong>Description:</strong> {disputeDescription}</p>
<p><strong>Dispute Portal:</strong> <a href="{disputeLink}">{disputeLink}</a></p>`,
        whatsappTemplate: `🛡️ *Dispute Ticket Raised #{disputeId}*
Hello {userName}, dispute ticket #{disputeId} has been created.
*Category:* {disputeCategory} ({moduleName})
*Item:* {referenceItem}
*Details:* {disputeDescription}
*Link:* {disputeLink}`,
        placeholders: ['{userName}', '{disputeId}', '{disputeCategory}', '{moduleName}', '{referenceItem}', '{disputeDescription}', '{disputeLink}']
    },

    DISPUTE_REPLIED: {
        id: 'DISPUTE_REPLIED',
        eventName: 'Dispute Reply Received',
        category: 'Disputes',
        description: 'Sent when creator, worker, or admin posts a message in a dispute.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'New Response on Dispute #{disputeId}',
        emailBody: `<h3>Hello {userName},</h3>
<p>There is a new response on your dispute ticket <strong>#{disputeId}</strong> from <strong>{senderRole}</strong>.</p>
<p><strong>Message:</strong> "{replyMessage}"</p>
<p><strong>View Chat & Reply:</strong> <a href="{disputeLink}">{disputeLink}</a></p>`,
        whatsappTemplate: `💬 *New Reply on Dispute #{disputeId}*
Hi {userName}, {senderRole} posted a reply on Dispute #{disputeId}:
"{replyMessage}"
*Reply here:* {disputeLink}`,
        placeholders: ['{userName}', '{disputeId}', '{senderRole}', '{replyMessage}', '{disputeLink}']
    },

    DISPUTE_RESOLVED: {
        id: 'DISPUTE_RESOLVED',
        eventName: 'Dispute Resolved & Final Verdict',
        category: 'Disputes',
        description: 'Sent when admin or creator issues a final verdict on a dispute.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Dispute Resolution Final Verdict #{disputeId}: {verdictStatus}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Dispute ticket <strong>#{disputeId}</strong> has been <strong>{verdictStatus}</strong>.</p>
<p><strong>Official Verdict:</strong> {officialVerdict}</p>
<p><strong>Resolution Notes:</strong> {adminNotes}</p>
<p><strong>Wallet Adjustment / Credited Amount:</strong> \${adjustedAmount} USD</p>
<p><strong>Updated Balance:</strong> \${walletBalance} USD</p>`,
        whatsappTemplate: `⚖️ *Dispute Resolved #{disputeId}*
Hello {userName}, Dispute #{disputeId} has been resolved.
*Status:* {verdictStatus}
*Official Verdict:* {officialVerdict}
*Resolution Notes:* {adminNotes}
*Credited/Adjusted:* \${adjustedAmount} USD
*Current Balance:* \${walletBalance} USD`,
        placeholders: ['{userName}', '{disputeId}', '{verdictStatus}', '{officialVerdict}', '{adminNotes}', '{adjustedAmount}', '{walletBalance}']
    },

    DEPOSIT_STATUS_CHANGED: {
        id: 'DEPOSIT_STATUS_CHANGED',
        eventName: 'Deposit Request Status Update',
        category: 'Finance',
        description: 'Sent when deposit request is approved or rejected.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Deposit Request #{depositId} is {status}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Your deposit of <strong>\${amountUSD} USD</strong> via {paymentMethod} is now <strong>{status}</strong>.</p>
<p><strong>Admin Remarks:</strong> {adminNotes}</p>
<p><strong>Available Balance:</strong> \${walletBalance} USD</p>`,
        whatsappTemplate: `💳 *Deposit Status Update*
Hello {userName}, your deposit of \${amountUSD} USD via {paymentMethod} is now *{status}*.
*Remarks:* {adminNotes}
*Updated Balance:* \${walletBalance} USD`,
        placeholders: ['{userName}', '{depositId}', '{amountUSD}', '{paymentMethod}', '{status}', '{adminNotes}', '{walletBalance}']
    },

    WITHDRAWAL_STATUS_CHANGED: {
        id: 'WITHDRAWAL_STATUS_CHANGED',
        eventName: 'Withdrawal Payout Status Update',
        category: 'Finance',
        description: 'Sent when payout request is approved or rejected.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Withdrawal Payout #{withdrawalId} is {status}',
        emailBody: `<h3>Hello {userName},</h3>
<p>Your withdrawal payout of <strong>\${amountUSD} USD</strong> is now <strong>{status}</strong>.</p>
<p><strong>Payout Method:</strong> {paymentMethod}</p>
<p><strong>Transaction Ref / Remarks:</strong> {adminNotes}</p>`,
        whatsappTemplate: `💸 *Withdrawal Status Update*
Hello {userName}, your payout request of \${amountUSD} USD is now *{status}*.
*Payout Method:* {paymentMethod}
*Ref / Remarks:* {adminNotes}`,
        placeholders: ['{userName}', '{withdrawalId}', '{amountUSD}', '{paymentMethod}', '{status}', '{adminNotes}']
    },

    INVESTMENT_PROFIT_CREDITED: {
        id: 'INVESTMENT_PROFIT_CREDITED',
        eventName: 'Investment Profit Credited',
        category: 'Investment',
        description: 'Sent when daily profit returns from active investment plans are credited.',
        inAppEnabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        emailSubject: 'Investment Profit Credited: \${profitUSD} USD from {planName}',
        emailBody: `<h3>Congratulations {userName}!</h3>
<p>Your daily profit return of <strong style="color:#059669;">\${profitUSD} USD</strong> from plan <strong>{planName}</strong> has been credited to your wallet balance.</p>
<p><strong>Invested Capital:</strong> \${investedCapital} USD</p>
<p><strong>New Wallet Balance:</strong> \${walletBalance} USD</p>`,
        whatsappTemplate: `📈 *Investment Profit Credited!*
Hello {userName}, daily return of *\${profitUSD} USD* from plan *{planName}* was credited to your account!
*Invested Capital:* \${investedCapital} USD
*Updated Wallet Balance:* \${walletBalance} USD`,
        placeholders: ['{userName}', '{planName}', '{profitUSD}', '{investedCapital}', '{walletBalance}']
    }
};

export const replacePlaceholders = (template: string, data: Record<string, any>): string => {
    let result = template || '';
    Object.keys(data).forEach(key => {
        const value = data[key] !== undefined && data[key] !== null ? String(data[key]) : 'N/A';
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(regex, value);
    });
    return result;
};

export const triggerSystemNotification = async (
    ruleKey: string,
    targetUser: { _id: string; username: string; email?: string; whatsapp?: string; phone?: string; walletBalance?: number },
    payload: Record<string, any>,
    settings?: any,
    dispatch?: any
) => {
    try {
        const customRules = settings?.notificationRules || {};
        const rule: NotificationEventRule = customRules[ruleKey] || DEFAULT_NOTIFICATION_RULES[ruleKey];

        if (!rule) return;

        const combinedData = {
            userName: targetUser.username || 'User',
            userEmail: targetUser.email || '',
            userWhatsapp: targetUser.whatsapp || targetUser.phone || '',
            walletBalance: targetUser.walletBalance !== undefined ? targetUser.walletBalance.toFixed(2) : '0.00',
            ...payload
        };

        const emailSubject = replacePlaceholders(rule.emailSubject, combinedData);
        const emailBody = replacePlaceholders(rule.emailBody, combinedData);
        const whatsappMsg = replacePlaceholders(rule.whatsappTemplate, combinedData);

        // 1. In-App Bell & Inbox Notification
        if (rule.inAppEnabled) {
            const notifPayload = {
                userId: targetUser._id,
                title: emailSubject,
                message: emailBody.replace(/<[^>]*>?/gm, ''), // strip html for brief message
                htmlContent: emailBody,
                read: false,
                type: rule.category || 'System',
                date: new Date().toISOString()
            };

            try {
                const res = await createNotification(notifPayload);
                if (dispatch && res?.data) {
                    dispatch({ type: 'ADD_NOTIFICATION', payload: res.data[0] || notifPayload });
                }
            } catch (err) {
                console.warn('In-app notification save warning:', err);
            }
        }

        // 2. Email Notification Dispatch Log & Simulation
        if (rule.emailEnabled && targetUser.email) {
            console.log(`[EMAIL DISPATCH] To: ${targetUser.email} | Subject: "${emailSubject}"`);
        }

        // 3. WhatsApp Notification Link & Trigger
        if (rule.whatsappEnabled && (targetUser.whatsapp || targetUser.phone)) {
            const cleanPhone = (targetUser.whatsapp || targetUser.phone || '').replace(/[^0-9]/g, '');
            const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappMsg)}`;
            console.log(`[WHATSAPP DISPATCH] To: ${cleanPhone} | URL: ${waUrl}`);
        }

        return {
            success: true,
            emailSubject,
            emailBody,
            whatsappMsg
        };
    } catch (error) {
        console.error('Failed to trigger notification:', error);
        return { success: false, error };
    }
};
