
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import { bucket } from '../config/db.js';
import { Readable } from 'stream';
import path from 'path';

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

// @desc    User submits task completion (Atomic Guard)
export const completeTask = async (req, res) => {
    try {
        const { userId } = req.body;
        const task = await Task.findById(req.params.id);
        const user = await User.findById(userId);

        if (!task || !user) return res.status(404).json({ success: false, error: 'User or Task not found' });

        // INITIAL CHECK: Prevent processing if limit is obviously reached
        if (task.maxGlobalCompletions > 0 && task.currentGlobalCompletions >= task.maxGlobalCompletions) {
            return res.status(400).json({ success: false, error: 'Task limit has been reached.' });
        }

        const completionData = {
            taskId: task._id,
            completedAt: new Date(),
            status: task.requireProof ? 'Pending' : 'Approved'
        };

        /**
         * CASE 1: Instant Approval (No Proof Required)
         * We must increment counter ATOMICALLY before paying.
         */
        if (!task.requireProof) {
            const atomicUpdate = await Task.findOneAndUpdate(
                { 
                    _id: task._id, 
                    $or: [
                        { maxGlobalCompletions: 0 }, 
                        { currentGlobalCompletions: { $lt: task.maxGlobalCompletions } }
                    ]
                },
                { $inc: { currentGlobalCompletions: 1 } },
                { new: true }
            );

            if (!atomicUpdate) {
                return res.status(400).json({ success: false, error: 'Task limit reached just now.' });
            }

            // Limit successfully claimed, proceed with payment
            if (task.rewardAmount > 0) {
                await User.updateOne({ _id: user._id }, { $inc: { walletBalance: Number(task.rewardAmount.toFixed(2)) } });
                await Transaction.create({
                    userId: user._id, userName: user.username, currency: user.currency,
                    type: 'Manual Credit', amount: task.rewardAmount,
                    description: `Reward: ${task.title}`, status: 'Approved'
                });
            }
        } 
        /**
         * CASE 2: Proof Submission (Requires Review)
         * We don't increment the limit yet. The limit is claimed on Admin Approval.
         */
        else {
            if (!req.file) return res.status(400).json({ success: false, error: 'Proof screenshot required.' });
            
            const filename = `proof_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
            const readableStream = new Readable();
            readableStream.push(req.file.buffer);
            readableStream.push(null);

            const uploadStream = bucket.openUploadStream(filename, { contentType: req.file.mimetype });
            await new Promise((resolve, reject) => {
                readableStream.pipe(uploadStream).on('error', reject).on('finish', resolve);
            });

            completionData.proofUrl = `/uploads/${filename}`;
        }

        user.completedTasks.push(completionData);
        await user.save();
        
        global.appDataVersion = Date.now();
        const updatedUser = await User.findById(userId);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin verifies submission (Atomic Guard)
export const verifyTaskSubmission = async (req, res) => {
    try {
        const { userId, taskId } = req.params;
        const { status, adminNotes } = req.body; 
        const user = await User.findById(userId);
        const task = await Task.findById(taskId);

        const subIdx = user.completedTasks.findIndex(ct => ct.taskId.toString() === taskId && ct.status === 'Pending');
        if (subIdx === -1) return res.status(400).json({ success: false, error: 'No pending submission found.' });

        if (status === 'Approved') {
            /**
             * CRITICAL ATOMIC CHECK: 
             * Ensure we don't exceed global limit during verification.
             */
            const atomicUpdate = await Task.findOneAndUpdate(
                { 
                    _id: task._id, 
                    $or: [
                        { maxGlobalCompletions: 0 }, 
                        { currentGlobalCompletions: { $lt: task.maxGlobalCompletions } }
                    ]
                },
                { $inc: { currentGlobalCompletions: 1 } },
                { new: true }
            );

            if (!atomicUpdate) {
                return res.status(400).json({ success: false, error: 'Cannot approve: Task global limit reached.' });
            }

            // Reward Payment
            if (task.rewardAmount > 0) {
                await User.updateOne({ _id: user._id }, { $inc: { walletBalance: Number(task.rewardAmount.toFixed(2)) } });
                await Transaction.create({ 
                    userId: user._id, userName: user.username, currency: user.currency, 
                    type: 'Manual Credit', amount: task.rewardAmount, 
                    description: `Verified Reward: ${task.title}`, status: 'Approved' 
                });
            }
        }

        user.completedTasks[subIdx].status = status;
        user.completedTasks[subIdx].adminNotes = adminNotes;

        await user.save();
        global.appDataVersion = Date.now();
        const updatedUser = await User.findById(userId);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getPendingVerifications = async (req, res) => {
    try {
        const usersWithPending = await User.find({ 'completedTasks.status': 'Pending' }).select('username fullName currency completedTasks');
        const queue = [];
        
        const host = req.get('host');
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        usersWithPending.forEach(u => {
            u.completedTasks.forEach(ct => {
                if (ct.status === 'Pending') {
                    const fullProofUrl = ct.proofUrl ? (ct.proofUrl.startsWith('http') ? ct.proofUrl : `${baseUrl}${ct.proofUrl}`) : null;
                    
                    queue.push({
                        userId: u._id, username: u.username, fullName: u.fullName, currency: u.currency,
                        taskId: ct.taskId, proofUrl: fullProofUrl, completedAt: ct.completedAt, retryCount: ct.retryCount || 0
                    });
                }
            });
        });
        res.status(200).json({ success: true, data: queue });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
