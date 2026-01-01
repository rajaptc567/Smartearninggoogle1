
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';

// @desc    Get all tasks
// @route   GET /api/v1/tasks
export const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Create new task
// @route   POST /api/v1/tasks
export const createTask = async (req, res) => {
    try {
        const task = await Task.create(req.body);
        res.status(201).json({ success: true, data: task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update task
// @route   PUT /api/v1/tasks/:id
export const updateTask = async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        res.status(200).json({ success: true, data: task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete task
// @route   DELETE /api/v1/tasks/:id
export const deleteTask = async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    User completes a task
// @route   POST /api/v1/tasks/:id/complete
export const completeTask = async (req, res) => {
    try {
        const { userId } = req.body;
        const task = await Task.findById(req.params.id);
        const user = await User.findById(userId);

        if (!task || !user) return res.status(404).json({ success: false, error: 'User or Task not found' });

        if (!user.completedTasks) user.completedTasks = [];
        
        const alreadyCompleted = user.completedTasks.find(ct => ct.taskId.toString() === task._id.toString());
        if (alreadyCompleted) {
            return res.status(400).json({ success: false, error: 'Task already completed' });
        }

        const completionData = {
            taskId: task._id,
            completedAt: new Date()
        };

        // Handle screenshot proof
        if (task.requireProof) {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'Proof screenshot is required for this task.' });
            }
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const mimeType = req.file.mimetype;
            completionData.proofUrl = `data:${mimeType};base64,${b64}`;
        }

        user.completedTasks.push(completionData);
        
        // Handle reward if any
        if (task.rewardAmount > 0) {
            user.walletBalance = Number((user.walletBalance + task.rewardAmount).toFixed(2));
            await Transaction.create({
                userId: user._id,
                userName: user.username,
                currency: user.currency,
                type: 'Manual Credit',
                amount: task.rewardAmount,
                description: `Reward for completing task: ${task.title}`,
                status: 'Approved',
                date: new Date()
            });
        }

        await user.save();
        
        await Notification.create({
            userId: user._id,
            message: `Task Completed: ${task.title}. ${task.isRequiredForWithdrawal ? 'Withdrawal eligibility updated.' : ''}`
        });

        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
