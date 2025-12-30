
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
        if (user.completedTasks.includes(task._id.toString())) {
            return res.status(400).json({ success: false, error: 'Task already completed' });
        }

        user.completedTasks.push(task._id.toString());
        
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
                status: 'Approved'
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
