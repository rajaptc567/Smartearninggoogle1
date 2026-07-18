import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
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

        const user = await User.findById(userId);
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

        if (user.walletBalance < deductionInUserCurr) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient wallet balance. Required: ${deductionInUserCurr} ${userCurr} (${totalAmountUSD} USD: ${totalBudget} Budget + ${baseFeeCharged} Base Fee), Available: ${user.walletBalance} ${userCurr}` 
            });
        }

        // Deduct from wallet
        user.walletBalance = Number((user.walletBalance - deductionInUserCurr).toFixed(2));
        await user.save();

        // Create transaction
        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: userCurr,
            type: 'Task Budget Deduction',
            amount: -deductionInUserCurr,
            description: `Submitted User Task (USD): ${title} (Budget + Base Fee of ${baseFeeCharged} USD)`,
            status: 'Approved'
        });

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

        // Send Notification to Campaign Creator
        await Notification.create({
            userId: user._id,
            subject: 'Campaign Submitted ⏳',
            message: `Your campaign "${task.title}" has been successfully submitted for Admin approval. It will go live once reviewed.`,
            senderType: 'System'
        });

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
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

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
            return res.status(200).json({ success: true, data: task });
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
        task.status = status || task.status;
        if (adminNotes !== undefined) task.adminNotes = adminNotes;

        // If admin updates the status, clear the reviewRequested flag if it matches
        if (status === 'Approved' || status === 'Rejected') {
            task.reviewRequested = false;
        }

        // If rejected and was pending/approved (not yet paid/completed refund), refund user
        if (status === 'Rejected' && oldStatus !== 'Rejected' && oldStatus !== 'Paid') {
            const user = await User.findById(task.userId);
            if (user) {
                const settings = await Setting.getSettings();
                const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
                const userCurr = user.currency || 'USDT';
                
                const baseFee = task.baseFeeCharged || 0;
                const totalRefundUSD = Number((task.totalBudget + baseFee).toFixed(2));

                let refundInUserCurr = totalRefundUSD * (rates[userCurr] || 1);
                refundInUserCurr = Number(refundInUserCurr.toFixed(2));

                user.walletBalance = Number((user.walletBalance + refundInUserCurr).toFixed(2));
                await user.save();
                await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: userCurr,
                    type: 'Task Refund',
                    amount: refundInUserCurr,
                    description: `Refund for rejected user task: ${task.title} (Budget + Base Fee of ${baseFee} USD)`,
                    status: 'Approved'
                });
            }
        }

        await task.save();

        // Send notifications if status changed
        if (status === 'Approved' && oldStatus !== 'Approved') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Approved! 🟢',
                message: `Congratulations! Your campaign "${task.title}" has been approved and is now live for workers to complete.`,
                senderType: 'System'
            });
        } else if (status === 'Rejected' && oldStatus !== 'Rejected') {
            await Notification.create({
                userId: task.userId,
                subject: 'Campaign Rejected ❌',
                message: `Your campaign "${task.title}" was rejected by the Admin. Reason: ${adminNotes || 'No reason specified'}.`,
                senderType: 'System'
            });
        }

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteUserTask = async (req, res) => {
    try {
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const user = await User.findById(task.userId);
        if (user) {
            const settings = await Setting.getSettings();
            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
            const userCurr = user.currency || 'USDT';

            // If pending, refund the ENTIRE budget
            if (task.status === 'Pending') {
                let refundInUserCurr = task.totalBudget * (rates[userCurr] || 1);
                refundInUserCurr = Number(refundInUserCurr.toFixed(2));

                user.walletBalance = Number((user.walletBalance + refundInUserCurr).toFixed(2));
                await user.save();
                await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: userCurr,
                    type: 'Task Refund',
                    amount: refundInUserCurr,
                    description: `Refund for deleted user task: ${task.title}`,
                    status: 'Approved'
                });
            } else {
                // Refund remaining slots' budget
                const remainingSlots = task.targetQuantity - task.currentCompletions;
                if (remainingSlots > 0) {
                    const costPerSlotUSD = task.rewardPerTask + (task.adminCommission / task.targetQuantity);
                    const refundUSD = Number((remainingSlots * costPerSlotUSD).toFixed(2));
                    let refundInUserCurr = refundUSD * (rates[userCurr] || 1);
                    refundInUserCurr = Number(refundInUserCurr.toFixed(2));

                    user.walletBalance = Number((user.walletBalance + refundInUserCurr).toFixed(2));
                    await user.save();
                    await Transaction.create({
                        userId: user._id,
                        userName: user.username,
                        currency: userCurr,
                        type: 'Task Refund',
                        amount: refundInUserCurr,
                        description: `Refund for remaining ${remainingSlots} slots of stopped task: ${task.title}`,
                        status: 'Approved'
                    });
                }
            }
        }

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

export const getUserTaskSubmissions = async (req, res) => {
    try {
        const submissions = await UserTaskSubmission.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: submissions.length, data: submissions });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const submitUserTaskProof = async (req, res) => {
    try {
        const taskId = req.params.id || req.body.taskId;
        const workerId = req.body.workerId || req.body.userId;
        const { proofText, proofUsername, proofUserIdVal, proofEmail, proofImage, submittedProofs } = req.body;
        const task = await UserTask.findById(taskId);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        if (task.status !== 'Approved' && task.status !== 'Paid') {
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

        const oldStatus = submission.status;
        submission.status = status || submission.status;
        if (adminNotes !== undefined) submission.adminNotes = adminNotes;
        
        if (status === 'Rejected') {
            const reason = rejectionReason || adminNotes || 'No reason specified';
            submission.rejectionReason = reason;
            submission.rejectedAt = new Date();
            submission.disputeDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour dispute window
        }

        const task = await UserTask.findById(submission.taskId);

        if (status === 'Approved' && oldStatus !== 'Approved') {
            if (task && task.currentCompletions < task.targetQuantity) {
                task.currentCompletions += 1;
                if (task.currentCompletions >= task.targetQuantity) {
                    task.status = 'Completed';
                }
                await task.save();
            }

            const worker = await User.findById(submission.workerId);
            if (worker) {
                let rewardInUSD = submission.rewardAmount;
                worker.taskWalletBalance = Number(((worker.taskWalletBalance || 0) + rewardInUSD).toFixed(2));
                await worker.save();

                await Transaction.create({
                    userId: worker._id,
                    userName: worker.username,
                    currency: 'USD',
                    type: 'Task Reward',
                    amount: rewardInUSD,
                    description: `Completed User Task: ${submission.taskTitle || 'Engagement Task'}`,
                    status: 'Approved'
                });
            }
        }

        await submission.save();

        // Send Notification to Worker on Approval or Rejection
        if (status === 'Approved' && oldStatus !== 'Approved') {
            await Notification.create({
                userId: submission.workerId,
                subject: 'Task Approved! ✅',
                message: `Your proof for campaign "${submission.taskTitle}" was approved! You earned ${submission.rewardAmount} USD task reward.`,
                senderType: 'System'
            });
        } else if (status === 'Rejected' && oldStatus !== 'Rejected') {
            await Notification.create({
                userId: submission.workerId,
                subject: 'Task Rejected ❌',
                message: `Your proof for campaign "${submission.taskTitle}" was rejected. Reason: "${submission.rejectionReason || 'No reason specified'}". You have 48 hours to open a dispute if you believe this is an error.`,
                senderType: 'System'
            });
        }

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: submission });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteSubmission = async (req, res) => {
    try {
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
        if (submission.disputeDeadline && new Date() > new Date(submission.disputeDeadline)) {
            return res.status(400).json({ success: false, error: 'The 48-hour dispute window has expired.' });
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
                { sender: 'System', message: `System Log: Worker opened dispute within 48h window.` },
                { sender: 'User', message: req.body.description || 'Dispute initiated by worker.', attachmentUrl: proofUrl || undefined }
            ],
            status: 'Open',
            adminUnread: true,
            userUnread: false
        });

        submission.disputeOpened = true;
        submission.status = 'Disputed';
        submission.disputeId = dispute._id;
        await submission.save();

        task.escrowFrozen = true;
        await task.save();

        // Notify Worker
        await Notification.create({
            userId: worker._id,
            subject: 'Dispute Opened ⚖️',
            message: `Your dispute for the campaign "${task.title}" has been opened successfully. The Admin is now reviewing it.`,
            senderType: 'System'
        });

        // Notify Campaign Creator
        if (creator) {
            await Notification.create({
                userId: creator._id,
                subject: 'Dispute Raised ⚖️',
                message: `Worker @${worker.username} has raised a dispute against your rejection of their proof for campaign "${task.title}". The Admin will make a final decision.`,
                senderType: 'System'
            });
        }

        // Notify Admins
        try {
            const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
            for (const admin of admins) {
                await Notification.create({
                    userId: admin._id,
                    subject: 'New Task Dispute ⚖️',
                    message: `Worker @${worker.username} has disputed a rejection on campaign "${task.title}" by Creator @${creator ? creator.username : 'User'}.`,
                    senderType: 'System'
                });
            }
        } catch (adminErr) {
            console.error('Failed to notify admins of new dispute:', adminErr);
        }

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const convertTaskWalletBalance = async (req, res) => {
    try {
        const { userId } = req.body;
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

        user.walletBalance = Number((user.walletBalance + convertedAmount).toFixed(2));
        user.taskWalletBalance = 0;
        await user.save();

        await Transaction.create({
            userId: user._id,
            userName: user.username || user.email,
            currency: userCurr,
            type: 'Task Wallet Transfer',
            amount: convertedAmount,
            description: `Transferred Task Wallet ($${taskBalUSD.toFixed(2)} USD) to Main Wallet (${convertedAmount} ${userCurr})`,
            status: 'Approved'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: { user, convertedAmount, currency: userCurr } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
