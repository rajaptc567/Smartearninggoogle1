import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true,
        enum: [
            'deposit_success_email', 'deposit_success_whatsapp',
            'deposit_rejected_email', 'deposit_rejected_whatsapp',
            'withdrawal_success_email', 'withdrawal_success_whatsapp',
            'withdrawal_rejected_email', 'withdrawal_rejected_whatsapp',
            'general_announcement_email', 'general_announcement_whatsapp',
            'transfer_sent_email', 'transfer_sent_whatsapp',
            'transfer_received_email', 'transfer_received_whatsapp',
            'transfer_request_email', 'transfer_request_whatsapp',
            'transfer_rejected_email', 'transfer_rejected_whatsapp',
            'plan_activated_email', 'plan_activated_whatsapp',
            'referral_signup_email', 'referral_signup_whatsapp',
            'referral_commission_email', 'referral_commission_whatsapp'
        ]
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['email', 'whatsapp'],
        required: true
    },
    subject: {
        type: String,
        default: ''
    },
    body: {
        type: String,
        required: true
    },
    isEnabled: {
        type: Boolean,
        default: true
    },
    graphicTheme: {
        type: String,
        enum: ['default', 'minimalist', 'cosmic', 'emerald_success', 'coral_danger'],
        default: 'default'
    }
}, {
    timestamps: true
});

const defaultTemplates = [
    {
        key: 'deposit_success_email',
        name: 'Deposit Approved (Email)',
        type: 'email',
        subject: '🎉 Deposit of {amount} Approved successfully!',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">💰</span>
        <h2 style="color: #10b981; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Deposit Successful</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">We are pleased to inform you that your deposit of <strong>{amount} {currency}</strong> has been verified and successfully approved!</p>
        
        <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 120px;">Amount:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transaction ID:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #111827;">{txId}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Approved Date:</td>
                    <td style="padding: 4px 0; color: #111827;">{date}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Your wallet balance has been updated immediately. You can now use these funds to purchase investment plans and earn daily returns.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated notification from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'emerald_success'
    },
    {
        key: 'deposit_success_whatsapp',
        name: 'Deposit Approved (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Deposit Approved!* 🟢

Dear @{username} ({fullName}),

We have successfully approved your deposit of *{amount} {currency}*! 💰

*Details:*
🔹 Amount: *{amount} {currency}*
🔹 TxID: \`{txId}\`
🔹 Date: {date}

Your wallet has been credited immediately. You can now purchase your favorite plans!

Best regards,
SmartEarning Team
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'deposit_rejected_email',
        name: 'Deposit Rejected (Email)',
        type: 'email',
        subject: '⚠️ Notice: Deposit Request Rejected',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">❌</span>
        <h2 style="color: #ef4444; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Deposit Rejected</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Your deposit request for <strong>{amount} {currency}</strong> has been rejected by our verification team.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 120px;">Amount:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transaction ID:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #ef4444;">{txId}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Reason:</td>
                    <td style="padding: 4px 0; color: #b91c1c; font-weight: 600;">{notes}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #555555; line-height: 1.5; margin-bottom: 0;">If you believe this was an error, please submit a support dispute or contact support directly with the correct payment receipt.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated security notice from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'coral_danger'
    },
    {
        key: 'deposit_rejected_whatsapp',
        name: 'Deposit Rejected (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Deposit Rejected* 🔴

Dear @{username},

Your deposit request of *{amount} {currency}* has been rejected.

⚠️ *Reason:* {notes}

If this was a mistake, please check your payment credentials or open a dispute under "My Disputes" in your dashboard.

Regards,
SmartEarning Verification Desk
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'withdrawal_success_email',
        name: 'Withdrawal Approved (Email)',
        type: 'email',
        subject: '💸 Payout Successful: Withdrawal Approved!',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">💸</span>
        <h2 style="color: #3b82f6; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Withdrawal Paid</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Great news! Your withdrawal request for <strong>{amount} {currency}</strong> has been processed and paid successfully.</p>
        
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 120px;">Amount Sent:</td>
                    <td style="padding: 4px 0; color: #1e3a8a; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Status:</td>
                    <td style="padding: 4px 0; color: #3b82f6; font-weight: 700;">Paid / Completed</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Date Processed:</td>
                    <td style="padding: 4px 0; color: #111827;">{date}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Please check your target receiving wallet/bank account. Thank you for choosing SmartEarning!</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated notification from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'cosmic'
    },
    {
        key: 'withdrawal_success_whatsapp',
        name: 'Withdrawal Approved (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Payout Transferred!* 💸

Dear @{username},

Your withdrawal request of *{amount} {currency}* has been successfully completed and paid! ✅

Thank you for choosing SmartEarning to build your secure network wealth.

Best regards,
SmartEarning team
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'withdrawal_rejected_email',
        name: 'Withdrawal Rejected (Email)',
        type: 'email',
        subject: '❌ Withdrawal Request Rejected',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">⚠️</span>
        <h2 style="color: #ea580c; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Withdrawal Rejected</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Your withdrawal request for <strong>{amount} {currency}</strong> has been rejected by our accounting desk.</p>
        
        <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 120px;">Amount:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Rejection Reason:</td>
                    <td style="padding: 4px 0; color: #c2410c; font-weight: 600;">{notes}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #555555; line-height: 1.5; margin-bottom: 0;">The requested funds have been refunded back to your available wallet. Please make sure you have completed all mandatory verification tasks or check your account withdrawal details and try again.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated notification from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'coral_danger'
    },
    {
        key: 'withdrawal_rejected_whatsapp',
        name: 'Withdrawal Rejected (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Withdrawal Rejected* ⚠️

Dear @{username},

Your withdrawal request of *{amount} {currency}* has been rejected.

📌 *Reason:* {notes}

The funds have been returned to your wallet. Please verify your billing details or complete pending tasks before requesting again.

Best regards,
SmartEarning Accounting
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'transfer_sent_email',
        name: 'Money Transfer Sent (Email)',
        type: 'email',
        subject: '💸 Funds Transferred: {amount} {currency} Sent Successfully',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">💸</span>
        <h2 style="color: #4f46e5; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Transfer Sent Successfully</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Your peer-to-peer transfer of <strong>{amount} {currency}</strong> has been successfully processed and delivered.</p>
        
        <div style="background-color: #faf5ff; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Recipient Username:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">@{recipientUsername}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Recipient Name:</td>
                    <td style="padding: 4px 0; color: #111827;">{recipientFullName}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Amount Sent:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Processing Fee:</td>
                    <td style="padding: 4px 0; color: #6b7280;">{fee} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Total Deducted:</td>
                    <td style="padding: 4px 0; color: #b91c1c; font-weight: 700;">{totalDeducted} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transfer ID:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #111827;">{txId}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">The recipient's wallet balance has been updated in real-time. Thank you for utilizing our peer-to-peer network routing.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated security notice from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'cosmic'
    },
    {
        key: 'transfer_sent_whatsapp',
        name: 'Money Transfer Sent (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - P2P Transfer Sent* 💸

Dear @{username},

Your transfer of *{amount} {currency}* to *@{recipientUsername}* has been sent successfully.

🔹 Recipient: @{recipientUsername} ({recipientFullName})
🔹 Net Amount: *{amount} {currency}*
🔹 Fee: {fee} {currency}
🔹 Total Deducted: *{totalDeducted} {currency}*
🔹 TxID: \`{txId}\`

Thank you for choosing SmartEarning.
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'transfer_received_email',
        name: 'Money Transfer Received (Email)',
        type: 'email',
        subject: '🎁 Funds Received: You got {amount} {currency} from @{senderUsername}!',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">🎁</span>
        <h2 style="color: #059669; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">You Received Funds</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">We are pleased to inform you that another member has transferred funds directly to your wallet!</p>
        
        <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Sender Username:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">@{senderUsername}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Sender Full Name:</td>
                    <td style="padding: 4px 0; color: #111827;">{senderFullName}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Amount Received:</td>
                    <td style="padding: 4px 0; color: #059669; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Date Received:</td>
                    <td style="padding: 4px 0; color: #111827;">{date}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transfer ID:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #111827;">{txId}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Your wallet balance has been updated instantly. These funds can be used immediately to activate any investment plan or make withdrawals.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated credit alert from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'emerald_success'
    },
    {
        key: 'transfer_received_whatsapp',
        name: 'Money Transfer Received (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - P2P Transfer Received* 📥

Dear @{username},

You have received *{amount} {currency}* from @{senderUsername} ({senderFullName}).

🔹 Sender: @{senderUsername}
🔹 Amount Credit: *{amount} {currency}*
🔹 Date: {date}
🔹 TxID: \`{txId}\`

Your wallet balance is updated immediately.
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'transfer_request_email',
        name: 'Money Transfer Initiated/Requested (Email)',
        type: 'email',
        subject: '⏳ Pending: Money Transfer Requested for {amount} {currency}',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">⏳</span>
        <h2 style="color: #d97706; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Transfer Pending Verification</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Your request to transfer funds to another user has been received and is currently in verification status.</p>
        
        <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Recipient Username:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">@{recipientUsername}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transfer Amount:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Estimated Fee:</td>
                    <td style="padding: 4px 0; color: #6b7280;">{fee} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Total Reserved:</td>
                    <td style="padding: 4px 0; color: #b91c1c; font-weight: 700;">{totalDeducted} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transfer ID:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #111827;">{txId}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Our system will verify the ledger authenticity of this peer routing and execute the balance update. You will receive an immediate confirmation once approved.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated ledger lock notice from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'transfer_request_whatsapp',
        name: 'Money Transfer Initiated/Requested (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - P2P Transfer Registered* ⏳

Dear @{username},

We have received your request to transfer *{amount} {currency}* to *@{recipientUsername}*.

This transaction is pending ledger clearance. 

🔹 Amount: *{amount} {currency}*
🔹 Total Reserved: *{totalDeducted} {currency}*
🔹 TxID: \`{txId}\`

Thank you for choosing SmartEarning.
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'transfer_rejected_email',
        name: 'Money Transfer Rejected (Email)',
        type: 'email',
        subject: '❌ Transfer Request Cancelled / Rejected',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">⚠️</span>
        <h2 style="color: #dc2626; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Transfer Request Cancelled</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Your peer-to-peer transfer request for <strong>{amount} {currency}</strong> has been cancelled or rejected by our verification team.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Recipient:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">@{recipientUsername}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transfer Amount:</td>
                    <td style="padding: 4px 0; color: #111827;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Reason:</td>
                    <td style="padding: 4px 0; color: #b91c1c; font-weight: 600;">{notes}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Transfer ID:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #111827;">{txId}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #555555; line-height: 1.5; margin-bottom: 0;">The total reserved amount (including fees) has been refunded immediately back to your wallet balance. Please review the recipient details and account restrictions and try again.</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated ledger refund notice from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'coral_danger'
    },
    {
        key: 'transfer_rejected_whatsapp',
        name: 'Money Transfer Rejected (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Transfer Cancelled* 🔴

Dear @{username},

Your request to transfer *{amount} {currency}* to *@{recipientUsername}* was cancelled/rejected.

⚠️ *Reason:* {notes}

The full reserved amount has been refunded back to your wallet balance.
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'plan_activated_email',
        name: 'Investment Plan Activated (Email)',
        type: 'email',
        subject: '🚀 High Yield Plan Activated: {planName} Activated!',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">🚀</span>
        <h2 style="color: #6366f1; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Plan Activated Successfully</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Congratulations! Your investment plan has been registered and is now actively accumulating daily yields.</p>
        
        <div style="background-color: #f5f3ff; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Selected Plan:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{planName}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Plan Price:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">{price} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Activation Date:</td>
                    <td style="padding: 4px 0; color: #111827;">{purchaseDate}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Earnings will be credited to your available wallet balance according to your plan configuration. Start referring other creators to accelerate your network commission tiers!</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated asset management notice from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'cosmic'
    },
    {
        key: 'plan_activated_whatsapp',
        name: 'Investment Plan Activated (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Plan Activated!* 🚀

Dear @{username},

Your purchase/activation of *{planName}* has been successfully processed!

🔹 Selected Plan: *{planName}*
🔹 Cost: *{price} {currency}*
🔹 Date: {purchaseDate}

Your active mining/earning algorithm has started. Thank you for choosing SmartEarning!
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'referral_signup_email',
        name: 'New Referral Joined (Email)',
        type: 'email',
        subject: '👥 New Team Member: @{referralUsername} joined your network!',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">👥</span>
        <h2 style="color: #4f46e5; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Network Expansion Alert</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Great news! A new member has signed up using your sponsor link and is now part of your direct network team.</p>
        
        <div style="background-color: #f5f3ff; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Referral Username:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">@{referralUsername}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Referral Name:</td>
                    <td style="padding: 4px 0; color: #111827;">{referralFullName}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Registration Date:</td>
                    <td style="padding: 4px 0; color: #111827;">{date}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Guide your new teammate to activate an investment plan. When they purchase plans, you will receive real-time direct commission payouts immediately!</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated team development notification from SmartEarning support.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'cosmic'
    },
    {
        key: 'referral_signup_whatsapp',
        name: 'New Referral Joined (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - New Network Signup!* 👥

Dear @{username},

Great news! *@{referralUsername}* ({referralFullName}) has registered as your direct referral.

Encourage them to buy investment plans so you can earn instant direct sponsor commissions.

Best regards,
SmartEarning Affiliate Desk
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    },
    {
        key: 'referral_commission_email',
        name: 'Referral Commission Earned (Email)',
        type: 'email',
        subject: '💰 Commission Earned: You got {amount} {currency} from @{referralUsername}!',
        body: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8ed;">
    <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 48px;">💰</span>
        <h2 style="color: #10b981; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Affiliate Commission Earned</h2>
    </div>
    <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 16px; color: #333333; margin-top: 0;">Hello <strong>@{username}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.6;">Success! You have earned an affiliate network commission from your referral's account activity.</p>
        
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: #4b5563;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 600; width: 140px;">Commission Earned:</td>
                    <td style="padding: 4px 0; color: #10b981; font-weight: 700;">{amount} {currency}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Triggered By Referral:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">@{referralUsername}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Plan Purchased:</td>
                    <td style="padding: 4px 0; color: #111827;">{planName}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Network Level:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 700;">Level {level}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Date Credited:</td>
                    <td style="padding: 4px 0; color: #111827;">{date}</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">Depending on your account restrictions, this commission has been credited directly to your available wallet or stored in locked status. Keep expanding your network team to increase daily dividends!</p>
    </div>
    <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This is an automated commission credit notification from SmartEarning.</p>
        <p style="margin: 5px 0 0 0;">&copy; 2026 SmartEarning Platform. All rights reserved.</p>
    </div>
</div>
        `.trim(),
        isEnabled: true,
        graphicTheme: 'emerald_success'
    },
    {
        key: 'referral_commission_whatsapp',
        name: 'Referral Commission Earned (WhatsApp)',
        type: 'whatsapp',
        subject: '',
        body: `
*SmartEarning - Commission Earned!* 💰

Dear @{username},

You have successfully received an affiliate commission of *{amount} {currency}*!

🔹 Referral: *@{referralUsername}*
🔹 Plan: *{planName}*
🔹 Level: *Level {level}*
🔹 Commission: *{amount} {currency}*
🔹 Date: {date}

Your affiliate team continues to grow. Keep it up!
        `.trim(),
        isEnabled: true,
        graphicTheme: 'default'
    }
];

TemplateSchema.statics.getTemplates = async function() {
    let templates = await this.find();
    if (!templates || templates.length === 0) {
        templates = await this.insertMany(defaultTemplates);
    } else {
        const existingKeys = templates.map(t => t.key);
        const missingTemplates = defaultTemplates.filter(t => !existingKeys.includes(t.key));
        if (missingTemplates.length > 0) {
            await this.insertMany(missingTemplates);
            templates = await this.find();
        }
    }
    return templates;
};

export default mongoose.model('Template', TemplateSchema);
