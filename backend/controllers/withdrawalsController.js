
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import PaymentMethod from '../models/PaymentMethod.js';
import mongoose from 'mongoose';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';
import { sendTemplateNotification } from '../utils/automation.js';
import { isUserEligibleForUserTask } from '../utils/userTaskEligibility.js';

const isUserAdmin = (user) => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'super_admin';
};

export const getWithdrawals = async (req, res) => {
    try {
        const isAdmin = isUserAdmin(req.user);
        const query = isAdmin ? {} : { userId: req.user?.id };

        if (!isAdmin && !req.user?.id) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        const withdrawals = await Withdrawal.find(query)
            .sort({ date: -1 })
            .populate({
                path: 'matchedDepositIds',
                select: 'amount date status receiptUrl userName transactionId method'
            });
            
        res.status(200).json({ success: true, count: withdrawals.length, data: withdrawals });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }

        const isAdmin = isUserAdmin(req.user);
        if (!isAdmin && withdrawal.userId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to this record' });
        }

        res.status(200).json({ success: true, data: withdrawal });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createWithdrawal = async (req, res) => {
    try {
        const loggedInUserId = req.user?.id;
        const requestedUserId = req.body.userId;
        const isAdmin = isUserAdmin(req.user);

        if (!isAdmin && String(loggedInUserId) !== String(requestedUserId)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot withdraw on behalf of other users.' });
        }

        const amountNum = Number(req.body.amount);
        if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ success: false, error: 'Please provide a valid, positive withdrawal amount.' });
        }
        req.body.amount = Number(amountNum.toFixed(2));

        const user = await User.findById(req.body.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.status === 'Blocked' || (user.restrictions && user.restrictions.withdrawal)) {
            return res.status(403).json({ success: false, error: `Withdrawals are currently disabled for your account.` });
        }
        
        const settings = await Setting.getSettings();
        if (settings.withdrawalFrequency && settings.withdrawalFrequency.enabled) {
            const { value, unit } = settings.withdrawalFrequency;
            const lastWithdrawal = await Withdrawal.findOne({ userId: user._id }).sort({ date: -1 });
            
            if (lastWithdrawal) {
                const lastDate = new Date(lastWithdrawal.date).getTime();
                const now = Date.now();
                let durationMs = 0;

                switch (unit) {
                    case 'hours': durationMs = value * 60 * 60 * 1000; break;
                    case 'days': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'weeks': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'months': durationMs = value * 30 * 24 * 60 * 60 * 1000; break;
                }

                const nextAllowedTime = lastDate + durationMs;
                
                if (now < nextAllowedTime) {
                    const remainingMs = nextAllowedTime - now;
                    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    let timeString = '';
                    if (days > 0) timeString += `${days} days, `;
                    if (hours > 0) timeString += `${hours} hours, `;
                    timeString += `${minutes} minutes`;

                    return res.status(400).json({ 
                        success: false, 
                        error: `Withdrawal frequency limit reached. You can make your next withdrawal in: ${timeString}.`
                    });
                }
            }
        }

        const isHub = req.body.isHub === 'true' || req.body.isHub === true;

        if (!isHub && !isAdmin) {
            if (!canUserAccessInvestmentModule(user, settings)) {
                return res.status(403).json({
                    success: false,
                    error: 'The Investment Module is currently disabled. Investment withdrawals are unavailable.',
                    code: 'INVESTMENT_MODULE_DISABLED'
                });
            }
        }

        // Prerequisite check: Required Work & Earn engagement tasks for Hub withdrawals
        if (isHub && settings?.isTasksEnabled !== false) {
            const requiredTasks = await Task.find({
                status: 'Active',
                isRequiredForWithdrawal: true
            }).select('_id title targetCountries targetCurrencies activeFrom activeTo maxGlobalCompletions currentGlobalCompletions').lean();

            if (requiredTasks.length > 0) {
                const now = new Date();
                const userCountry = (user.country || '').trim().toLowerCase();
                const userCurrency = (user.currency || '').trim().toUpperCase();

                const applicableRequiredTasks = requiredTasks.filter(task => {
                    // 1. Temporal availability
                    if (task.activeFrom && now < new Date(task.activeFrom)) return false;
                    if (task.activeTo && now > new Date(task.activeTo)) return false;

                    // 2. Global completion capacity
                    if (task.maxGlobalCompletions > 0 && (task.currentGlobalCompletions || 0) >= task.maxGlobalCompletions) return false;

                    // 3. Country targeting
                    if (Array.isArray(task.targetCountries) && task.targetCountries.length > 0) {
                        if (!userCountry) return false;
                        const matchesCountry = task.targetCountries.some(
                            c => typeof c === 'string' && c.trim().toLowerCase() === userCountry
                        );
                        if (!matchesCountry) return false;
                    }

                    // 4. Currency targeting
                    if (Array.isArray(task.targetCurrencies) && task.targetCurrencies.length > 0) {
                        if (!userCurrency) return false;
                        const matchesCurrency = task.targetCurrencies.some(
                            c => typeof c === 'string' && c.trim().toUpperCase() === userCurrency
                        );
                        if (!matchesCurrency) return false;
                    }

                    return true;
                });

                if (applicableRequiredTasks.length > 0) {
                    const approvedTaskIds = new Set(
                        (user.completedTasks || [])
                            .filter(ct => ct && ct.status === 'Approved' && ct.taskId)
                            .map(ct => (ct.taskId?._id ? ct.taskId._id.toString() : ct.taskId.toString()))
                    );

                    const incompleteTasks = applicableRequiredTasks.filter(
                        task => !approvedTaskIds.has(task._id.toString())
                    );

                    if (incompleteTasks.length > 0) {
                        return res.status(403).json({
                            success: false,
                            error: `Platform security policy requires you to complete all mandatory engagement tasks before withdrawing Work & Earn earnings. Incomplete tasks: ${incompleteTasks.map(t => t.title || 'Untitled Task').join(', ')}.`,
                            code: 'WITHDRAWAL_TASK_REQUIREMENT',
                            incompleteTasks: incompleteTasks.map(t => ({
                                id: t._id,
                                title: t.title || 'Untitled Task'
                            }))
                        });
                    }
                }
            }
        }

        // Dedicated Mandatory Requirement Engine (Phase C)
        const mandatoryReq = settings?.mandatoryWithdrawalRequirement;
        if (mandatoryReq && mandatoryReq.enabled && mandatoryReq.requiredTaskId) {
            const reqTaskId = mandatoryReq.requiredTaskId.toString().trim();
            const reqVersion = Number(mandatoryReq.requiredTaskVersion) || 1;

            // 1. Try finding as UserTask (survey or campaign)
            let userTask = null;
            try {
                userTask = await UserTask.findById(reqTaskId).lean();
            } catch (_) {}

            if (userTask) {
                if (userTask.status !== 'On Hold') {
                    const reqMode = userTask.requirementMode || (userTask.isMandatoryForAllUsers ? 'mandatory_all' : 'optional');
                    if (reqMode === 'mandatory_targeted') {
                        const referencedTaskIds = new Set();
                        const targeting = userTask.targeting;
                        if (targeting) {
                            if (Array.isArray(targeting.completionRules)) {
                                for (const cr of targeting.completionRules) {
                                    if (cr.taskId) referencedTaskIds.add(cr.taskId);
                                }
                            }
                            if (Array.isArray(targeting.surveyAnswerRules)) {
                                for (const sr of targeting.surveyAnswerRules) {
                                    if (sr.taskId) referencedTaskIds.add(sr.taskId);
                                }
                            }
                        }
                        const validReferencedIds = Array.from(referencedTaskIds).filter(id => id && mongoose.Types.ObjectId.isValid(id));
                        let targetSubs = [];
                        if (validReferencedIds.length > 0) {
                            targetSubs = await UserTaskSubmission.find({
                                workerId: user._id,
                                taskId: { $in: validReferencedIds }
                            }).sort({ createdAt: -1 }).lean();
                        }
                        const eligibilityContext = { submissions: targetSubs };

                        const isEligible = isUserEligibleForUserTask(user, userTask, eligibilityContext);
                        if (!isEligible) {
                            userTask = null; // User not eligible for this targeted campaign; do not block withdrawal
                        }
                    }

                    if (userTask) {
                        const isSurvey = Boolean(userTask.isSurvey);

                        // Look up authenticated user's submission for this UserTask
                        const submission = await UserTaskSubmission.findOne({
                            taskId: userTask._id,
                            workerId: user._id
                        }).sort({ createdAt: -1 }).lean();

                        let isSatisfied = false;
                        let failureReason = '';

                        if (!submission) {
                            isSatisfied = false;
                            failureReason = `Platform security policy requires you to complete the mandatory ${isSurvey ? 'survey' : 'task'} "${userTask.title}" before withdrawing Work & Earn earnings.`;
                        } else if (submission.status !== 'Approved' && submission.status !== 'Paid') {
                            isSatisfied = false;
                            failureReason = `Your submission for the mandatory ${isSurvey ? 'survey' : 'task'} "${userTask.title}" is currently "${submission.status}". It must be Approved before withdrawing Work & Earn earnings.`;
                        } else if (isSurvey && (submission.surveyQualificationStatus === 'Disqualified' || submission.surveyQualificationStatus === 'Screenout')) {
                            isSatisfied = false;
                            failureReason = `Your submission for survey "${userTask.title}" was not qualified (Status: ${submission.surveyQualificationStatus}). You must complete a qualified survey to withdraw.`;
                        } else if (isSurvey && reqVersion && (Number(submission.surveyVersion) || 1) !== reqVersion) {
                            isSatisfied = false;
                            failureReason = `Your completed survey submission is version ${Number(submission.surveyVersion) || 1}, but mandatory withdrawal requirement mandates version ${reqVersion}. Please complete version ${reqVersion}.`;
                        } else {
                            isSatisfied = true;
                        }

                        if (!isSatisfied) {
                            return res.status(403).json({
                                success: false,
                                error: failureReason,
                                code: 'MANDATORY_REQUIREMENT_UNMET',
                                mandatoryRequirement: {
                                    type: isSurvey ? 'survey' : 'user_task',
                                    taskId: userTask._id,
                                    taskTitle: userTask.title,
                                    requiredVersion: isSurvey ? reqVersion : undefined,
                                    submissionStatus: submission ? submission.status : 'Not Started',
                                    submissionVersion: submission ? (submission.surveyVersion || 1) : undefined
                                }
                            });
                        }
                    }
                }
            } else {
                // 2. Fallback: check if requiredTaskId matches an admin Task
                let adminTask = null;
                try {
                    adminTask = await Task.findById(reqTaskId).lean();
                } catch (_) {}

                if (adminTask) {
                    const now = new Date();
                    const userCountry = (user.country || '').trim().toLowerCase();
                    const userCurrency = (user.currency || '').trim().toUpperCase();

                    let isApplicable = true;
                    // 1. Task status is Active
                    if (adminTask.status !== 'Active') isApplicable = false;
                    // 2. Current time is within activeFrom / activeTo
                    if (adminTask.activeFrom && now < new Date(adminTask.activeFrom)) isApplicable = false;
                    if (adminTask.activeTo && now > new Date(adminTask.activeTo)) isApplicable = false;
                    // 3. Global completion capacity has not been exhausted
                    if (adminTask.maxGlobalCompletions > 0 && (adminTask.currentGlobalCompletions || 0) >= adminTask.maxGlobalCompletions) isApplicable = false;
                    // 4. User country matches targetCountries when targetCountries is configured
                    if (Array.isArray(adminTask.targetCountries) && adminTask.targetCountries.length > 0) {
                        if (!userCountry || !adminTask.targetCountries.some(c => typeof c === 'string' && c.trim().toLowerCase() === userCountry)) {
                            isApplicable = false;
                        }
                    }
                    // 5. User currency matches targetCurrencies when targetCurrencies is configured
                    if (Array.isArray(adminTask.targetCurrencies) && adminTask.targetCurrencies.length > 0) {
                        if (!userCurrency || !adminTask.targetCurrencies.some(c => typeof c === 'string' && c.trim().toUpperCase() === userCurrency)) {
                            isApplicable = false;
                        }
                    }

                    if (isApplicable) {
                        const approved = (user.completedTasks || []).some(
                            ct => ct && ct.status === 'Approved' && ct.taskId && (ct.taskId._id ? ct.taskId._id.toString() : ct.taskId.toString()) === adminTask._id.toString()
                        );
                        if (!approved) {
                            return res.status(403).json({
                                success: false,
                                error: `Platform security policy requires you to complete the mandatory task "${adminTask.title}" before withdrawing Work & Earn earnings.`,
                                code: 'MANDATORY_REQUIREMENT_UNMET',
                                mandatoryRequirement: {
                                    type: 'task',
                                    taskId: adminTask._id,
                                    taskTitle: adminTask.title,
                                    submissionStatus: (user.completedTasks || []).find(
                                        ct => ct && ct.taskId && (ct.taskId._id ? ct.taskId._id.toString() : ct.taskId.toString()) === adminTask._id.toString()
                                    )?.status || 'Not Started'
                                }
                            });
                        }
                    }
                } else {
                    // Neither UserTask nor Task exists (stale/deleted task ID) -> do not block withdrawal
                }
            }
        }

        let sourceWallet = 'Investment';
        let sourceAmount = req.body.amount;
        let balanceBefore = user.walletBalance || 0;
        let balanceAfter = 0;

        if (isHub) {
            sourceWallet = 'TaskEarnings';
            const rate = settings?.exchangeRates?.[user.currency] || 1;
            const reqAmountUSD = Number((user.currency === 'USD' ? req.body.amount : (req.body.amount / (rate || 1))).toFixed(4));
            sourceAmount = reqAmountUSD;
            balanceBefore = user.taskEarningsBalance || 0;

            // Atomic balance check and debit to prevent double spending
            const updatedUser = await User.findOneAndUpdate(
                {
                    _id: user._id,
                    status: { $ne: 'Blocked' },
                    'restrictions.withdrawal': { $ne: true },
                    $or: [
                        { taskEarningsBalance: { $gte: reqAmountUSD - 0.001 } },
                        { taskWalletBalance: { $gte: reqAmountUSD - 0.001 } }
                    ]
                },
                {
                    $inc: {
                        taskEarningsBalance: -reqAmountUSD,
                        taskWalletBalance: -reqAmountUSD
                    }
                },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(400).json({ success: false, error: 'Insufficient Task Earnings / Task Wallet balance' });
            }

            balanceAfter = updatedUser.taskEarningsBalance;
        } else {
            sourceWallet = 'Investment';
            balanceBefore = user.walletBalance || 0;

            // Atomic balance check and debit from Investment main wallet
            const updatedUser = await User.findOneAndUpdate(
                {
                    _id: user._id,
                    status: { $ne: 'Blocked' },
                    'restrictions.withdrawal': { $ne: true },
                    walletBalance: { $gte: req.body.amount }
                },
                {
                    $inc: { walletBalance: -req.body.amount }
                },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(400).json({ success: false, error: 'Insufficient balance' });
            }

            balanceAfter = updatedUser.walletBalance;
        }
        
        const withdrawalData = {
            ...req.body,
            isHub,
            currency: user.currency,
            sourceWallet,
            sourceAmount,
            balanceBefore,
            balanceAfter
        };
        const withdrawal = await Withdrawal.create(withdrawalData);
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Withdrawal Request',
            amount: -withdrawal.amount,
            status: 'Pending',
            withdrawalId: withdrawal._id,
            sourceWallet,
            destinationWallet: 'External',
            balanceBefore,
            balanceAfter,
            description: `Pending Withdrawal #${withdrawal._id} (${sourceWallet})`
        });

        withdrawal.relatedTransactionId = transaction._id;
        await withdrawal.save();

        await Notification.create({
            userId: user._id,
            message: `Your withdrawal request for ${user.currency}${withdrawal.amount.toFixed(2)} has been submitted for review.`
        });

        try {
            const withdrawalVars = {
                amount: withdrawal.amount.toFixed(2),
                currency: user.currency,
                txId: String(withdrawal._id),
                date: new Date().toLocaleString()
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_pending_email', variables: withdrawalVars });
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_pending_whatsapp', variables: withdrawalVars });
        } catch (wNotifErr) {
            console.error('Failed to send withdrawal pending notifications:', wNotifErr);
        }
        
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(201).json({ success: true, data: { withdrawal, user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateWithdrawal = async (req, res) => {
    try {
        if (!isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
        }

        const { status, adminNotes, p2pName, p2pAccountTitle, p2pAccountNumber, p2pInstructions, p2pLogoUrl, p2pCustomFields } = req.body;
        
        let withdrawal = await Withdrawal.findById(req.params.id).populate('matchedDepositIds');
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        const user = await User.findById(withdrawal.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Associated user not found' });
        }

        const originalStatus = withdrawal.status;

        if (status === 'Matching') {
            const remainingAmount = withdrawal.matchRemainingAmount !== undefined ? withdrawal.matchRemainingAmount : withdrawal.finalAmount;

            const methodData = {
                name: p2pName || `Gateway - ${withdrawal.method}`,
                type: 'Deposit',
                currency: withdrawal.currency,
                accountTitle: p2pAccountTitle || withdrawal.accountTitle,
                accountNumber: p2pAccountNumber || withdrawal.accountNumber,
                minAmount: 1,
                maxAmount: remainingAmount,
                feePercent: 0,
                status: 'Enabled',
                instructions: p2pInstructions || '', 
                logoUrl: p2pLogoUrl || '',
                p2pWithdrawalId: withdrawal._id,
                customFields: p2pCustomFields || []
            };

            if (originalStatus === 'Matching') {
                await PaymentMethod.findOneAndUpdate({ p2pWithdrawalId: withdrawal._id }, methodData);
            } else {
                await PaymentMethod.create(methodData);
                if (withdrawal.matchRemainingAmount === undefined) {
                    withdrawal.matchRemainingAmount = withdrawal.finalAmount;
                }
            }
        }

        if (originalStatus === 'Matching' && status !== 'Matching') {
            await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }

        if (originalStatus === status) {
            withdrawal.adminNotes = adminNotes || withdrawal.adminNotes;
            await withdrawal.save();
            return res.status(200).json({ success: true, data: { withdrawal, user } });
        }
        
        const originalTransaction = await Transaction.findOne({
            userId: user._id,
            type: 'Withdrawal Request',
            description: { $regex: `Withdrawal #${withdrawal._id}` }
        });

        if ((originalStatus === 'Pending' || originalStatus === 'Matching') && status === 'Rejected') {
            const updatedWithdrawal = await Withdrawal.findOneAndUpdate(
                { _id: req.params.id, status: { $in: ['Pending', 'Matching'] } },
                { $set: { status: 'Rejected', adminNotes: adminNotes || withdrawal.adminNotes } },
                { new: true }
            );

            if (!updatedWithdrawal) {
                const currentW = await Withdrawal.findById(req.params.id);
                return res.status(200).json({ success: true, data: { withdrawal: currentW, user, message: 'Withdrawal already processed.' } });
            }

            let refundedWallet = 'Investment';
            let refundedAmount = withdrawal.amount;
            let currentBalance = 0;

            if (withdrawal.isHub || withdrawal.sourceWallet === 'TaskEarnings') {
                refundedWallet = 'TaskEarnings';
                const settings = await Setting.findOne();
                const rate = settings?.exchangeRates?.[withdrawal.currency] || 1;
                const refundUSD = withdrawal.sourceAmount || (withdrawal.currency === 'USD' ? withdrawal.amount : Number((withdrawal.amount / rate).toFixed(4)));
                refundedAmount = refundUSD;

                const u = await User.findByIdAndUpdate(user._id, {
                    $inc: {
                        taskEarningsBalance: refundUSD,
                        taskWalletBalance: refundUSD
                    }
                }, { new: true });
                currentBalance = u?.taskEarningsBalance || 0;
            } else {
                refundedWallet = 'Investment';
                const refundAmount = withdrawal.sourceAmount || withdrawal.amount;
                refundedAmount = refundAmount;

                const u = await User.findByIdAndUpdate(user._id, {
                    $inc: { walletBalance: refundAmount }
                }, { new: true });
                currentBalance = u?.walletBalance || 0;
            }
            
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: user.currency,
                type: 'Withdrawal Refund',
                amount: withdrawal.amount,
                status: 'Approved',
                withdrawalId: withdrawal._id,
                sourceWallet: 'External',
                destinationWallet: refundedWallet,
                balanceAfter: currentBalance,
                description: `Refund for rejected withdrawal #${withdrawal._id} to ${refundedWallet}`
            });

            if (originalTransaction) {
                originalTransaction.status = 'Rejected';
                originalTransaction.description = `Rejected Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }

            await Notification.create({
                userId: user._id,
                message: `Your withdrawal for ${user.currency}${withdrawal.amount.toFixed(2)} was rejected. The amount has been refunded to your ${refundedWallet === 'TaskEarnings' ? 'task wallet' : 'wallet'}.`
            });

            // Send dynamic templated notification in the background
            const variables = {
                amount: withdrawal.amount,
                currency: withdrawal.currency,
                txId: withdrawal._id,
                notes: adminNotes || ''
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_rejected_email', variables }).catch(err => console.error(err));
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_rejected_whatsapp', variables }).catch(err => console.error(err));

            await Setting.bumpVersion();
            req.app.get('io')?.emit('DATA_CHANGED');
            return res.status(200).json({ success: true, data: { withdrawal: updatedWithdrawal, user } });
        }
        
        if (status === 'Paid' || status === 'Approved') {
            const updatedWithdrawal = await Withdrawal.findOneAndUpdate(
                { _id: req.params.id, status: { $ne: status } },
                { $set: { status, adminNotes: adminNotes || withdrawal.adminNotes } },
                { new: true }
            );

            if (!updatedWithdrawal) {
                const currentW = await Withdrawal.findById(req.params.id);
                return res.status(200).json({ success: true, data: { withdrawal: currentW, user, message: 'Withdrawal already updated.' } });
            }

            if (originalTransaction) {
                originalTransaction.status = status === 'Paid' ? 'Approved' : status;
                originalTransaction.description = `${status} Withdrawal #${withdrawal._id}`;
                await originalTransaction.save();
            }
            const message = status === 'Paid' 
                ? `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been successfully paid.`
                : `Your withdrawal for ${user.currency}${withdrawal.finalAmount.toFixed(2)} has been approved.`;
            await Notification.create({ userId: user._id, message });

            // Send dynamic templated notification in the background
            const variables = {
                amount: withdrawal.finalAmount !== undefined ? withdrawal.finalAmount : withdrawal.amount,
                currency: withdrawal.currency,
                txId: withdrawal._id,
                notes: adminNotes || ''
            };
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_success_email', variables }).catch(err => console.error(err));
            sendTemplateNotification({ userId: user._id, templateKey: 'withdrawal_success_whatsapp', variables }).catch(err => console.error(err));

            await Setting.bumpVersion();
            req.app.get('io')?.emit('DATA_CHANGED');
            return res.status(200).json({ success: true, data: { withdrawal: updatedWithdrawal, user } });
        }
        
        withdrawal.status = status;
        withdrawal.adminNotes = adminNotes;
        
        await withdrawal.save();
        await user.save();
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: { withdrawal, user } });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findByIdAndDelete(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        if (withdrawal.status === 'Matching') {
             await PaymentMethod.deleteOne({ p2pWithdrawalId: withdrawal._id });
        }
        
        await Setting.bumpVersion();
        req.app.get('io')?.emit('DATA_CHANGED');
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
