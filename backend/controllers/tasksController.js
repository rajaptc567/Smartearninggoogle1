
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

// Helper for multi-document ACID transactions. Fails closed if transaction support is unavailable on database cluster.
const executeWithRequiredTransaction = async (workFn) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (startErr) {
        if (session) {
            try { await session.endSession(); } catch (_) {}
        }
        const error = new Error('Database transaction support is required for atomic financial reward operations. The operation cannot safely proceed without replica set transaction support.');
        error.code = 'TRANSACTIONS_UNSUPPORTED';
        error.statusCode = 503;
        throw error;
    }

    try {
        const result = await workFn(session);
        await session.commitTransaction();
        return result;
    } catch (err) {
        try { await session.abortTransaction(); } catch (_) {}
        const isTxUnsupported = err && (
            err.message?.includes('Transaction numbers are only allowed') ||
            err.message?.includes('replica set') ||
            err.message?.includes('does not support multi-document transactions') ||
            err.code === 20 ||
            err.codeName === 'IllegalOperation'
        );
        if (isTxUnsupported) {
            const error = new Error('Database transaction support is required for atomic financial reward operations but is unavailable on this MongoDB deployment.');
            error.code = 'TRANSACTIONS_UNSUPPORTED';
            error.statusCode = 503;
            throw error;
        }
        throw err;
    } finally {
        if (session) {
            try { await session.endSession(); } catch (_) {}
        }
    }
};

// ... getTasks, createTask, updateTask, deleteTask same ...
export const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({ priority: -1, createdAt: -1 });
        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const createTask = async (req, res) => {
    try {
        const task = await Task.create(req.body);
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: task });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const updateTask = async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: task });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteTask = async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const completeTask = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

        // 1. Authorized User ID enforcement:
        // Normal users can only complete tasks for themselves. req.user.id is authoritative.
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: 'Authentication required.' });
        }
        if (!isAdmin && req.body.userId && String(req.body.userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, error: 'Access denied: Cannot complete tasks on behalf of other users.' });
        }
        const targetUserId = isAdmin && req.body.userId ? req.body.userId : req.user.id;

        const task = await Task.findById(req.params.id);
        const user = await User.findById(targetUserId);

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // 2. Investment Module access check (preserved exactly)
        const settings = await Setting.getSettings();
        if (!isAdmin && !canUserAccessInvestmentModule(user, settings)) {
            return res.status(403).json({
                success: false,
                error: 'The Investment Module is currently disabled. Investment tasks are unavailable.',
                code: 'INVESTMENT_MODULE_DISABLED'
            });
        }

        // 3. Task Status & Temporal Availability
        if (task.status !== 'Active') {
            return res.status(400).json({ success: false, error: 'This task is not currently active.' });
        }

        const now = new Date();
        if (task.activeFrom && now < new Date(task.activeFrom)) {
            return res.status(400).json({ success: false, error: 'This task is not yet available.' });
        }
        if (task.activeTo && now > new Date(task.activeTo)) {
            return res.status(400).json({ success: false, error: 'This task has expired.' });
        }

        // 4. Global Capacity Check (Initial read)
        if (task.maxGlobalCompletions > 0 && (task.currentGlobalCompletions || 0) >= task.maxGlobalCompletions) {
            return res.status(400).json({ success: false, error: 'This task has reached its maximum global completion capacity.' });
        }

        // 5. Country Targeting
        const userCountry = (user.country || '').trim().toLowerCase();
        if (Array.isArray(task.targetCountries) && task.targetCountries.length > 0) {
            if (!userCountry) {
                return res.status(403).json({ success: false, error: 'Your account country is not eligible for this task.' });
            }
            const matchesCountry = task.targetCountries.some(
                c => typeof c === 'string' && c.trim().toLowerCase() === userCountry
            );
            if (!matchesCountry) {
                return res.status(403).json({ success: false, error: 'This task is not available in your country.' });
            }
        }

        // 6. Currency Targeting
        const userCurrency = (user.currency || '').trim().toUpperCase();
        if (Array.isArray(task.targetCurrencies) && task.targetCurrencies.length > 0) {
            if (!userCurrency) {
                return res.status(403).json({ success: false, error: 'Your account currency is not eligible for this task.' });
            }
            const matchesCurrency = task.targetCurrencies.some(
                c => typeof c === 'string' && c.trim().toUpperCase() === userCurrency
            );
            if (!matchesCurrency) {
                return res.status(403).json({ success: false, error: 'This task is not available for your currency.' });
            }
        }

        // 7. Plan-specific targeting (preserved from Task schema)
        if (task.minPlanValue > 0) {
            const maxPlanVal = (user.activePlans || []).reduce((max, p) => Math.max(max, p.price || 0), 0);
            if (maxPlanVal < task.minPlanValue) {
                return res.status(403).json({ success: false, error: 'A higher active investment plan is required for this task.' });
            }
        }
        if (Array.isArray(task.targetPlanIds) && task.targetPlanIds.length > 0) {
            const userPlanIds = (user.activePlans || []).map(p => p.planId?.toString());
            const matchesPlan = task.targetPlanIds.some(pid => pid && userPlanIds.includes(pid.toString()));
            if (!matchesPlan) {
                return res.status(403).json({ success: false, error: 'This task requires a specific active investment plan.' });
            }
        }

        // 8. Duplicate / Frequency / Cooldown Enforcement
        const taskIdStr = task._id.toString();
        const existingSubs = (user.completedTasks || []).filter(ct => {
            if (!ct || !ct.taskId) return false;
            const ctId = ct.taskId._id ? ct.taskId._id.toString() : ct.taskId.toString();
            return ctId === taskIdStr;
        });

        const hasPending = existingSubs.some(ct => ct.status === 'Pending');
        if (hasPending) {
            return res.status(400).json({ success: false, error: 'You already have a pending submission for this task awaiting review.' });
        }

        const approvedSubs = existingSubs.filter(ct => ct.status === 'Approved');
        if (approvedSubs.length > 0) {
            if (task.frequency === 'Once') {
                return res.status(400).json({ success: false, error: 'This task can only be completed once.' });
            }

            const lastApproved = approvedSubs[approvedSubs.length - 1];
            if (lastApproved && lastApproved.completedAt) {
                let cooldownMs = (task.cooldownHours || 0) * 60 * 60 * 1000;
                if (task.frequency === 'Daily') cooldownMs = Math.max(cooldownMs, 24 * 60 * 60 * 1000);
                if (task.frequency === 'Weekly') cooldownMs = Math.max(cooldownMs, 7 * 24 * 60 * 60 * 1000);

                const nextAvailableTime = new Date(lastApproved.completedAt).getTime() + cooldownMs;
                const nowMs = Date.now();
                if (nowMs < nextAvailableTime) {
                    const remainingMs = nextAvailableTime - nowMs;
                    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
                    return res.status(400).json({
                        success: false,
                        error: `This task is on cooldown. You can complete it again in approximately ${remainingHours} hour(s).`
                    });
                }
            }
        }

        // 9. Proof Upload or Instant Approval
        const completionData = {
            taskId: task._id,
            completedAt: new Date(),
            status: task.requireProof ? 'Pending' : 'Approved'
        };

        // NEW: CLOUDINARY LOGIC FOR TASK PROOF
        if (task.requireProof) {
            if (!req.file) return res.status(400).json({ success: false, error: 'Proof screenshot is required.' });
            try {
                completionData.proofUrl = await uploadStream(req.file.buffer, 'tasks');
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Cloudinary upload failed.' });
            }
        }

        // 10. Execution with Multi-Document Transaction (Fail-Closed if unsupported)
        let updatedUser = null;

        if (completionData.status === 'Approved' && (task.rewardAmount > 0 || task.maxGlobalCompletions > 0)) {
            try {
                await executeWithRequiredTransaction(async (session) => {
                    // Reload user within transaction session to eliminate stale-document / lost-update risk
                    const sessionUser = await User.findById(targetUserId).session(session);
                    if (!sessionUser) {
                        const err = new Error('User not found.');
                        err.statusCode = 404;
                        throw err;
                    }

                    // Re-verify frequency lock inside transaction to protect against concurrent duplicate completions
                    const taskStr = task._id.toString();
                    const freshSubs = (sessionUser.completedTasks || []).filter(ct => {
                        if (!ct || !ct.taskId) return false;
                        const ctId = ct.taskId._id ? ct.taskId._id.toString() : ct.taskId.toString();
                        return ctId === taskStr;
                    });
                    if (freshSubs.some(ct => ct.status === 'Pending')) {
                        const err = new Error('You already have a pending submission for this task awaiting review.');
                        err.statusCode = 400;
                        throw err;
                    }
                    if (task.frequency === 'Once' && freshSubs.some(ct => ct.status === 'Approved')) {
                        const err = new Error('This task can only be completed once.');
                        err.statusCode = 400;
                        throw err;
                    }

                    // 1. Atomically reserve global capacity inside transaction
                    if (task.maxGlobalCompletions > 0) {
                        const taskFilter = {
                            _id: task._id,
                            status: 'Active',
                            currentGlobalCompletions: { $lt: task.maxGlobalCompletions }
                        };
                        const updatedTask = await Task.findOneAndUpdate(
                            taskFilter,
                            { $inc: { currentGlobalCompletions: 1 } },
                            { new: true, session }
                        );

                        if (!updatedTask) {
                            const err = new Error('This task has just reached its maximum global completion capacity.');
                            err.statusCode = 400;
                            throw err;
                        }
                    } else {
                        const updateResult = await Task.updateOne(
                            { _id: task._id, status: 'Active' },
                            { $inc: { currentGlobalCompletions: 1 } },
                            { session }
                        );

                        if (updateResult.modifiedCount !== 1) {
                            const err = new Error('Task completion could not be registered because the task is no longer active.');
                            err.statusCode = 400;
                            throw err;
                        }
                    }

                    // 2. Credit user reward and create ledger transaction inside session
                    if (task.rewardAmount > 0) {
                        sessionUser.walletBalance = Number((sessionUser.walletBalance + task.rewardAmount).toFixed(2));
                        await Transaction.create([{
                            userId: sessionUser._id,
                            userName: sessionUser.username,
                            currency: sessionUser.currency,
                            type: 'Manual Credit',
                            amount: task.rewardAmount,
                            description: `Reward: ${task.title}`,
                            status: 'Approved'
                        }], { session });
                    }

                    sessionUser.completedTasks.push(completionData);
                    await sessionUser.save({ session });
                    updatedUser = sessionUser;
                });
            } catch (execErr) {
                if (execErr.statusCode) {
                    return res.status(execErr.statusCode).json({
                        success: false,
                        error: execErr.message,
                        code: execErr.code
                    });
                }
                throw execErr;
            }
        } else {
            // Proof-required submission (status: 'Pending') or non-rewarding/unlimited task:
            // Single document native atomic update on User
            user.completedTasks.push(completionData);
            await user.save();
            updatedUser = user;
        }

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: updatedUser || user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const verifyTaskSubmission = async (req, res) => {
    try {
        const { userId, taskId } = req.params;
        const { status, adminNotes } = req.body;

        // 1. Status Validation
        if (status !== 'Approved' && status !== 'Rejected') {
            return res.status(400).json({ success: false, error: 'Invalid verification status. Must be Approved or Rejected.' });
        }

        const user = await User.findById(userId);
        const task = await Task.findById(taskId);

        if (!user || !task) {
            return res.status(404).json({ success: false, error: 'User or task not found.' });
        }

        // 2. Pending Submission Retrieval (Prevents double verification / reward)
        const sub = (user.completedTasks || []).find(
            ct => ct && ct.taskId && (ct.taskId._id ? ct.taskId._id.toString() : ct.taskId.toString()) === taskId && ct.status === 'Pending'
        );
        if (!sub) {
            return res.status(400).json({ success: false, error: 'No pending submission found for this task.' });
        }

        // 3. Execution Path
        if (status === 'Rejected') {
            sub.status = 'Rejected';
            sub.adminNotes = adminNotes || '';
            await user.save();
            global.appDataVersion = Date.now();
            return res.status(200).json({ success: true, data: user });
        }

        // 4. Approval Path: Multi-Document Transaction with Atomic Claim (Fail-Closed if unsupported)
        let updatedUser = null;
        try {
            await executeWithRequiredTransaction(async (session) => {
                // 1. Atomically claim the pending submission on User inside the transaction
                const claimUser = await User.findOneAndUpdate(
                    {
                        _id: user._id,
                        completedTasks: {
                            $elemMatch: {
                                taskId: task._id,
                                status: 'Pending'
                            }
                        }
                    },
                    {
                        $set: {
                            'completedTasks.$.status': 'Approved',
                            'completedTasks.$.adminNotes': adminNotes || ''
                        },
                        ...(task.rewardAmount > 0
                            ? { $inc: { walletBalance: Number(task.rewardAmount.toFixed(2)) } }
                            : {})
                    },
                    { new: true, session }
                );

                if (!claimUser) {
                    const err = new Error('No pending submission found for this task or it was already verified.');
                    err.statusCode = 400;
                    throw err;
                }

                // 2. Atomically verify and increment capacity on Task inside the transaction
                if (task.maxGlobalCompletions > 0) {
                    const taskFilter = {
                        _id: task._id,
                        currentGlobalCompletions: { $lt: task.maxGlobalCompletions }
                    };
                    const updatedTask = await Task.findOneAndUpdate(
                        taskFilter,
                        { $inc: { currentGlobalCompletions: 1 } },
                        { new: true, session }
                    );

                    if (!updatedTask) {
                        const err = new Error('Cannot approve submission: Task has reached its maximum global completion capacity.');
                        err.statusCode = 400;
                        throw err;
                    }
                } else {
                    const updateResult = await Task.updateOne(
                        { _id: task._id },
                        { $inc: { currentGlobalCompletions: 1 } },
                        { session }
                    );

                    if (updateResult.modifiedCount !== 1) {
                        const err = new Error('Task completion counter could not be updated.');
                        err.statusCode = 400;
                        throw err;
                    }
                }

                // 3. Create the Transaction ledger document inside the transaction
                if (task.rewardAmount > 0) {
                    await Transaction.create([{
                        userId: claimUser._id,
                        userName: claimUser.username,
                        currency: claimUser.currency,
                        type: 'Manual Credit',
                        amount: task.rewardAmount,
                        description: `Reward: ${task.title}`,
                        status: 'Approved'
                    }], { session });
                }

                updatedUser = claimUser;
            });
        } catch (execErr) {
            if (execErr.statusCode) {
                return res.status(execErr.statusCode).json({
                    success: false,
                    error: execErr.message,
                    code: execErr.code
                });
            }
            throw execErr;
        }

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: updatedUser || user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getPendingVerifications = async (req, res) => {
    try {
        const usersWithPending = await User.find({ 'completedTasks.status': 'Pending' }).select('username fullName currency completedTasks');
        const queue = [];
        usersWithPending.forEach(u => {
            u.completedTasks.forEach(ct => {
                if (ct.status === 'Pending') {
                    queue.push({ userId: u._id, username: u.username, fullName: u.fullName, currency: u.currency, taskId: ct.taskId, proofUrl: ct.proofUrl, completedAt: ct.completedAt });
                }
            });
        });
        res.status(200).json({ success: true, data: queue });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};
