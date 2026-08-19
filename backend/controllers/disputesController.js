
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Setting from '../models/Setting.js';
import Transaction from '../models/Transaction.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';
import { sendTemplateNotification } from '../utils/automation.js';

export const getDisputes = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin 
            ? {} 
            : { $or: [{ userId: req.user?.id }, { creatorId: req.user?.id }] };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, data: [] });
        }

        const disputes = await Dispute.find(query).sort({ date: -1 });
        res.status(200).json({ success: true, data: disputes });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createDispute = async (req, res) => {
    try {
        const disputeData = { ...req.body };
        const user = await User.findById(disputeData.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const loggedInUserId = req.user.id;
        const requestedUserId = disputeData.userId;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';

        if (!isAdmin && String(loggedInUserId) !== String(requestedUserId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot submit dispute on behalf of other users.' });
        }

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.dispute)) {
            return res.status(403).json({ success: false, error: 'Restricted.' });
        }

        // NEW: CLOUDINARY FOR INITIAL PROOF
        if (req.file) {
            try {
                disputeData.proofUrl = await uploadStream(req.file.buffer, 'disputes');
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Cloudinary upload failed.' });
            }
        }
        
        disputeData.adminUnread = true;
        disputeData.userUnread = false;

        const dispute = await Dispute.create(disputeData);
        await Notification.create({ userId: dispute.userId, message: `Dispute #${dispute._id} submitted.` });
        
        const dispVars = {
            disputeId: String(dispute._id),
            title: dispute.taskTitle || 'Support Case',
            notes: dispute.reason || ''
        };
        sendTemplateNotification({ userId: dispute.userId, templateKey: 'dispute_opened_email', variables: dispVars });
        sendTemplateNotification({ userId: dispute.userId, templateKey: 'dispute_opened_whatsapp', variables: dispVars });

        res.status(201).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateDispute = async (req, res) => {
    try {
        const { status, newMessage, sender } = req.body;
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, error: 'Not found' });

        const loggedInUserId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';

        if (!isAdmin && String(loggedInUserId) !== String(dispute.userId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot update other users disputes.' });
        }

        if (newMessage || req.file) {
            const messageData = { sender: sender || 'Admin', message: newMessage || '' };

            // NEW: CLOUDINARY FOR CHAT ATTACHMENTS
            if (req.file) {
                try {
                    messageData.attachmentUrl = await uploadStream(req.file.buffer, 'disputes/chat');
                    if (!newMessage) messageData.message = 'File attached';
                } catch (err) {
                    return res.status(500).json({ success: false, error: 'Attachment upload failed.' });
                }
            }

            if (!dispute.messages) dispute.messages = [];
            dispute.messages.push(messageData);
            
            if (messageData.sender === 'Admin') dispute.userUnread = true;
            else dispute.adminUnread = true;
        }

        if (status && status !== dispute.status) {
            dispute.status = status;
            dispute.messages.push({ sender: 'System', message: `Status: ${status}` });
            dispute.userUnread = true;
        }
        
        await dispute.save();
        res.status(200).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const markAsRead = async (req, res) => {
    try {
        const { role } = req.body;
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, error: 'Not found' });

        const loggedInUserId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com';

        if (!isAdmin && String(loggedInUserId) !== String(dispute.userId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot update other users disputes.' });
        }

        if (role === 'admin') dispute.adminUnread = false;
        else dispute.userUnread = false;
        await dispute.save();
        res.status(200).json({ success: true, data: dispute });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const resolveDisputeVerdict = async (req, res) => {
    try {
        const { verdict, splitPercentageWorker, adminNotes } = req.body;
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

        dispute.verdict = verdict;
        if (splitPercentageWorker !== undefined) dispute.splitPercentageWorker = Number(splitPercentageWorker);
        dispute.status = 'Resolved';
        dispute.adminResponse = adminNotes || `Verdict: ${verdict}`;
        if (!dispute.messages) dispute.messages = [];
        dispute.messages.push({ sender: 'System', message: `System Log: Admin resolved dispute with verdict: ${verdict}. Notes: ${adminNotes || ''}` });
        dispute.userUnread = true;

        if (dispute.type === 'UserTask' || dispute.taskId || dispute.submissionId) {
            let subId = dispute.submissionId || dispute.referenceId;
            let submission = null;
            if (subId) {
                submission = await UserTaskSubmission.findById(subId);
            }
            if (!submission) {
                submission = await UserTaskSubmission.findOne({
                    $or: [
                        { disputeId: dispute._id },
                        { _id: dispute.referenceId }
                    ]
                });
            }

            const task = dispute.taskId ? await UserTask.findById(dispute.taskId) : (submission ? await UserTask.findById(submission.taskId) : null);
            const worker = dispute.userId ? await User.findById(dispute.userId) : (submission ? await User.findById(submission.workerId) : null);
            const creator = dispute.creatorId ? await User.findById(dispute.creatorId) : (task ? await User.findById(task.userId) : null);

            // Backfill references on dispute if missing
            if (submission && !dispute.submissionId) dispute.submissionId = submission._id;
            if (task && !dispute.taskId) dispute.taskId = task._id;
            if (creator && !dispute.creatorId) dispute.creatorId = creator._id;

            if (submission) {
                const baseRewardUSD = Number((submission.rewardAmount || (task ? task.rewardPerTask : 0)).toFixed(2));

                if (verdict === 'ReleaseToWorker') {
                    // Check atomic rewardClaimed
                    const updatedSub = await UserTaskSubmission.findOneAndUpdate(
                        { _id: submission._id, rewardClaimed: false },
                        {
                            $set: {
                                status: 'Paid',
                                paid: true,
                                rewardClaimed: true,
                                rewardPaidAt: new Date(),
                                disputeStage: 'Resolved',
                                adminNotes: adminNotes || 'Approved & Released to Worker by Admin'
                            }
                        },
                        { new: true }
                    );

                    if (updatedSub) {
                        submission = updatedSub;
                        if (task && task.currentCompletions < task.targetQuantity) {
                            task.currentCompletions += 1;
                            if (task.currentCompletions >= task.targetQuantity) task.status = 'Completed';
                            await task.save();
                        }

                        if (worker) {
                            worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + baseRewardUSD).toFixed(2));
                            await worker.save();

                            const existingTx = await Transaction.findOne({ submissionId: submission._id, type: 'Task Reward' });
                            if (!existingTx) {
                                const tx = await Transaction.create({
                                    userId: worker._id,
                                    userName: worker.username,
                                    currency: 'USD',
                                    type: 'Task Reward',
                                    amount: baseRewardUSD,
                                    description: `Dispute Won - Task Reward: ${submission.taskTitle || (task ? task.title : 'Engagement Task')}`,
                                    status: 'Approved',
                                    submissionId: submission._id,
                                    campaignId: submission.taskId
                                });
                                submission.rewardTransactionId = tx._id;
                                await submission.save();
                            }
                        }

                        if (creator) {
                            creator.trustScore = Math.max(0, (creator.trustScore || 100) - 5);
                            await creator.save();
                        }
                    }

                } else if (verdict === 'RefundToCreator') {
                    submission.status = 'Rejected';
                    submission.disputeStage = 'Resolved';
                    submission.rejectionReason = adminNotes || 'Rejected by Admin after dispute review';
                    const settings = await Setting.getSettings();
                    const disputeHours = settings.systemLimits?.disputeTimeLimitHours || 48;
                    submission.disputeDeadline = new Date(Date.now() + disputeHours * 60 * 60 * 1000);
                    submission.disputeOpened = false;

                    if (task) {
                        if (task.currentCompletions > 0) {
                            task.currentCompletions = Math.max(0, task.currentCompletions - 1);
                        }
                        if (task.status === 'Completed' || task.status === 'On Hold') {
                            task.status = 'Approved';
                        }
                        await task.save();
                    } else if (creator) {
                        const refundAmountUSD = Number((baseRewardUSD * 1.1).toFixed(2));
                        creator.taskWalletBalance = Number(((creator.taskWalletBalance || 0) + refundAmountUSD).toFixed(2));
                        await creator.save();

                        await Transaction.create({
                            userId: creator._id,
                            userName: creator.username,
                            currency: 'USD',
                            type: 'Task Refund',
                            amount: refundAmountUSD,
                            description: `Dispute Refund for Campaign: ${submission.taskTitle}`,
                            status: 'Approved'
                        });
                    }

                    if (worker) {
                        worker.disputeLossCount = (worker.disputeLossCount || 0) + 1;
                        if (worker.disputeLossCount >= 3) {
                            worker.status = 'Blocked';
                            worker.restrictions = worker.restrictions || {};
                            worker.restrictions.dispute = true;
                            worker.restrictions.loginBlocked = true;
                        }
                        await worker.save();
                    }

                } else if (verdict === 'SplitPayout') {
                    const splitPct = splitPercentageWorker !== undefined ? Number(splitPercentageWorker) : 50;
                    submission.status = 'Paid';
                    submission.disputeStage = 'Resolved';
                    submission.adminNotes = adminNotes || `Split Payout (${splitPct}% Worker) by Admin`;

                    if (worker) {
                        const workerShareUSD = Number((baseRewardUSD * (splitPct / 100)).toFixed(2));
                        worker.taskEarningsBalance = Number(((worker.taskEarningsBalance || 0) + workerShareUSD).toFixed(2));
                        await worker.save();

                        await Transaction.create({
                            userId: worker._id,
                            userName: worker.username,
                            currency: 'USD',
                            type: 'Task Reward',
                            amount: workerShareUSD,
                            description: `Dispute Resolved (Split Payout ${splitPct}%): ${submission.taskTitle || (task ? task.title : 'Engagement Task')}`,
                            status: 'Approved'
                        });
                    }

                    if (creator) {
                        const creatorRefundUSD = Number((baseRewardUSD * (1 - splitPct / 100) * 1.1).toFixed(2));
                        creator.taskWalletBalance = Number(((creator.taskWalletBalance || 0) + creatorRefundUSD).toFixed(2));
                        await creator.save();

                        await Transaction.create({
                            userId: creator._id,
                            userName: creator.username,
                            currency: 'USD',
                            type: 'Task Refund',
                            amount: creatorRefundUSD,
                            description: `Dispute Resolved (Split Payout ${100 - splitPct}% Refund): ${task ? task.title : submission.taskTitle}`,
                            status: 'Approved'
                        });
                    }
                }

                if (task) {
                    task.escrowFrozen = false;
                    await task.save();
                }

                await submission.save();

                try {
                    const taskTitle = task ? task.title : (submission.taskTitle || 'Campaign');
                    if (verdict === 'ReleaseToWorker') {
                        if (worker) {
                            await Notification.create({
                                userId: worker._id,
                                subject: 'Dispute Won! 🏆',
                                message: `The Admin ruled in your favor for campaign "${taskTitle}". The task reward of $${baseRewardUSD} USD has been credited to your balance.`,
                                senderType: 'System'
                            });
                            const dispWinVars = {
                                disputeId: String(dispute._id),
                                title: taskTitle,
                                amount: String(baseRewardUSD),
                                currency: worker.currency || 'USD'
                            };
                            sendTemplateNotification({ userId: worker._id, templateKey: 'dispute_resolved_worker_email', variables: dispWinVars });
                            sendTemplateNotification({ userId: worker._id, templateKey: 'dispute_resolved_worker_whatsapp', variables: dispWinVars });
                        }
                        if (creator) {
                            await Notification.create({
                                userId: creator._id,
                                subject: 'Dispute Resolved (Lost)',
                                message: `The Admin ruled in favor of worker @${worker ? worker.username : 'User'} for campaign "${taskTitle}".`,
                                senderType: 'System'
                            });
                            const dispLoseVars = {
                                disputeId: String(dispute._id),
                                title: taskTitle,
                                notes: `Admin ruled in favor of worker @${worker ? worker.username : 'User'}`
                            };
                            sendTemplateNotification({ userId: creator._id, templateKey: 'dispute_resolved_employer_email', variables: dispLoseVars });
                            sendTemplateNotification({ userId: creator._id, templateKey: 'dispute_resolved_employer_whatsapp', variables: dispLoseVars });
                        }
                    } else if (verdict === 'RefundToCreator') {
                        if (worker) {
                            await Notification.create({
                                userId: worker._id,
                                subject: 'Dispute Lost',
                                message: `The Admin ruled in favor of the creator for campaign "${taskTitle}". Your dispute request has been rejected.`,
                                senderType: 'System'
                            });
                            const dispLoseVars = {
                                disputeId: String(dispute._id),
                                title: taskTitle,
                                notes: 'Admin ruled in favor of campaign creator.'
                            };
                            sendTemplateNotification({ userId: worker._id, templateKey: 'dispute_resolved_worker_email', variables: dispLoseVars });
                            sendTemplateNotification({ userId: worker._id, templateKey: 'dispute_resolved_worker_whatsapp', variables: dispLoseVars });
                        }
                        if (creator) {
                            await Notification.create({
                                userId: creator._id,
                                subject: 'Dispute Won! 🏆',
                                message: `The Admin ruled in your favor for campaign "${taskTitle}". The escrow budget has been successfully refunded to your wallet.`,
                                senderType: 'System'
                            });
                            const dispWinVars = {
                                disputeId: String(dispute._id),
                                title: taskTitle,
                                amount: String(baseRewardUSD),
                                currency: creator.currency || 'USD'
                            };
                            sendTemplateNotification({ userId: creator._id, templateKey: 'dispute_resolved_employer_email', variables: dispWinVars });
                            sendTemplateNotification({ userId: creator._id, templateKey: 'dispute_resolved_employer_whatsapp', variables: dispWinVars });
                        }
                    } else if (verdict === 'SplitPayout') {
                        const splitPct = splitPercentageWorker !== undefined ? Number(splitPercentageWorker) : 50;
                        if (worker) {
                            await Notification.create({
                                userId: worker._id,
                                subject: 'Dispute Resolved (Split Payout) ⚖️',
                                message: `The Admin resolved the dispute on campaign "${taskTitle}" with a ${splitPct}% split payout. Your share has been credited to your balance.`,
                                senderType: 'System'
                            });
                            const dispSplitVars = {
                                disputeId: String(dispute._id),
                                title: taskTitle,
                                amount: String((baseRewardUSD * (splitPct / 100)).toFixed(2)),
                                currency: worker.currency || 'USD'
                            };
                            sendTemplateNotification({ userId: worker._id, templateKey: 'dispute_resolved_worker_email', variables: dispSplitVars });
                            sendTemplateNotification({ userId: worker._id, templateKey: 'dispute_resolved_worker_whatsapp', variables: dispSplitVars });
                        }
                        if (creator) {
                            await Notification.create({
                                userId: creator._id,
                                subject: 'Dispute Resolved (Split Payout) ⚖️',
                                message: `The Admin resolved the dispute on campaign "${taskTitle}" with a split payout between you and worker @${worker ? worker.username : 'User'}.`,
                                senderType: 'System'
                            });
                            const dispSplitVars = {
                                disputeId: String(dispute._id),
                                title: taskTitle,
                                notes: `Split payout (${splitPct}% worker / ${100 - splitPct}% creator refund)`
                            };
                            sendTemplateNotification({ userId: creator._id, templateKey: 'dispute_resolved_employer_email', variables: dispSplitVars });
                            sendTemplateNotification({ userId: creator._id, templateKey: 'dispute_resolved_employer_whatsapp', variables: dispSplitVars });
                        }
                    }
                } catch (notiErr) {
                    console.error('Failed to create notifications for dispute resolution:', notiErr);
                }
            }
        }

        await dispute.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        console.error("resolveDisputeVerdict error:", err);
        res.status(400).json({ success: false, error: err.message });
    }
};
