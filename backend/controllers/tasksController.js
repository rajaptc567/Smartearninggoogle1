
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import { uploadStream } from '../utils/cloudinaryUploader.js';

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

export const completeTask = async (req, res) => {
    try {
        const { userId } = req.body;
        const task = await Task.findById(req.params.id);
        const user = await User.findById(userId);

        if (!task || !user) return res.status(404).json({ success: false, error: 'Not found' });

        const completionData = {
            taskId: task._id,
            completedAt: new Date(),
            status: task.requireProof ? 'Pending' : 'Approved'
        };

        if (task.requireProof) {
            if (!req.file) return res.status(400).json({ success: false, error: 'Proof required.' });
            completionData.proofUrl = await uploadStream(req.file.buffer, 'tasks');
        }

        // Add task to user's completed list
        await User.findByIdAndUpdate(userId, { $push: { completedTasks: completionData } });
        
        // If auto-approved and has reward, use ATOMIC update
        if (completionData.status === 'Approved' && task.rewardAmount > 0) {
            await User.findByIdAndUpdate(userId, { $inc: { walletBalance: task.rewardAmount } });
            
            await Transaction.create({
                userId: user._id, userName: user.username, currency: user.currency,
                type: 'Manual Credit', amount: task.rewardAmount,
                description: `Reward: ${task.title}`, status: 'Approved'
            });
            
            await Task.findByIdAndUpdate(task._id, { $inc: { currentGlobalCompletions: 1 } });
        }

        global.appDataVersion = Date.now();
        const updatedUser = await User.findById(userId);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const verifyTaskSubmission = async (req, res) => {
    try {
        const { userId, taskId } = req.params;
        const { status, adminNotes } = req.body;
        
        const task = await Task.findById(taskId);
        
        // Use atomic update to change status inside the array and increment balance if approved
        const updateQuery = {
            $set: { 
                "completedTasks.$[elem].status": status,
                "completedTasks.$[elem].adminNotes": adminNotes
            }
        };

        if (status === 'Approved' && task.rewardAmount > 0) {
            updateQuery.$inc = { walletBalance: task.rewardAmount };
            await Task.findByIdAndUpdate(taskId, { $inc: { currentGlobalCompletions: 1 } });
        }

        const user = await User.findOneAndUpdate(
            { _id: userId, "completedTasks.taskId": taskId, "completedTasks.status": "Pending" },
            updateQuery,
            { 
                arrayFilters: [{ "elem.taskId": taskId, "elem.status": "Pending" }],
                new: true 
            }
        );

        if (!user) return res.status(400).json({ success: false, error: 'No pending submission found' });

        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: user });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
};

export const deleteTask = async (id) => {
    try {
        await Task.findByIdAndDelete(id);
        global.appDataVersion = Date.now();
    } catch (err) { console.error(err); }
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
