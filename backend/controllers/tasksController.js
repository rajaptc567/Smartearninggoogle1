import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';

// Financial precision: Cents handling
const scaleAmount = (val) => Math.round(val * 100);
const descaleAmount = (val) => val / 100;

export const completeTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, action } = req.body;
        const taskId = req.params.id;

        const user = await User.findById(userId).session(session);
        if (!user) throw new Error('User not found');

        // 🛡️ TASK BYPASS GUARD
        // If client sends 'start' flag, we record the timestamp and exit
        if (action === 'start') {
            const existingStart = user.startedTasks.find(t => t.taskId.toString() === taskId);
            if (existingStart) {
                existingStart.startedAt = new Date();
            } else {
                user.startedTasks.push({ taskId, startedAt: new Date() });
            }
            await user.save({ session });
            await session.commitTransaction();
            return res.status(200).json({ success: true, message: 'Timer initiated.' });
        }

        // 🛡️ VERIFICATION PHASE
        const task = await Task.findById(taskId).session(session);
        if (!task || task.status !== 'Active') throw new Error('Task unavailable.');

        const startTimeRecord = user.startedTasks.find(t => t.taskId.toString() === taskId);
        if (!startTimeRecord && task.type === 'Video') {
            throw new Error('Task timer never initiated. Bypass detected.');
        }

        if (task.type === 'Video' && task.videoDurationType === 'Specific') {
            const elapsedSeconds = (new Date().getTime() - new Date(startTimeRecord.startedAt).getTime()) / 1000;
            if (elapsedSeconds < task.videoDurationValue) {
                throw new Error(`Minimum duration not met. Expected ${task.videoDurationValue}s, found ${Math.floor(elapsedSeconds)}s.`);
            }
        }

        // Global Limit Check
        if (task.maxGlobalCompletions > 0 && task.currentGlobalCompletions >= task.maxGlobalCompletions) {
            throw new Error('Mission capacity reached.');
        }

        // Atomic update for global count
        await Task.updateOne({ _id: taskId }, { $inc: { currentGlobalCompletions: 1 } }, { session });

        // Financial reward with integer precision
        const rewardAmount = task.rewardAmount || 0;
        if (rewardAmount > 0) {
            const balanceInCents = scaleAmount(user.walletBalance);
            const rewardInCents = scaleAmount(rewardAmount);
            user.walletBalance = descaleAmount(balanceInCents + rewardInCents);

            await Transaction.create([{
                userId: user._id, userName: user.username, type: 'Manual Credit',
                amount: rewardAmount, currency: user.currency,
                description: `Reward: ${task.title}`, status: 'Approved'
            }], { session });
        }

        user.completedTasks.push({
            taskId: task._id,
            status: task.requireProof ? 'Pending' : 'Approved',
            completedAt: new Date()
        });

        // Cleanup start record
        user.startedTasks = user.startedTasks.filter(t => t.taskId.toString() !== taskId);

        await user.save({ session });
        await session.commitTransaction();
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, error: err.message });
    } finally {
        session.endSession();
    }
};

export const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({ priority: -1, createdAt: -1 });
        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createTask = async (req, res) => {
    try {
        const task = await Task.create(req.body);
        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
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
                    queue.push({
                        userId: u._id, username: u.username, fullName: u.fullName,
                        taskId: ct.taskId, proofUrl: ct.proofUrl, completedAt: ct.completedAt
                    });
                }
            });
        });
        res.status(200).json({ success: true, data: queue });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const verifyTaskSubmission = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, taskId } = req.params;
        const { status, adminNotes } = req.body;
        const user = await User.findById(userId).session(session);
        const task = await Task.findById(taskId).session(session);
        const idx = user.completedTasks.findIndex(ct => ct.taskId.toString() === taskId && ct.status === 'Pending');
        if (idx === -1) throw new Error('Submission not found');
        if (status === 'Approved' && task.rewardAmount > 0) {
            user.walletBalance = descaleAmount(scaleAmount(user.walletBalance) + scaleAmount(task.rewardAmount));
            await Transaction.create([{
                userId: user._id, userName: user.username, type: 'Manual Credit',
                amount: task.rewardAmount, currency: user.currency,
                description: `Mission Verified: ${task.title}`, status: 'Approved'
            }], { session });
        }
        user.completedTasks[idx].status = status;
        await user.save({ session });
        await session.commitTransaction();
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        await session.abortTransaction();
        res.status(400).json({ success: false, error: err.message });
    } finally { session.endSession(); }
};