
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';

// Utility for financial precision (Software-level integer handling)
const scaleAmount = (val) => Math.round(val * 100);
const descaleAmount = (val) => val / 100;

export const completeTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId } = req.body;
        const taskId = req.params.id;

        // 1. Atomic Check & Increment for Global Limit
        const task = await Task.findOneAndUpdate(
            { 
                _id: taskId,
                status: 'Active',
                $or: [
                    { maxGlobalCompletions: 0 },
                    { currentGlobalCompletions: { $lt: "$maxGlobalCompletions" } }
                ]
            },
            { $inc: { currentGlobalCompletions: 1 } },
            { session, new: true }
        ).lean();

        if (!task) {
            throw new Error('Task limit reached. Reward no longer available.');
        }

        const user = await User.findById(userId).session(session);
        if (!user) throw new Error('User not found');

        // Check if user already did this task
        const alreadyDone = user.completedTasks.some(t => t.taskId.toString() === taskId);
        if (alreadyDone && task.frequency === 'Once') {
            throw new Error('Task already completed.');
        }

        // 2. Precise Financial Calculation
        const rewardAmount = task.rewardAmount || 0;
        if (rewardAmount > 0) {
            // Using precise integer math (Cents)
            const balanceInCents = scaleAmount(user.walletBalance);
            const rewardInCents = scaleAmount(rewardAmount);
            const newBalance = descaleAmount(balanceInCents + rewardInCents);

            user.walletBalance = newBalance;

            await Transaction.create([{
                userId: user._id,
                userName: user.username,
                type: 'Manual Credit',
                amount: rewardAmount,
                currency: user.currency,
                description: `Reward: ${task.title}`,
                status: 'Approved'
            }], { session });
        }

        user.completedTasks.push({
            taskId: task._id,
            status: task.requireProof ? 'Pending' : 'Approved',
            completedAt: new Date()
        });

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
                        userId: u._id,
                        username: u.username,
                        fullName: u.fullName,
                        taskId: ct.taskId,
                        proofUrl: ct.proofUrl,
                        completedAt: ct.completedAt
                    });
                }
            });
        });
        res.status(200).json({ success: true, data: queue });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
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
            const rewardInCents = scaleAmount(task.rewardAmount);
            const balanceInCents = scaleAmount(user.walletBalance);
            user.walletBalance = descaleAmount(balanceInCents + rewardInCents);

            await Transaction.create([{
                userId: user._id,
                userName: user.username,
                type: 'Manual Credit',
                amount: task.rewardAmount,
                currency: user.currency,
                description: `Mission Verified: ${task.title}`,
                status: 'Approved'
            }], { session });
        }

        user.completedTasks[idx].status = status;
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
