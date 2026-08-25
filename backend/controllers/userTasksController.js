import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import Withdrawal from '../models/Withdrawal.js';
import { sendTemplateNotification } from '../utils/automation.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getUserTasks = async (req, res) => {
    try {
        const tasks = await UserTask.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createUserTask = async (req, res) => {
    try {
        const { 
            userId, category, subType, title, description, link, targetQuantity, rewardPerTask,
            requireTextProof, textProofInstruction,
            requireUsername, usernameInstruction,
            requireUserId, userIdInstruction,
            requireEmail, emailInstruction,
            requireScreenshot, screenshotInstruction,
            requiredProofs
        } = req.body;

        const effectiveUserId = (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') 
            ? req.user.id 
            : (userId || req.user?.id);

        if (!effectiveUserId) {
            return res.status(400).json({ success: false, error: 'User ID is required.' });
        }

        if (link) {
            const urlString = String(link).trim();
            if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
                return res.status(400).json({ success: false, error: 'Task URL must start with http:// or https://' });
            }
        }

        const qtyNum = Number(targetQuantity);
        const rewardNum = Number(rewardPerTask);
        if (isNaN(qtyNum) || !isFinite(qtyNum) || qtyNum <= 0 || isNaN(rewardNum) || !isFinite(rewardNum) || rewardNum <= 0) {
            return res.status(400).json({ success: false, error: 'Target quantity and reward per task must be valid positive numbers.' });
        }
        
        const settings = await Setting.getSettings();
        if (settings.isUserTaskEnabled === false) {
            return res.status(400).json({ success: false, error: 'User task submissions are currently disabled by administrator.' });
        }

        const presets = settings.taskCategoryPresets;
        if (presets) {
            const catLower = category.toLowerCase();
            const platKey = catLower === 'website' ? 'paidSignUp' : catLower;
            const platformConfig = presets[platKey];
            if (platformConfig && platformConfig.enabled === false) {
                return res.status(400).json({ success: false, error: `${category} category is currently disabled by administrator.` });
            }

            // Subtype checks
            let subtypeEnabled = true;
            if (platKey === 'youtube') {
                if (subType === 'Subscribe' && presets.youtube?.subscriber?.enabled === false) subtypeEnabled = false;
                if (subType === 'Like' && presets.youtube?.likes?.enabled === false) subtypeEnabled = false;
                if (subType === 'Comment' && presets.youtube?.comments?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'facebook') {
                if (subType === 'Follow' && presets.facebook?.likeFollow?.enabled === false) subtypeEnabled = false;
                if (subType === 'Like' && presets.facebook?.videoLike?.enabled === false) subtypeEnabled = false;
                if (subType === 'Comment' && presets.facebook?.comments?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'instagram') {
                if (subType === 'Follow' && presets.instagram?.profileFollow?.enabled === false) subtypeEnabled = false;
                if (subType === 'Like' && presets.instagram?.postLike?.enabled === false) subtypeEnabled = false;
                if (subType === 'Comment' && presets.instagram?.comments?.enabled === false) subtypeEnabled = false;
                if (subType === 'Watch Time' && presets.instagram?.reelView?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'google') {
                if (subType === 'Review' && presets.google?.reviews?.enabled === false) subtypeEnabled = false;
            } else if (platKey === 'paidSignUp') {
                if (subType === 'Sign-up' && presets.paidSignUp?.simpleSignUp?.enabled === false) subtypeEnabled = false;
                if (subType === 'Other' && presets.paidSignUp?.activePlanPurchase?.enabled === false) subtypeEnabled = false;
            } else if (platformConfig) {
                // Check custom subcategory/subType
                const subKey = Object.keys(platformConfig).find(k => k.toLowerCase() === subType.toLowerCase() || (platformConfig[k] && platformConfig[k].displayName && platformConfig[k].displayName.toLowerCase() === subType.toLowerCase()));
                if (subKey && platformConfig[subKey] && platformConfig[subKey].enabled === false) {
                    subtypeEnabled = false;
                }
            }

            if (!subtypeEnabled) {
                return res.status(400).json({ success: false, error: `The micro-service ${subType} for ${category} is currently disabled by administrator.` });
            }
        }

        const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10, campaignFeeEnabled: false, campaignFeeAmount: 1.00 };
        if (targetQuantity < config.minQuantity) {
            return res.status(400).json({ success: false, error: `Minimum target quantity is ${config.minQuantity}.` });
        }
        if (rewardPerTask < config.minRewardAmount) {
            return res.status(400).json({ success: false, error: `Minimum reward amount per task is ${config.minRewardAmount} USD.` });
        }

        const user = await User.findById(effectiveUserId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // Entire setup in USD
        const subtotal = targetQuantity * rewardPerTask;
        const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
        const totalBudget = Number((subtotal + adminCommission).toFixed(2));

        // Upfront Deduction Base Fee logic
        const baseFeeCharged = config.campaignFeeEnabled ? (config.campaignFeeAmount || 0) : 0;
        const totalAmountUSD = Number((totalBudget + baseFeeCharged).toFixed(2));

        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        let deductionInUserCurr = totalAmountUSD * (rates[userCurr] || 1);
        deductionInUserCurr = Number(deductionInUserCurr.toFixed(2));

        let deductedFromTaskWallet = false;
        let sourceFromInvestment = 0;
        let sourceFromTaskEarnings = 0;
        let sourceFromRefunds = 0;

        if ((user.taskWalletBalance || 0) >= totalAmountUSD) {
            // Track source composition from campaignWalletSources
            const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
            let remainingToDeduct = totalAmountUSD;

            // 1. Consume fromRefunds first
            const deductRefunds = Math.min(curSources.fromRefundsUSD || 0, remainingToDeduct);
            sourceFromRefunds = deductRefunds;
            remainingToDeduct = Number((remainingToDeduct - deductRefunds).toFixed(2));

            // 2. Consume fromInvestment next
            const deductInv = Math.min(curSources.fromInvestmentUSD || 0, remainingToDeduct);
            sourceFromInvestment = deductInv;
            remainingToDeduct = Number((remainingToDeduct - deductInv).toFixed(2));

            // 3. Consume fromTaskEarnings next
            const deductEarn = Math.min(curSources.fromTaskEarningsUSD || 0, remainingToDeduct);
            sourceFromTaskEarnings = deductEarn;
            remainingToDeduct = Number((remainingToDeduct - deductEarn).toFixed(2));

            // If any leftover due to older unstratified balance, assign to investment
            if (remainingToDeduct > 0) {
                sourceFromInvestment = Number((sourceFromInvestment + remainingToDeduct).toFixed(2));
            }

            user.campaignWalletSources = {
                fromInvestmentUSD: Math.max(0, Number(((curSources.fromInvestmentUSD || 0) - sourceFromInvestment).toFixed(2))),
                fromTaskEarningsUSD: Math.max(0, Number(((curSources.fromTaskEarningsUSD || 0) - sourceFromTaskEarnings).toFixed(2))),
                fromRefundsUSD: Math.max(0, Number(((curSources.fromRefundsUSD || 0) - sourceFromRefunds).toFixed(2)))
            };

            user.taskWalletBalance = Number(((user.taskWalletBalance || 0) - totalAmountUSD).toFixed(2));
            deductedFromTaskWallet = true;
        } else if (user.walletBalance >= deductionInUserCurr) {
            user.walletBalance = Number((user.walletBalance - deductionInUserCurr).toFixed(2));
            sourceFromInvestment = totalAmountUSD;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient Task Wallet balance. Required: $${totalAmountUSD} USD, Available Task Wallet: $${(user.taskWalletBalance || 0).toFixed(2)} USD` 
            });
        }

        // Save user balance updates
        await user.save();

        const task = await UserTask.create({
            userId: user._id,
            userName: user.username,
            category,
            subType: subType || 'Like',
            title,
            description,
            link,
            targetQuantity,
            rewardPerTask,
            totalBudget,
            adminCommission,
            baseFeeCharged,
            fundingSourceBreakdown: {
                fromInvestmentUSD: sourceFromInvestment,
                fromTaskEarningsUSD: sourceFromTaskEarnings,
                fromRefundsUSD: sourceFromRefunds
            },
            currency: 'USD',
            requireTextProof: Boolean(requireTextProof),
            textProofInstruction: textProofInstruction || '',
            requireUsername: Boolean(requireUsername),
            usernameInstruction: usernameInstruction || '',
            requireUserId: Boolean(requireUserId),
            userIdInstruction: userIdInstruction || '',
            requireEmail: Boolean(requireEmail),
            emailInstruction: emailInstruction || '',
            requireScreenshot: requireScreenshot !== undefined ? Boolean(requireScreenshot) : true,
            screenshotInstruction: screenshotInstruction || 'Please upload screenshot proof of completion.',
            requiredProofs: requiredProofs || [],
            status: 'Pending'
        });

        // Create transaction with full source and destination tracking
        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: deductedFromTaskWallet ? 'USD' : userCurr,
            type: 'Task Budget Deduction',
            amount: -(deductedFromTaskWallet ? totalAmountUSD : deductionInUserCurr),
            amountUSD: totalAmountUSD,
            campaignId: task._id,
            sourceWallet: deductedFromTaskWallet ? 'CampaignFunds' : 'Investment',
            destinationWallet: 'CampaignEscrow',
            sourceBreakdown: {
                fromInvestmentUSD: sourceFromInvestment,
                fromTaskEarningsUSD: sourceFromTaskEarnings,
                fromRefundsUSD: sourceFromRefunds
            },
            description: `Submitted User Task: ${title} (Budget + Base Fee of ${baseFeeCharged} USD)`,
            status: 'Approved'
        });

        // Send Notification to Campaign Creator
        await Notification.create({
            userId: user._id,
            subject: 'Campaign Submitted ⏳',
            message: `Your campaign "${task.title}" has been successfully submitted for Admin approval. It will go live once reviewed.`,
            senderType: 'System'
        });

        // Send Email & WhatsApp automated templates
        sendTemplateNotification({
            userId: user._id,
            templateKey: 'task_campaign_created_email',
            variables: {
                taskTitle: task.title,
                amount: totalAmountUSD,
                currency: 'USD',
                txId: task._id.toString()
            }
        }).catch(err => console.error('Failed to send campaign created email:', err));

        sendTemplateNotification({
            userId: user._id,
            templateKey: 'task_campaign_created_whatsapp',
            variables: {
                taskTitle: task.title,
                amount: totalAmountUSD,
                currency: 'USD',
                txId: task._id.toString()
            }
        }).catch(err => console.error('Failed to send campaign created whatsapp:', err));

        // Send Notification to Admins
        try {
            const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
            for (const admin of admins) {
                await Notification.create({
                    userId: admin._id,
                    subject: 'New Campaign Submission 📋',
                    message: `User @${user.username} has submitted a new campaign "${task.title}" for review.`,
                    senderType: 'System'
                });
            }
        } catch (adminErr) {
            console.error('Failed to notify admins of new campaign:', adminErr);
        }

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { task, user } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateUserTaskStatus = async (req, res) => {
    try {
        const { status, adminNotes, reviewRequested, userReviewMessage } = req.body;
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Campaign not found.' });

        // Check ownership & authorization
        if (req.user) {
            const isOwner = task.userId?.toString() === req.user.id?.toString();
            const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to modify this campaign.' });
            }
        }

        // If user is requesting a one-time review
        if (reviewRequested === true) {
            if (task.status !== 'Rejected') {
                return res.status(400).json({ success: false, error: 'Only rejected campaigns can be submitted for review.' });
            }
            if (task.resubmittedForReview === true) {
                return res.status(400).json({ success: false, error: 'This campaign has already been submitted for a one-time review.' });
            }

            const user = await User.findById(task.userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'Campaign creator not found.' });
            }

            const settings = await Setting.getSettings();
            const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10, campaignFeeEnabled: false, campaignFeeAmount: 1.00 };
            
            // Re-calculate budget to deduct
            const subtotal = task.targetQuantity * task.rewardPerTask;
            const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
            const totalBudget = Number((subtotal + adminCommission).toFixed(2));

            // Upfront Deduction Base Fee logic for resubmission
            const baseFeeCharged = config.campaignFeeEnabled ? (config.campaignFeeAmount || 0) : 0;
            const totalAmountUSD = Number((totalBudget + baseFeeCharged).toFixed(2));

            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
            const userCurr = user.currency || 'USD';
            let deductionInUserCurr = totalAmountUSD * (rates[userCurr] || 1);
            deductionInUserCurr = Number(deductionInUserCurr.toFixed(2));

            if (user.walletBalance < deductionInUserCurr) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Insufficient wallet balance to re-submit campaign. Required: ${deductionInUserCurr} ${userCurr} (${totalAmountUSD} USD: ${totalBudget} Budget + ${baseFeeCharged} Base Fee), Available: ${user.walletBalance} ${userCurr}` 
                });
            }

            // Deduct from wallet
            user.walletBalance = Number((user.walletBalance - deductionInUserCurr).toFixed(2));
            await user.save();

            // Create budget deduction transaction
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: userCurr,
                type: 'Task Budget Deduction',
                amount: -deductionInUserCurr,
                description: `Resubmitted User Task For Review (USD): ${task.title} (Budget + Base Fee of ${baseFeeCharged} USD)`,
                status: 'Approved'
            });

            // Set state to pending review
            task.status = 'Pending';
            task.reviewRequested = true;
            task.resubmittedForReview = true;
            task.baseFeeCharged = baseFeeCharged; // Update stored fee charged
            task.userReviewMessage = userReviewMessage || '';
            task.adminNotes = ''; // Clear previous rejection notes

            if (!task.history) task.history = [];
            task.history.push({
                action: 'Resubmitted For Review',
                previousStatus: 'Rejected',
                newStatus: 'Pending',
                timestamp: new Date(),
                performedBy: req.user ? req.user.id.toString() : task.userId.toString(),
                details: userReviewMessage || 'Campaign resubmitted for admin review.'
            });

            await task.save();

            // Send notification to creator
            await Notification.create({
                userId: user._id,
                subject: 'Campaign Resubmitted 🔄',
                message: `Your campaign "${task.title}" has been resubmitted for a final one-time review. If approved, it will go live immediately.`,
                senderType: 'System'
            });

            // Send notification to Admins
            try {
                const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
                for (const admin of admins) {
                    await Notification.create({
                        userId: admin._id,
                        subject: 'Resubmitted Campaign for Review 🔄',
                        message: `User @${user.username} has resubmitted their campaign "${task.title}" with notes: "${userReviewMessage || ''}"`,
                        senderType: 'System'
                    });
                }
            } catch (adminErr) {
                console.error('Failed to notify admins of campaign resubmission:', adminErr);
            }

            global.appDataVersion = Date.now();
            return res.status(200).json({ success: true, message: 'Campaign resubmitted for review successfully.', data: { task, user } });
        }

        // Core Rules Edit Blocked validation
        const coreFields = [
            'category', 'subType', 'title', 'description', 'link', 'targetQuantity', 'rewardPerTask',
            'requireTextProof', 'textProofInstruction', 'requireUsername', 'usernameInstruction',
            'requireUserId', 'userIdInstruction', 'requireEmail', 'emailInstruction',
            'requireScreenshot', 'screenshotInstruction'
        ];
        
        const isAttemptingToEditCore = coreFields.some(field => req.body[field] !== undefined && req.body[field] !== task[field]);
        if (isAttemptingToEditCore) {
            return res.status(400).json({ 
                success: false, 
                error: '🔒 Edit Blocked: Campaign core rules (payout, link, category, platform, limits) cannot be edited once created.' 
            });
        }

        const oldStatus = task.status;
        const requestedStatus = status || task.status;

        // Validations for Pause
        if (requestedStatus === 'On Hold') {
            if (oldStatus === 'On Hold') {
                return res.status(400).json({ success: false, error: 'Campaign is already paused.' });
            }
            if (oldStatus !== 'Approved' && oldStatus !== 'Active') {
                return res.status(400).json({ success: false, error: 'Unable to pause campaign.' });
            }
        }

        task.status = requestedStatus;
        if (adminNotes !== undefined) task.adminNotes = adminNotes;

        // Clear reviewRequested if status changed by admin/creator
        if (requestedStatus === 'Approved' || requestedStatus === 'Rejected') {
            task.reviewRequested = false;
        }

        // Record in Campaign History
        if (!task.history) task.history = [];
        let historyAction = 'Status Changed';
        let historyDetails = `Campaign status changed from ${oldStatus} to ${requestedStatus}`;

        if (requestedStatus === 'On Hold') {
            historyAction = 'Paused';
            historyDetails = 'Campaign paused by owner.';
        } else if ((requestedStatus === 'Approved' || requestedStatus === 'Active') && oldStatus === 'On Hold') {
            historyAction = 'Resumed';
            historyDetails = 'Campaign resumed by owner.';
        } else if (requestedStatus === 'Approved' && oldStatus !== 'Approved') {
            historyAction = 'Approved';
            historyDetails = 'Campaign approved by admin.';
        } else if (requestedStatus === 'Rejected' && oldStatus !== 'Rejected') {
            historyAction = 'Rejected';
            historyDetails = `Campaign rejected. Reason: ${adminNotes || 'No reason specified.'}`;
        }

        task.history.push({
            action: historyAction,
            previousStatus: oldStatus,
            newStatus: requestedStatus,
            timestamp: new Date(),
            performedBy: req.user ? req.user.id.toString() : task.userId.toString(),
            details: historyDetails
        });

        // If rejected and was pending/approved (not yet paid/completed refund), refund user to Campaign Wallet (taskWalletBalance)
        if (requestedStatus === 'Rejected' && oldStatus !== 'Rejected' && oldStatus !== 'Paid') {
            const user = await User.findById(task.userId);
            if (user) {
                const settings = await Setting.getSettings();
                const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
                const userCurr = user.currency || 'USDT';
                
                const baseFee = task.baseFeeCharged || 0;
                const totalRefundUSD = Number((task.totalBudget + baseFee).toFixed(2));

                let refundInUserCurr = totalRefundUSD * (rates[userCurr] || 1);
                refundInUserCurr = Number(refundInUserCurr.toFixed(2));

                // Refund directly to Task Wallet Balance in USD and restore source attribution to campaignWalletSources
                user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + totalRefundUSD).toFixed(2));
                const taskFunding = task.fundingSourceBreakdown || { fromInvestmentUSD: totalRefundUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                user.campaignWalletSources = {
                    fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + (taskFunding.fromInvestmentUSD || 0)).toFixed(2)),
                    fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + (taskFunding.fromTaskEarningsUSD || 0)).toFixed(2)),
                    fromRefundsUSD: Number(((curSources.fromRefundsUSD || 0) + (taskFunding.fromRefundsUSD || 0)).toFixed(2))
                };
                task.refundedBreakdown = {
                    fromInvestmentUSD: taskFunding.fromInvestmentUSD || 0,
                    fromTaskEarningsUSD: taskFunding.fromTaskEarningsUSD || 0,
                    fromRefundsUSD: taskFunding.fromRefundsUSD || 0
                };
                await user.save();
                await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: 'USD',
                    type: 'Task Refund',
                    amount: totalRefundUSD,
                    amountUSD: totalRefundUSD,
                    campaignId: task._id,
                    sourceWallet: 'CampaignEscrow',
                    destinationWallet: 'CampaignFunds',
                    sourceBreakdown: {
                        fromInvestmentUSD: taskFunding.fromInvestmentUSD || 0,
                        fromTaskEarningsUSD: taskFunding.fromTaskEarningsUSD || 0,
                        fromRefundsUSD: taskFunding.fromRefundsUSD || 0
                    },
                    description: `Refund for rejected user task credited to Campaign Wallet: ${task.title} ($${totalRefundUSD.toFixed(2)} USD)`,
                    status: 'Approved'
                });
            }
        }

        await task.save();

        // System notifications & Audit Logging
        if (requestedStatus === 'On Hold' && oldStatus !== 'On Hold') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Paused ⏸',
                message: `Your campaign "${task.title}" has been paused. Workers will not be able to join or submit new tasks until you resume it.`,
                senderType: 'System'
            });
            try {
                await Log.create({
                    action: 'CAMPAIGN_PAUSED',
                    affectedUser: task.userName,
                    details: `Campaign "${task.title}" (ID: ${task._id}) paused`,
                    performedBy: req.user ? (req.user.username || req.user.id) : 'owner'
                });
            } catch (logErr) {
                console.error('Failed to write Log:', logErr);
            }
        } else if ((requestedStatus === 'Approved' || requestedStatus === 'Active') && oldStatus === 'On Hold') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Resumed ▶',
                message: `Your campaign "${task.title}" has been resumed and is now active for workers to complete.`,
                senderType: 'System'
            });
            try {
                await Log.create({
                    action: 'CAMPAIGN_RESUMED',
                    affectedUser: task.userName,
                    details: `Campaign "${task.title}" (ID: ${task._id}) resumed`,
                    performedBy: req.user ? (req.user.username || req.user.id) : 'owner'
                });
            } catch (logErr) {
                console.error('Failed to write Log:', logErr);
            }
        } else if (requestedStatus === 'Approved' && oldStatus !== 'Approved' && oldStatus !== 'On Hold') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Approved! 🟢',
                message: `Congratulations! Your campaign "${task.title}" has been approved and is now live for workers to complete.`,
                senderType: 'System'
            });

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_approved_email',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString()
                }
            }).catch(err => console.error('Failed to send campaign approved email:', err));

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_approved_whatsapp',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString()
                }
            }).catch(err => console.error('Failed to send campaign approved whatsapp:', err));

        } else if (requestedStatus === 'Rejected' && oldStatus !== 'Rejected') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Rejected ❌',
                message: `Your campaign "${task.title}" was rejected by the Admin. Reason: ${adminNotes || 'No reason specified'}.`,
                senderType: 'System'
            });

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_rejected_email',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString(),
                    notes: adminNotes || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send campaign rejected email:', err));

            sendTemplateNotification({
                userId: task.userId,
                templateKey: 'task_campaign_rejected_whatsapp',
                variables: {
                    taskTitle: task.title,
                    amount: task.totalBudget,
                    currency: 'USD',
                    txId: task._id.toString(),
                    notes: adminNotes || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send campaign rejected whatsapp:', err));
        }

        global.appDataVersion = Date.now();
        const successMsg = requestedStatus === 'On Hold'
            ? 'Campaign paused successfully.'
            : (oldStatus === 'On Hold' ? 'Campaign resumed successfully.' : 'Campaign updated successfully.');

        return res.status(200).json({ success: true, message: successMsg, data: task });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteUserTask = async (req, res) => {
    try {
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        if (req.user) {
            const isOwner = String(task.userId) === String(req.user.id);
            const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to delete this campaign.' });
            }
        }

        const user = await User.findById(task.userId);
        if (user) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
            const userCurr = user.currency || 'USDT';

            // If pending, refund the ENTIRE budget to Task Wallet
            if (task.status === 'Pending') {
                const baseFee = task.baseFeeCharged || 0;
                const totalRefundUSD = Number((task.totalBudget + baseFee).toFixed(2));

                user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + totalRefundUSD).toFixed(2));
                const taskFunding = task.fundingSourceBreakdown || { fromInvestmentUSD: totalRefundUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                user.campaignWalletSources = {
                    fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + (taskFunding.fromInvestmentUSD || 0)).toFixed(2)),
                    fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + (taskFunding.fromTaskEarningsUSD || 0)).toFixed(2)),
                    fromRefundsUSD: Number(((curSources.fromRefundsUSD || 0) + (taskFunding.fromRefundsUSD || 0)).toFixed(2))
                };
                await user.save();
                await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: 'USD',
                    type: 'Task Refund',
                    amount: totalRefundUSD,
                    amountUSD: totalRefundUSD,
                    campaignId: task._id,
                    sourceWallet: 'CampaignEscrow',
                    destinationWallet: 'CampaignFunds',
                    sourceBreakdown: {
                        fromInvestmentUSD: taskFunding.fromInvestmentUSD || 0,
                        fromTaskEarningsUSD: taskFunding.fromTaskEarningsUSD || 0,
                        fromRefundsUSD: taskFunding.fromRefundsUSD || 0
                    },
                    description: `Refund for deleted user task credited to Campaign Wallet: ${task.title} ($${totalRefundUSD.toFixed(2)} USD)`,
                    status: 'Approved'
                });
            } else {
                // Refund remaining slots' budget to Task Wallet proportionally
                const remainingSlots = task.targetQuantity - task.currentCompletions;
                if (remainingSlots > 0) {
                    const costPerSlotUSD = task.rewardPerTask + (task.adminCommission / task.targetQuantity);
                    const refundUSD = Number((remainingSlots * costPerSlotUSD).toFixed(2));
                    const refundRatio = task.targetQuantity > 0 ? (remainingSlots / task.targetQuantity) : 1;

                    const taskFunding = task.fundingSourceBreakdown || { fromInvestmentUSD: refundUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                    const refundFromInv = Number(((taskFunding.fromInvestmentUSD || 0) * refundRatio).toFixed(2));
                    const refundFromEarn = Number(((taskFunding.fromTaskEarningsUSD || 0) * refundRatio).toFixed(2));
                    const refundFromRef = Number(((taskFunding.fromRefundsUSD || 0) * refundRatio).toFixed(2));

                    user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + refundUSD).toFixed(2));
                    const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
                    user.campaignWalletSources = {
                        fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + refundFromInv).toFixed(2)),
                        fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + refundFromEarn).toFixed(2)),
                        fromRefundsUSD: Number(((curSources.fromRefundsUSD || 0) + refundFromRef).toFixed(2))
                    };
                    await user.save();
                    await Transaction.create({
                        userId: user._id,
                        userName: user.username,
                        currency: 'USD',
                        type: 'Task Refund',
                        amount: refundUSD,
                        amountUSD: refundUSD,
                        campaignId: task._id,
                        sourceWallet: 'CampaignEscrow',
                        destinationWallet: 'CampaignFunds',
                        sourceBreakdown: {
                            fromInvestmentUSD: refundFromInv,
                            fromTaskEarningsUSD: refundFromEarn,
                            fromRefundsUSD: refundFromRef
                        },
                        description: `Refund for remaining ${remainingSlots} slots of stopped task credited to Campaign Wallet: ${task.title} ($${refundUSD.toFixed(2)} USD)`,
                        status: 'Approved'
                    });
                }
            }
        }

        // Clean up pending submissions associated with this deleted campaign
        await UserTaskSubmission.updateMany(
            { taskId: req.params.id, status: 'Pending' },
            { $set: { status: 'Rejected', rejectionReason: 'Campaign was deleted or stopped by the creator.' } }
        );

        await UserTask.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const renewUserTask = async (req, res) => {
    try {
        const { extraSlots } = req.body;
        if (!extraSlots || extraSlots <= 0) {
            return res.status(400).json({ success: false, error: 'Please specify a valid number of slots to add.' });
        }

        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        if (req.user) {
            const isOwner = String(task.userId) === String(req.user.id);
            const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to renew this campaign.' });
            }
        }

        const user = await User.findById(task.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const settings = await Setting.getSettings();
        const config = settings.userTaskConfig || { commissionPercent: 10 };

        // Cost of extra slots
        const extraSubtotal = extraSlots * task.rewardPerTask;
        const extraCommission = Number((extraSubtotal * (config.commissionPercent / 100)).toFixed(2));
        const totalExtraBudget = Number((extraSubtotal + extraCommission).toFixed(2));

        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
        const userCurr = user.currency || 'USD';
        let costInUserCurr = totalExtraBudget * (rates[userCurr] || 1);
        costInUserCurr = Number(costInUserCurr.toFixed(2));

        if (user.walletBalance < costInUserCurr) {
            return res.status(400).json({
                success: false,
                error: `Insufficient wallet balance. Required: ${costInUserCurr} ${userCurr}, Available: ${user.walletBalance} ${userCurr}`
            });
        }

        // Deduct from wallet
        user.walletBalance = Number((user.walletBalance - costInUserCurr).toFixed(2));
        await user.save();

        // Create transaction
        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: userCurr,
            type: 'Task Budget Deduction',
            amount: -costInUserCurr,
            description: `Renewed User Task: Added ${extraSlots} slots to campaign: ${task.title}`,
            status: 'Approved'
        });

        // Update campaign
        task.targetQuantity = task.targetQuantity + Number(extraSlots);
        task.totalBudget = Number((task.totalBudget + totalExtraBudget).toFixed(2));
        task.adminCommission = Number((task.adminCommission + extraCommission).toFixed(2));
        
        // If status was 'Completed' or 'On Hold' or similar, reset back to 'Approved'
        if (task.status === 'Completed' || task.status === 'On Hold') {
            task.status = 'Approved';
        }
        
        await task.save();

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { task, user } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const autoApproveStaleSubmissions = async () => {
    try {
        const settings = await Setting.getSettings();
        
        // 1. Auto-approve normal pending proofs
        const timeoutDays = settings.systemLimits?.approvalTimeoutDays || 3;
        const cutoffDate = new Date(Date.now() - timeoutDays * 24 * 60 * 60 * 1000);

        const staleSubmissions = await UserTaskSubmission.find({
            status: 'Pending',
            createdAt: { $lte: cutoffDate }
        });

        for (const submission of staleSubmissions) {
            const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                { _id: submission._id, rewardClaimed: false },
                {
                    $set: {
                        status: 'Approved',
                        paid: true,
                        rewardClaimed: true,
                        rewardPaidAt: new Date(),
                        adminNotes: `Auto-approved: creator did not review within the ${timeoutDays}-day limit.`
                    }
                },
                { new: true }
            );

            if (!updatedSub) continue;

            const task = await UserTask.findById(updatedSub.taskId);
            if (task && task.currentCompletions < task.targetQuantity) {
                task.currentCompletions += 1;
                if (task.currentCompletions >= task.targetQuantity) {
                    task.status = 'Completed';
                }
                await task.save();
            }

            const worker = await User.findById(updatedSub.workerId);
            if (worker) {
                let rewardInUSD = updatedSub.rewardAmount;
                worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + rewardInUSD).toFixed(2));
                await worker.save();

                const existingTx = await Transaction.findOne({ submissionId: updatedSub._id, type: 'Task Reward' });
                if (!existingTx) {
                    const tx = await Transaction.create({
                        userId: worker._id,
                        userName: worker.username,
                        currency: 'USD',
                        type: 'Task Reward',
                        amount: rewardInUSD,
                        description: `Completed User Task (Auto-Approved): ${updatedSub.taskTitle || 'Engagement Task'}`,
                        status: 'Approved',
                        submissionId: updatedSub._id,
                        campaignId: updatedSub.taskId
                    });
                    updatedSub.rewardTransactionId = tx._id;
                    await updatedSub.save();
                }

                await Notification.create({
                    userId: worker._id,
                    subject: 'Task Auto-Approved! ⏱️✅',
                    message: `Your proof for campaign "${updatedSub.taskTitle}" was automatically approved because the creator did not review it within the ${timeoutDays}-day time limit. You earned ${updatedSub.rewardAmount} USD!`,
                    senderType: 'System'
                });
            }
        }

        // 2. Auto-approve disputed submissions in CreatorReview stage whose disputeReviewDeadline has passed
        const disputeReviewDays = settings.systemLimits?.disputeReviewTimeoutDays || 3;
        const staleDisputed = await UserTaskSubmission.find({
            status: 'Disputed',
            disputeStage: 'CreatorReview',
            disputeReviewDeadline: { $lte: new Date() }
        });

        for (const submission of staleDisputed) {
            const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                { _id: submission._id, rewardClaimed: false },
                {
                    $set: {
                        status: 'Approved',
                        paid: true,
                        rewardClaimed: true,
                        rewardPaidAt: new Date(),
                        disputeStage: 'Resolved',
                        adminNotes: `Auto-approved dispute: creator did not review the dispute within the ${disputeReviewDays}-day limit.`
                    }
                },
                { new: true }
            );

            if (!updatedSub) continue;

            // Mark Dispute document as resolved/closed
            if (updatedSub.disputeId) {
                await Dispute.findByIdAndUpdate(updatedSub.disputeId, {
                    status: 'Resolved',
                    verdict: 'ReleaseToWorker',
                    adminResponse: 'Auto-approved because creator did not review dispute in time.'
                });
            }

            const task = await UserTask.findById(updatedSub.taskId);
            if (task && task.currentCompletions < task.targetQuantity) {
                task.currentCompletions += 1;
                if (task.currentCompletions >= task.targetQuantity) {
                    task.status = 'Completed';
                }
                await task.save();
            }

            const worker = await User.findById(updatedSub.workerId);
            if (worker) {
                let rewardInUSD = updatedSub.rewardAmount;
                worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + rewardInUSD).toFixed(2));
                await worker.save();

                const existingTx = await Transaction.findOne({ submissionId: updatedSub._id, type: 'Task Reward' });
                if (!existingTx) {
                    const tx = await Transaction.create({
                        userId: worker._id,
                        userName: worker.username,
                        currency: 'USD',
                        type: 'Task Reward',
                        amount: rewardInUSD,
                        description: `Completed User Task (Auto-Approved Dispute): ${updatedSub.taskTitle || 'Engagement Task'}`,
                        status: 'Approved',
                        submissionId: updatedSub._id,
                        campaignId: updatedSub.taskId
                    });
                    updatedSub.rewardTransactionId = tx._id;
                    await updatedSub.save();
                }

                await Notification.create({
                    userId: worker._id,
                    subject: 'Dispute Auto-Approved! ⏱️⚖️✅',
                    message: `Your dispute for campaign "${updatedSub.taskTitle}" was automatically approved because the creator did not review it within the ${disputeReviewDays}-day time limit. You earned ${updatedSub.rewardAmount} USD!`,
                    senderType: 'System'
                });
            }
        }
    } catch (err) {
        console.error('Error in autoApproveStaleSubmissions:', err);
    }
};

export const getUserTaskSubmissions = async (req, res) => {
    try {
        await autoApproveStaleSubmissions();
        const submissions = await UserTaskSubmission.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: submissions.length, data: submissions });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const submitUserTaskProof = async (req, res) => {
    try {
        const taskId = req.params.id || req.body.taskId;
        const task = await UserTask.findById(taskId);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const workerId = (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') 
            ? req.user.id 
            : (req.body.workerId || req.body.userId || req.user?.id);

        if (!workerId) {
            return res.status(400).json({ success: false, error: 'Worker ID is required' });
        }

        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin' && String(task.userId) === String(req.user.id)) {
            return res.status(400).json({ success: false, error: 'You cannot submit proof to your own campaign.' });
        }

        const { proofText, proofUsername, proofUserIdVal, proofEmail, proofImage, submittedProofs } = req.body;
        if (task.status === 'On Hold') {
            return res.status(400).json({ success: false, error: 'This task campaign is currently paused by the creator.' });
        }
        if (task.status !== 'Approved' && task.status !== 'Paid' && task.status !== 'Active') {
            return res.status(400).json({ success: false, error: 'This task campaign is not active or approved yet.' });
        }
        if (task.currentCompletions >= task.targetQuantity) {
            return res.status(400).json({ success: false, error: 'This task campaign has already reached its target completions.' });
        }

        const worker = await User.findById(workerId);
        if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

        const existing = await UserTaskSubmission.findOne({ taskId, workerId });
        if (existing) {
            return res.status(400).json({ success: false, error: 'You have already submitted proof for this task.' });
        }

        const submission = await UserTaskSubmission.create({
            taskId: task._id,
            workerId: worker._id,
            workerName: worker.username,
            proofText: proofText || '',
            proofUsername: proofUsername || '',
            proofUserIdVal: proofUserIdVal || '',
            proofEmail: proofEmail || '',
            proofImage: proofImage || '',
            submittedProofs: submittedProofs || [],
            rewardAmount: task.rewardPerTask,
            currency: task.currency || 'USD',
            taskTitle: task.title,
            taskCategory: task.category,
            status: 'Pending'
        });

        // Notify Campaign Creator
        await Notification.create({
            userId: task.userId,
            subject: 'New Task Submission 📥',
            message: `Worker @${worker.username} has submitted a proof of completion for your campaign "${task.title}". Please review it.`,
            senderType: 'System'
        });

        // Send Email & WhatsApp automated templates to Employer
        sendTemplateNotification({
            userId: task.userId,
            templateKey: 'task_submission_received_email',
            variables: {
                taskTitle: task.title,
                amount: task.rewardPerTask,
                currency: 'USD',
                workerName: worker.username,
                txId: submission._id.toString()
            }
        }).catch(err => console.error('Failed to send task submission email:', err));

        sendTemplateNotification({
            userId: task.userId,
            templateKey: 'task_submission_received_whatsapp',
            variables: {
                taskTitle: task.title,
                amount: task.rewardPerTask,
                currency: 'USD',
                workerName: worker.username,
                txId: submission._id.toString()
            }
        }).catch(err => console.error('Failed to send task submission whatsapp:', err));

        // Notify Worker
        await Notification.create({
            userId: worker._id,
            subject: 'Proof Submitted Successfully! 📤',
            message: `Your completion proof for campaign "${task.title}" has been successfully submitted and is pending the creator's review.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: submission });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateSubmissionStatus = async (req, res) => {
    try {
        const { status, adminNotes, rejectionReason } = req.body;
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });

        const task = await UserTask.findById(submission.taskId);

        // Ownership and Role Verification
        if (req.user) {
            const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';
            const isCreator = task && String(task.userId) === String(req.user.id);
            const isWorker = String(submission.workerId) === String(req.user.id);

            if (isWorker && !isAdmin && !isCreator) {
                return res.status(403).json({ success: false, error: 'Workers cannot approve or review their own submissions.' });
            }
            if (!isAdmin && !isCreator) {
                return res.status(403).json({ success: false, error: 'You are not authorized to review this submission.' });
            }
        }

        const oldStatus = submission.status;
        submission.status = status || submission.status;
        if (adminNotes !== undefined) submission.adminNotes = adminNotes;
        
        if (status === 'Rejected') {
            const reason = rejectionReason || adminNotes || 'No reason specified';
            submission.rejectionReason = reason;
            submission.rejectedAt = new Date();
            const settings = await Setting.getSettings();
            if (oldStatus === 'Disputed' && submission.disputeStage === 'CreatorReview') {
                submission.disputeStage = 'RejectedByCreator';
                submission.disputeCreatorNotes = reason;
                const secondDisputeHours = settings.systemLimits?.secondDisputeTimeLimitHours || 48;
                submission.secondDisputeDeadline = new Date(Date.now() + secondDisputeHours * 60 * 60 * 1000);
                submission.disputeOpened = false; // Reset so they can escalate to admin
                
                if (submission.disputeId) {
                    await Dispute.findByIdAndUpdate(submission.disputeId, {
                        messages: [
                            { sender: 'System', message: `System Log: Creator rejected the dispute on ${new Date()}. Reason: ${reason}` }
                        ]
                    });
                }
            } else {
                const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                submission.disputeDeadline = new Date(Date.now() + disputeHours * 60 * 60 * 1000);
                submission.disputeOpened = false; // Reset disputeOpened so they can dispute again if rejected again
            }
        }

        let targetSubmission = submission;

        if (status === 'Approved' && oldStatus !== 'Approved') {
            // Atomic update to claim reward idempotently
            const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                { _id: req.params.subId, rewardClaimed: { $ne: true } },
                {
                    $set: {
                        status: 'Approved',
                        paid: true,
                        rewardClaimed: true,
                        rewardPaidAt: new Date(),
                        adminNotes: adminNotes !== undefined ? adminNotes : submission.adminNotes,
                        ...(oldStatus === 'Disputed' ? { disputeStage: 'Resolved' } : {})
                    }
                },
                { new: true }
            );

            if (!updatedSub) {
                // Reward was ALREADY claimed or approved. Return existing submission record safely.
                const currentSub = await UserTaskSubmission.findById(req.params.subId);
                return res.status(200).json({ success: true, data: currentSub, task: task || null, message: 'Submission already processed or rewarded.' });
            }

            targetSubmission = updatedSub;

            if (oldStatus === 'Disputed') {
                if (targetSubmission.disputeId) {
                    await Dispute.findByIdAndUpdate(targetSubmission.disputeId, {
                        status: 'Resolved',
                        verdict: 'ReleaseToWorker',
                        adminResponse: 'Resolved directly by the campaign creator.'
                    });
                } else {
                    await Dispute.updateMany({ submissionId: targetSubmission._id, status: { $ne: 'Resolved' } }, {
                        status: 'Resolved',
                        verdict: 'ReleaseToWorker',
                        adminResponse: 'Resolved directly by the campaign creator.'
                    });
                }
            }

            if (task) {
                if (task.currentCompletions < task.targetQuantity) {
                    task.currentCompletions += 1;
                    if (task.currentCompletions >= task.targetQuantity) {
                        task.status = 'Completed';
                    }
                    await task.save();
                }
            }

            const worker = await User.findById(targetSubmission.workerId);
            if (worker) {
                let rewardInUSD = targetSubmission.rewardAmount;
                worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + rewardInUSD).toFixed(2));
                await worker.save();

                // Prevent duplicate transaction
                const existingTx = await Transaction.findOne({ submissionId: targetSubmission._id, type: 'Task Reward' });
                if (!existingTx) {
                    const tx = await Transaction.create({
                        userId: worker._id,
                        userName: worker.username,
                        currency: 'USD',
                        type: 'Task Reward',
                        amount: rewardInUSD,
                        description: `Completed User Task: ${targetSubmission.taskTitle || 'Engagement Task'}`,
                        status: 'Approved',
                        submissionId: targetSubmission._id,
                        campaignId: targetSubmission.taskId
                    });
                    targetSubmission.rewardTransactionId = tx._id;
                    await targetSubmission.save();
                }
            }
        } else {
            await targetSubmission.save();
        }

        // Send Notification to Worker on Approval or Rejection
        if (status === 'Approved' && oldStatus !== 'Approved') {
            await Notification.create({
                userId: submission.workerId,
                subject: 'Task Approved! ✅',
                message: `Your proof for campaign "${submission.taskTitle}" was approved! You earned ${submission.rewardAmount} USD task reward.`,
                senderType: 'System'
            });

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_approved_email',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString()
                }
            }).catch(err => console.error('Failed to send task submission approved email:', err));

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_approved_whatsapp',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString()
                }
            }).catch(err => console.error('Failed to send task submission approved whatsapp:', err));

        } else if (status === 'Rejected' && oldStatus !== 'Rejected') {
            const settings = await Setting.getSettings();
            if (oldStatus === 'Disputed') {
                const secondDisputeHours = settings.systemLimits?.secondDisputeTimeLimitHours || 48;
                await Notification.create({
                    userId: submission.workerId,
                    subject: 'Dispute Rejected by Creator ⚖️❌',
                    message: `The creator has rejected your dispute for campaign "${submission.taskTitle}". You have ${secondDisputeHours} hours to escalate this dispute directly to the Admin.`,
                    senderType: 'System'
                });
            } else {
                const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                await Notification.create({
                    userId: submission.workerId,
                    subject: 'Task Rejected ❌',
                    message: `Your proof for campaign "${submission.taskTitle}" was rejected. Reason: "${submission.rejectionReason || 'No reason specified'}". You have ${disputeHours} hours to open a dispute if you believe this is an error.`,
                    senderType: 'System'
                });
            }

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_rejected_email',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString(),
                    notes: submission.rejectionReason || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send task submission rejected email:', err));

            sendTemplateNotification({
                userId: submission.workerId,
                templateKey: 'task_submission_rejected_whatsapp',
                variables: {
                    taskTitle: submission.taskTitle,
                    amount: submission.rewardAmount,
                    currency: 'USD',
                    txId: submission._id.toString(),
                    notes: submission.rejectionReason || 'No reason specified'
                }
            }).catch(err => console.error('Failed to send task submission rejected whatsapp:', err));
        }

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: targetSubmission, task: task || null });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteSubmission = async (req, res) => {
    try {
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });

        if (req.user) {
            const isWorker = String(submission.workerId) === String(req.user.id);
            const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';
            if (!isWorker && !isAdmin) {
                return res.status(403).json({ success: false, error: 'You are not authorized to delete this submission.' });
            }
        }

        await UserTaskSubmission.findByIdAndDelete(req.params.subId);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const convertUserCurrency = async (req, res) => {
    try {
        const { userId, amount, fromCurrency, toCurrency } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only convert currency for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];
        
        let allowedCurrency = user.currency || 'USD';
        if (user.country === 'Pakistan') allowedCurrency = 'PKR';
        else if (europeanCountries.includes(user.country)) allowedCurrency = 'EUR';

        if (toCurrency !== allowedCurrency) {
            return res.status(400).json({ success: false, error: `You can only convert to your registered country currency (${allowedCurrency}).` });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };

        let amountInUSD = amount;
        if (fromCurrency === 'PKR') amountInUSD = amount / (rates.PKR || 278);
        else if (fromCurrency === 'EUR') amountInUSD = amount / (rates.EUR || 0.92);
        else if (fromCurrency === 'USD') amountInUSD = amount / (rates.USD || 1);

        if ((user.taskWalletBalance || 0) < amountInUSD) {
            return res.status(400).json({ success: false, error: 'You do not have enough amount for conversion.' });
        }

        let convertedAmount = amountInUSD * (rates[toCurrency] || 1);
        convertedAmount = Number(convertedAmount.toFixed(2));

        user.taskWalletBalance = Number((user.taskWalletBalance - amountInUSD).toFixed(2));
        user.walletBalance = Number((user.walletBalance + convertedAmount).toFixed(2));
        user.currency = toCurrency;
        await user.save();

        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: toCurrency,
            type: 'Currency Conversion',
            amount: convertedAmount,
            description: `Converted ${amount} USD to ${convertedAmount} ${toCurrency}`,
            status: 'Approved'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                fromAmount: amount,
                fromCurrency: 'USD',
                toAmount: convertedAmount,
                toCurrency,
                rates,
                user
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const openTaskDispute = async (req, res) => {
    try {
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });
        if (submission.status !== 'Rejected') {
            return res.status(400).json({ success: false, error: 'Only rejected submissions can be disputed.' });
        }
        if (submission.disputeOpened) {
            return res.status(400).json({ success: false, error: 'Dispute already opened for this submission.' });
        }

        const task = await UserTask.findById(submission.taskId);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const worker = await User.findById(submission.workerId);
        const creator = await User.findById(task.userId);

        let proofUrl = req.body.proofUrl || '';
        if (req.file) {
            try {
                proofUrl = await uploadStream(req.file.buffer, 'disputes');
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Cloudinary upload failed: ' + err.message });
            }
        }

        const settings = await Setting.getSettings();

        if (submission.disputeStage === 'RejectedByCreator') {
            // Level 2 Escalation directly to Admin
            if (submission.secondDisputeDeadline && new Date() > new Date(submission.secondDisputeDeadline)) {
                const escalationHours = settings.systemLimits?.secondDisputeTimeLimitHours || 48;
                return res.status(400).json({ success: false, error: `The ${escalationHours}-hour escalation window has expired.` });
            }

            let dispute = await Dispute.findById(submission.disputeId);
            if (!dispute) {
                dispute = await Dispute.create({
                    userId: worker._id,
                    userName: worker.username,
                    type: 'UserTask',
                    taskId: task._id,
                    submissionId: submission._id,
                    creatorId: creator ? creator._id : null,
                    referenceId: String(submission._id),
                    description: req.body.description || `Dispute escalated to Admin for task: ${task.title}`,
                    proofUrl: proofUrl,
                    messages: [
                        { sender: 'System', message: `System Log: Worker submitted proof on ${submission.createdAt}` },
                        { sender: 'System', message: `System Log: Creator rejected submission. Reason: ${submission.rejectionReason}` },
                        { sender: 'System', message: `System Log: Worker opened dispute.` },
                        { sender: 'System', message: `System Log: Creator rejected dispute again. Reason: ${submission.disputeCreatorNotes}` },
                        { sender: 'System', message: `System Log: Worker escalated dispute directly to Admin.` },
                        { sender: 'User', message: req.body.description || 'Dispute escalated to Admin by worker.', attachmentUrl: proofUrl || undefined }
                    ],
                    status: 'Open',
                    adminUnread: true,
                    userUnread: false
                });
            } else {
                dispute.messages.push(
                    { sender: 'System', message: `System Log: Creator rejected dispute again. Reason: ${submission.disputeCreatorNotes}` },
                    { sender: 'System', message: `System Log: Worker escalated dispute to Admin on ${new Date()}` },
                    { sender: 'User', message: req.body.description || 'Dispute escalated to Admin by worker.', attachmentUrl: proofUrl || undefined }
                );
                if (proofUrl) dispute.proofUrl = proofUrl;
                dispute.status = 'Open';
                dispute.adminUnread = true;
                dispute.userUnread = false;
                await dispute.save();
            }

            submission.disputeStage = 'Escalated';
            submission.disputeOpened = true;
            submission.status = 'Disputed';
            if (req.body.description) submission.disputeReason = req.body.description;
            if (proofUrl) submission.disputeProofUrl = proofUrl;
            await submission.save();

            task.escrowFrozen = true;
            await task.save();

            // Notify Worker
            await Notification.create({
                userId: worker._id,
                subject: 'Dispute Escalated to Admin ⚖️🏛️',
                message: `Your dispute for the campaign "${task.title}" has been escalated to the Admin. The Admin will review it and make a final decision.`,
                senderType: 'System'
            });

            // Notify Creator
            if (creator) {
                await Notification.create({
                    userId: creator._id,
                    subject: 'Dispute Escalated to Admin ⚖️🏛️',
                    message: `Worker @${worker.username} has escalated their dispute for campaign "${task.title}" to the Admin. The Admin will make the final decision.`,
                    senderType: 'System'
                });
            }

            // Notify Admins
            try {
                const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
                for (const admin of admins) {
                    await Notification.create({
                        userId: admin._id,
                        subject: 'Escalated Task Dispute ⚖️🏛️',
                        message: `Worker @${worker.username} has escalated their dispute on campaign "${task.title}" to the Admin after creator rejection.`,
                        senderType: 'System'
                    });
                }
            } catch (adminErr) {
                console.error('Failed to notify admins of escalated dispute:', adminErr);
            }

            global.appDataVersion = Date.now();
            return res.status(201).json({ success: true, data: dispute });

        } else {
            // Level 1 Dispute: Worker vs. Creator
            if (submission.disputeDeadline && new Date() > new Date(submission.disputeDeadline)) {
                const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                return res.status(400).json({ success: false, error: `The ${disputeHours}-hour dispute window has expired.` });
            }

            const disputeReviewDays = settings.systemLimits?.disputeReviewTimeoutDays || 3;
            submission.disputeReviewDeadline = new Date(Date.now() + disputeReviewDays * 24 * 60 * 60 * 1000);
            submission.disputeStage = 'CreatorReview';

            const dispute = await Dispute.create({
                userId: worker._id,
                userName: worker.username,
                type: 'UserTask',
                taskId: task._id,
                submissionId: submission._id,
                creatorId: creator ? creator._id : null,
                referenceId: String(submission._id),
                description: req.body.description || `Dispute raised for rejected task: ${task.title}. Rejection reason: ${submission.rejectionReason}`,
                proofUrl: proofUrl,
                messages: [
                    { sender: 'System', message: `System Log: Worker submitted proof on ${submission.createdAt}` },
                    { sender: 'System', message: `System Log: Creator rejected submission on ${submission.rejectedAt || new Date()}. Reason: ${submission.rejectionReason}` },
                    { sender: 'System', message: `System Log: Worker opened dispute. Creator has ${disputeReviewDays} days to review/resolve.` },
                    { sender: 'User', message: req.body.description || 'Dispute initiated by worker.', attachmentUrl: proofUrl || undefined }
                ],
                status: 'Open',
                adminUnread: true,
                userUnread: false
            });

            submission.disputeOpened = true;
            submission.status = 'Disputed';
            submission.disputeId = dispute._id;
            submission.disputeReason = req.body.description || `Dispute raised for rejected task: ${task.title}. Rejection reason: ${submission.rejectionReason}`;
            submission.disputeProofUrl = proofUrl || '';
            await submission.save();

            task.escrowFrozen = true;
            await task.save();

            // Notify Worker
            await Notification.create({
                userId: worker._id,
                subject: 'Dispute Raised ⚖️',
                message: `Your dispute for campaign "${task.title}" has been raised. The creator has ${disputeReviewDays} days to review/resolve it. If they do not, it will be automatically approved.`,
                senderType: 'System'
            });

            // Notify Creator
            if (creator) {
                await Notification.create({
                    userId: creator._id,
                    subject: 'Dispute Raised by Worker ⚖️',
                    message: `Worker @${worker.username} has raised a dispute against your rejection of their proof for campaign "${task.title}". You have ${disputeReviewDays} days to review and either approve or reject/dismiss their dispute.`,
                    senderType: 'System'
                });
            }

            global.appDataVersion = Date.now();
            return res.status(201).json({ success: true, data: dispute });
        }
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const convertTaskWalletBalance = async (req, res) => {
    try {
        const { userId } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const taskBalUSD = user.taskWalletBalance || 0;
        if (taskBalUSD <= 0) {
            return res.status(400).json({ success: false, error: 'No task wallet balance available to transfer.' });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        const convertedAmount = Number((taskBalUSD * rate).toFixed(2));
        const curSources = user.campaignWalletSources || { fromInvestmentUSD: taskBalUSD, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };

        user.walletBalance = Number((user.walletBalance + convertedAmount).toFixed(2));
        user.taskWalletBalance = 0;
        user.campaignWalletSources = { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
        await user.save();

        await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: 'Task Wallet Transfer',
            amount: convertedAmount,
            amountUSD: taskBalUSD,
            originalAmount: convertedAmount,
            originalCurrency: userCurr,
            exchangeRate: rate,
            sourceWallet: 'CampaignFunds',
            destinationWallet: 'Investment',
            sourceBreakdown: {
                fromInvestmentUSD: curSources.fromInvestmentUSD || 0,
                fromTaskEarningsUSD: curSources.fromTaskEarningsUSD || 0,
                fromRefundsUSD: curSources.fromRefundsUSD || 0
            },
            description: `Transferred Task Wallet ($${taskBalUSD.toFixed(2)} USD) to Main Wallet (${convertedAmount} ${userCurr})`,
            status: 'Approved'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, convertedAmount, currency: userCurr } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const simulateTaskReward = async (req, res) => {
    try {
        const { userId, rewardAmount, networkName, offerTitle, externalTransactionId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const amt = Number(rewardAmount);
        if (isNaN(amt) || amt <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid reward amount' });
        }

        const providerName = networkName || 'Offerwall';
        const extTxId = externalTransactionId || `sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // Compound Idempotency Check: (offerwallProvider + externalTransactionId)
        const existingReward = await Transaction.findOne({
            offerwallProvider: providerName,
            externalTransactionId: extTxId
        });
        if (existingReward) {
            return res.status(200).json({
                success: true,
                message: 'Reward already processed and credited (idempotency key matched).',
                transaction: existingReward,
                user
            });
        }

        // Credit to Task Earnings Wallet (Worker earnings)
        user.taskEarningsBalance = Number(((user.taskEarningsBalance || 0) + amt).toFixed(2));
        await user.save();

        const newTrx = await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: 'USD',
            type: 'Task Reward',
            amount: amt,
            amountUSD: amt,
            sourceWallet: 'External',
            destinationWallet: 'TaskEarnings',
            offerwallProvider: providerName,
            externalTransactionId: extTxId,
            description: `Earned $${amt.toFixed(2)} USD from ${providerName} Offer: "${offerTitle || 'Micro-Task'}"`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: 'Task Reward Credited! 🪙',
            message: `You have successfully earned $${amt.toFixed(2)} USD from "${offerTitle || 'Micro-Task'}" via ${providerName}. The reward has been added to your Task Earnings Wallet!`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, user, transaction: newTrx });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const transferInvestmentToTaskWallet = async (req, res) => {
    try {
        const { userId, amountUserCurr, amountUSD } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        let transferInUserCurr = Number(amountUserCurr);
        let transferInUSD = Number(amountUSD);

        if (!transferInUserCurr && transferInUSD) {
            transferInUserCurr = Number((transferInUSD * rate).toFixed(2));
        } else if (transferInUserCurr && !transferInUSD) {
            transferInUSD = Number((transferInUserCurr / rate).toFixed(2));
        }

        if (isNaN(transferInUserCurr) || transferInUserCurr <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid transfer amount.' });
        }

        if (user.walletBalance < transferInUserCurr) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient Investment Wallet balance. Available: ${user.walletBalance.toFixed(2)} ${userCurr}, Requested: ${transferInUserCurr.toFixed(2)} ${userCurr}` 
            });
        }

        // Deduct from Main/Investment Wallet, credit Task Wallet
        user.walletBalance = Number((user.walletBalance - transferInUserCurr).toFixed(2));
        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + transferInUSD).toFixed(2));

        // Update campaignWalletSources
        const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
        user.campaignWalletSources = {
            fromInvestmentUSD: Number(((curSources.fromInvestmentUSD || 0) + transferInUSD).toFixed(2)),
            fromTaskEarningsUSD: curSources.fromTaskEarningsUSD || 0,
            fromRefundsUSD: curSources.fromRefundsUSD || 0
        };
        await user.save();

        // Create transaction history record
        await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: 'Investment To Task Wallet Transfer',
            amount: -transferInUserCurr,
            amountUSD: transferInUSD,
            originalAmount: -transferInUserCurr,
            originalCurrency: userCurr,
            exchangeRate: rate,
            sourceWallet: 'Investment',
            destinationWallet: 'CampaignFunds',
            sourceBreakdown: {
                fromInvestmentUSD: transferInUSD,
                fromTaskEarningsUSD: 0,
                fromRefundsUSD: 0
            },
            description: `Transferred ${transferInUserCurr} ${userCurr} ($${transferInUSD} USD) from Investment Wallet to Task Wallet`,
            status: 'Approved'
        });

        // Notification
        await Notification.create({
            userId: user._id,
            subject: 'Task Wallet Funded 💳',
            message: `Successfully transferred ${transferInUserCurr} ${userCurr} ($${transferInUSD} USD) from your Investment Wallet to your Task Wallet.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                user,
                transferredUserCurr: transferInUserCurr,
                transferredUSD: transferInUSD,
                currency: userCurr
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const transferTaskEarningsToCampaignWallet = async (req, res) => {
    try {
        const { userId, amountUSD } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const transferAmtUSD = Number(amountUSD);
        if (isNaN(transferAmtUSD) || transferAmtUSD <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid transfer amount.' });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        const currentTaskEarnings = Number((user.taskEarningsBalance || 0).toFixed(2));

        if (currentTaskEarnings < transferAmtUSD - 0.001) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient Task Earnings. Available: $${currentTaskEarnings.toFixed(2)} USD, Requested: $${transferAmtUSD.toFixed(2)} USD.` 
            });
        }

        user.taskEarningsBalance = Number(Math.max(0, currentTaskEarnings - transferAmtUSD).toFixed(2));
        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + transferAmtUSD).toFixed(2));

        // Update campaignWalletSources
        const curSources = user.campaignWalletSources || { fromInvestmentUSD: 0, fromTaskEarningsUSD: 0, fromRefundsUSD: 0 };
        user.campaignWalletSources = {
            fromInvestmentUSD: curSources.fromInvestmentUSD || 0,
            fromTaskEarningsUSD: Number(((curSources.fromTaskEarningsUSD || 0) + transferAmtUSD).toFixed(2)),
            fromRefundsUSD: curSources.fromRefundsUSD || 0
        };
        await user.save();

        const newTrx = await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: 'USD',
            type: 'Task Reward Transfer',
            amount: transferAmtUSD,
            amountUSD: transferAmtUSD,
            exchangeRate: rate,
            sourceWallet: 'TaskEarnings',
            destinationWallet: 'CampaignFunds',
            sourceBreakdown: {
                fromInvestmentUSD: 0,
                fromTaskEarningsUSD: transferAmtUSD,
                fromRefundsUSD: 0
            },
            description: `Converted $${transferAmtUSD.toFixed(2)} USD from Task Earnings Wallet to Campaign Wallet for campaign funding`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: 'Campaign Wallet Funded 🪙',
            message: `Successfully converted $${transferAmtUSD.toFixed(2)} USD from Task Earnings Wallet to Campaign Wallet.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                user,
                transferredUSD: transferAmtUSD,
                transaction: newTrx
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const transferWalletToCampaign = async (req, res) => {
    try {
        const { userId, amountUserCurr, amountUSD, sourceWallet } = req.body;

        const loggedInUserId = req.user ? (req.user.id || req.user._id) : null;
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
        if (!isAdmin && loggedInUserId && String(loggedInUserId) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only transfer funds for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        const rate = rates[userCurr] || 1;

        let transferInUserCurr = Number(amountUserCurr);
        let transferInUSD = Number(amountUSD);

        if (!transferInUserCurr && transferInUSD) {
            transferInUserCurr = Number((transferInUSD * rate).toFixed(2));
        } else if (transferInUserCurr && !transferInUSD) {
            transferInUSD = Number((transferInUserCurr / rate).toFixed(2));
        }

        if (isNaN(transferInUserCurr) || transferInUserCurr <= 0) {
            return res.status(400).json({ success: false, error: 'Please enter a valid transfer amount.' });
        }

        const source = sourceWallet === 'Investment' ? 'Investment' : 'Main';
        const availableBalance = source === 'Investment' 
            ? ((user.investmentBalance !== undefined && user.investmentBalance !== null && user.investmentBalance > 0) ? user.investmentBalance : (user.walletBalance || 0))
            : (user.walletBalance || 0);

        if (availableBalance < transferInUserCurr - 0.001) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient balance in ${source} Wallet. Available: ${availableBalance.toFixed(2)} ${userCurr}, Requested: ${transferInUserCurr.toFixed(2)} ${userCurr}` 
            });
        }

        if (source === 'Investment' && user.investmentBalance !== undefined && user.investmentBalance !== null && user.investmentBalance > 0) {
            user.investmentBalance = Number(Math.max(0, user.investmentBalance - transferInUserCurr).toFixed(2));
        } else {
            user.walletBalance = Number(Math.max(0, (user.walletBalance || 0) - transferInUserCurr).toFixed(2));
        }

        user.taskWalletBalance = Number(((user.taskWalletBalance || 0) + transferInUSD).toFixed(2));
        await user.save();

        const newTrx = await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: source === 'Investment' ? 'Investment To Task Wallet Transfer' : 'Main To Campaign Wallet Transfer',
            amount: -transferInUserCurr,
            amountUSD: transferInUSD,
            originalAmount: -transferInUserCurr,
            originalCurrency: userCurr,
            exchangeRate: rate,
            description: `Transferred ${transferInUserCurr.toFixed(2)} ${userCurr} ($${transferInUSD.toFixed(2)} USD) from ${source} Wallet to Campaign Wallet`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            subject: 'Campaign Wallet Funded 💳',
            message: `Successfully transferred ${transferInUserCurr.toFixed(2)} ${userCurr} ($${transferInUSD.toFixed(2)} USD) from your ${source} Wallet to your Campaign Wallet.`,
            senderType: 'System'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                user,
                transferredUserCurr: transferInUserCurr,
                transferredUSD: transferInUSD,
                currency: userCurr,
                transaction: newTrx
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin erase/reset all Work and Earn module data for target user(s)
// @route   POST /api/v1/user-tasks/admin-reset-data
export const resetWorkAndEarnData = async (req, res) => {
    try {
        const { 
            userIds, 
            resetAllMatching, 
            activePlanFilter, 
            allowedAccessFilter,
            resetOptions // optional object: { campaigns: true, submissions: true, disputes: true, transactions: true, hubWithdrawals: true, hubDeposits: true, resetBalances: true, logs: true, notifications: true }
        } = req.body;

        // Default all options to true if not explicitly provided
        const options = {
            campaigns: resetOptions?.campaigns !== false,
            submissions: resetOptions?.submissions !== false,
            disputes: resetOptions?.disputes !== false,
            transactions: resetOptions?.transactions !== false,
            hubWithdrawals: resetOptions?.hubWithdrawals !== false,
            hubDeposits: resetOptions?.hubDeposits !== false,
            resetBalances: resetOptions?.resetBalances !== false,
            logs: resetOptions?.logs !== false,
            notifications: resetOptions?.notifications !== false,
        };

        // Fetch settings if needed for allowed access
        const settings = await Setting.findOne() || {};

        let targetUsers = [];

        if (Array.isArray(userIds) && userIds.length > 0) {
            targetUsers = await User.find({ _id: { $in: userIds } });
        } else if (resetAllMatching || activePlanFilter || allowedAccessFilter) {
            let query = { role: 'user' };

            if (activePlanFilter && activePlanFilter !== 'all') {
                if (activePlanFilter === 'none') {
                    query.$or = [{ activePlan: 'None' }, { activePlan: { $exists: false } }, { activePlan: '' }];
                } else {
                    query.activePlan = activePlanFilter;
                }
            }

            if (allowedAccessFilter && allowedAccessFilter !== 'all') {
                const allowedSet = new Set(settings.userTaskAllowedUserIds || []);
                if (allowedAccessFilter === 'allowed') {
                    query._id = { $in: Array.from(allowedSet) };
                } else if (allowedAccessFilter === 'not_allowed') {
                    query._id = { $nin: Array.from(allowedSet) };
                }
            }

            targetUsers = await User.find(query);
        }

        if (!targetUsers || targetUsers.length === 0) {
            return res.status(400).json({ success: false, error: 'No matching users found for Work & Earn reset.' });
        }

        const targetUserIds = targetUsers.map(u => u._id);
        const targetUsernames = targetUsers.map(u => u.username).filter(Boolean);
        const targetEmails = targetUsers.map(u => u.email).filter(Boolean);

        // 1. Delete UserTask campaigns created by target users
        if (options.campaigns) {
            await UserTask.deleteMany({ userId: { $in: targetUserIds } });
        }

        // 2. Delete UserTaskSubmissions submitted by target users OR on tasks created by target users
        if (options.submissions) {
            await UserTaskSubmission.deleteMany({
                $or: [
                    { workerId: { $in: targetUserIds } },
                    { workerName: { $in: targetUsernames } },
                    { proofEmail: { $in: targetEmails } }
                ]
            });
        }

        // 3. Delete related disputes
        if (options.disputes) {
            await Dispute.deleteMany({
                $or: [
                    { userId: { $in: targetUserIds } },
                    { complainantId: { $in: targetUserIds } },
                    { respondentId: { $in: targetUserIds } }
                ]
            });
        }

        // 4. Delete Work & Earn related transactions
        if (options.transactions) {
            await Transaction.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { type: 'Task Reward' },
                    { type: 'Task Budget Deduction' },
                    { type: 'Task Refund' },
                    { type: 'Task Wallet Transfer' },
                    { type: 'Investment To Task Wallet Transfer' },
                    { description: { $regex: /task/i } },
                    { description: { $regex: /campaign/i } },
                    { description: { $regex: /micro/i } },
                    { description: { $regex: /work/i } }
                ]
            });
        }

        // 5. Delete Hub Withdrawals
        if (options.hubWithdrawals) {
            const Withdrawal = (await import('../models/Withdrawal.js')).default;
            await Withdrawal.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { isHub: true },
                    { isTaskWallet: true },
                    { userNotes: { $regex: /hub/i } },
                    { userNotes: { $regex: /task/i } }
                ]
            });
        }

        // 6. Delete Hub Deposits
        if (options.hubDeposits) {
            const Deposit = (await import('../models/Deposit.js')).default;
            await Deposit.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { isHub: true },
                    { userNotes: { $regex: /hub/i } },
                    { userNotes: { $regex: /task/i } }
                ]
            });
        }

        // 7. Delete Work & Earn related Logs
        if (options.logs) {
            const Log = (await import('../models/Log.js')).default;
            await Log.deleteMany({
                $or: [
                    { affectedUser: { $in: targetUsernames } },
                    { details: { $regex: /task/i } },
                    { details: { $regex: /campaign/i } },
                    { details: { $regex: /work & earn/i } }
                ]
            });
        }

        // 8. Delete Work & Earn Notifications
        if (options.notifications) {
            await Notification.deleteMany({
                userId: { $in: targetUserIds },
                $or: [
                    { subject: { $regex: /task/i } },
                    { subject: { $regex: /campaign/i } },
                    { subject: { $regex: /work & earn/i } },
                    { message: { $regex: /task/i } },
                    { message: { $regex: /campaign/i } }
                ]
            });
        }

        // 9. Reset user Task Wallet & Task Earnings balances strictly to 0
        if (options.resetBalances) {
            await User.updateMany(
                { _id: { $in: targetUserIds } },
                { 
                    $set: { 
                        taskWalletBalance: 0,
                        taskEarningsBalance: 0
                    } 
                }
            );
        }

        // 10. Send fresh reset notification to users
        for (const user of targetUsers) {
            await Notification.create({
                userId: user._id,
                subject: 'Work & Earn Module Journey Reset 🔄',
                message: 'Your Work & Earn module activity, balances, earnings, campaigns, and submissions have been reset by administrator.',
                senderType: 'Admin'
            });
        }

        global.appDataVersion = Date.now();

        return res.status(200).json({
            success: true,
            message: `Successfully erased Work & Earn module data for ${targetUsers.length} user(s).`,
            resetCount: targetUsers.length
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Server error resetting Work & Earn data.' });
    }
};
