
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import { canUserAccessInvestmentModule } from '../utils/investmentAccess.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

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
        const { userId } = req.body;
        const task = await Task.findById(req.params.id);
        const user = await User.findById(userId);

        if (!task || !user) return res.status(404).json({ success: false, error: 'Not found' });

        const settings = await Setting.getSettings();
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.email === 'studio56.pk@gmail.com';
        if (!isAdmin && !canUserAccessInvestmentModule(user, settings)) {
            return res.status(403).json({
                success: false,
                error: 'The Investment Module is currently disabled. Investment tasks are unavailable.',
                code: 'INVESTMENT_MODULE_DISABLED'
            });
        }

        const completionData = {
            taskId: task._id,
            completedAt: new Date(),
            status: task.requireProof ? 'Pending' : 'Approved'
        };

        // NEW: CLOUDINARY LOGIC FOR TASK PROOF
        if (task.requireProof) {
            if (!req.file) return res.status(400).json({ success: false, error: 'Proof required.' });
            try {
                completionData.proofUrl = await uploadStream(req.file.buffer, 'tasks');
            } catch (err) {
                return res.status(500).json({ success: false, error: 'Cloudinary upload failed.' });
            }
        }

        user.completedTasks.push(completionData);
        
        if (completionData.status === 'Approved' && task.rewardAmount > 0) {
            user.walletBalance = Number((user.walletBalance + task.rewardAmount).toFixed(2));
            await Transaction.create({
                userId: user._id, userName: user.username, currency: user.currency,
                type: 'Manual Credit', amount: task.rewardAmount,
                description: `Reward: ${task.title}`, status: 'Approved'
            });
            task.currentGlobalCompletions += 1;
            await task.save();
        }

        await user.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const verifyTaskSubmission = async (req, res) => {
    try {
        const { userId, taskId } = req.params;
        const { status, adminNotes } = req.body;
        const user = await User.findById(userId);
        const task = await Task.findById(taskId);
        const sub = user.completedTasks.find(ct => ct.taskId.toString() === taskId && ct.status === 'Pending');
        if (!sub) return res.status(400).json({ success: false, error: 'No pending sub' });
        sub.status = status;
        sub.adminNotes = adminNotes;
        if (status === 'Approved' && task.rewardAmount > 0) {
            user.walletBalance = Number((user.walletBalance + task.rewardAmount).toFixed(2));
            task.currentGlobalCompletions += 1;
            await task.save();
        }
        await user.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
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
