
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Setting from '../models/Setting.js';
import Transaction from '../models/Transaction.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

export const getDisputes = async (req, res) => {
    try {
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.email === 'studio56.pk@gmail.com');
        const query = isAdmin ? {} : { userId: req.user?.id };

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
        dispute.messages.push({ sender: 'System', message: `System Log: Admin resolved dispute with verdict: ${verdict}. Notes: ${adminNotes || ''}` });
        dispute.userUnread = true;

        if (dispute.type === 'UserTask' && dispute.submissionId) {
            const submission = await UserTaskSubmission.findById(dispute.submissionId);
            const task = await UserTask.findById(dispute.taskId);
            const worker = await User.findById(dispute.userId);
            const creator = dispute.creatorId ? await User.findById(dispute.creatorId) : (task ? await User.findById(task.userId) : null);

            if (submission && task) {
                if (verdict === 'ReleaseToWorker') {
                    submission.status = 'Paid';
                    if (task.currentCompletions < task.targetQuantity) {
                        task.currentCompletions += 1;
                        if (task.currentCompletions >= task.targetQuantity) task.status = 'Completed';
                        await task.save();
                    }
                    if (worker) {
                        const settings = await Setting.getSettings();
                        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
                        const workerCurr = worker.currency || 'USD';
                        let finalReward = submission.rewardAmount * (rates[workerCurr] || 1);
                        finalReward = Number(finalReward.toFixed(2));
                        worker.walletBalance = Number((worker.walletBalance + finalReward).toFixed(2));
                        await worker.save();

                        await Transaction.create({
                            userId: worker._id,
                            userName: worker.username,
                            currency: workerCurr,
                            type: 'Task Reward',
                            amount: finalReward,
                            description: `Dispute Won - Task Reward: ${submission.taskTitle || 'Engagement Task'}`,
                            status: 'Approved'
                        });
                    }
                    if (creator) {
                        creator.trustScore = Math.max(0, (creator.trustScore || 100) - 5);
                        await creator.save();
                    }
                } else if (verdict === 'RefundToCreator') {
                    submission.status = 'Rejected';
                    if (creator) {
                        const refundAmount = submission.rewardAmount * 1.1;
                        creator.walletBalance = Number((creator.walletBalance + refundAmount).toFixed(2));
                        await creator.save();

                        await Transaction.create({
                            userId: creator._id,
                            userName: creator.username,
                            currency: 'USD',
                            type: 'Task Refund',
                            amount: refundAmount,
                            description: `Dispute Lost Refund for Task: ${task.title}`,
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
                    if (worker) {
                        const settings = await Setting.getSettings();
                        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
                        const workerCurr = worker.currency || 'USD';
                        let workerShare = (submission.rewardAmount * (splitPct / 100)) * (rates[workerCurr] || 1);
                        workerShare = Number(workerShare.toFixed(2));
                        worker.walletBalance = Number((worker.walletBalance + workerShare).toFixed(2));
                        await worker.save();
                    }
                    if (creator) {
                        const creatorRefund = submission.rewardAmount * (1 - splitPct / 100) * 1.1;
                        creator.walletBalance = Number((creator.walletBalance + creatorRefund).toFixed(2));
                        await creator.save();
                    }
                }
                task.escrowFrozen = false;
                await task.save();
                await submission.save();
            }
        }

        await dispute.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: dispute });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
