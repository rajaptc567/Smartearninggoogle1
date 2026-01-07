
import Task from '../models/Task.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';

// @desc    Get all tasks
// @route   GET /api/v1/tasks
export const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({ priority: -1, createdAt: -1 });
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

        // 1. Eligibility Check: Status
        if (task.status !== 'Active') return res.status(403).json({ success: false, error: 'Task is not active.' });

        // 2. Temporal Check
        const now = new Date();
        if (task.activeFrom && now < new Date(task.activeFrom)) return res.status(403).json({ success: false, error: 'Task is not yet available.' });
        if (task.activeTo && now > new Date(task.activeTo)) return res.status(403).json({ success: false, error: 'Task has expired.' });

        // 3. Global Budget Check
        if (task.maxGlobalCompletions > 0 && task.currentGlobalCompletions >= task.maxGlobalCompletions) {
            return res.status(403).json({ success: false, error: 'Task completion limit reached.' });
        }

        // 4. Personal Frequency/Cooldown Check
        if (!user.completedTasks) user.completedTasks = [];
        
        const completions = user.completedTasks.filter(ct => ct.taskId.toString() === task._id.toString());
        const lastCompletion = completions.length > 0 ? completions[completions.length - 1] : null;

        if (lastCompletion) {
            if (task.frequency === 'Once') return res.status(400).json({ success: false, error: 'Task already completed.' });
            
            let cooldownMs = task.cooldownHours * 60 * 60 * 1000;
            if (task.frequency === 'Daily') cooldownMs = Math.max(cooldownMs, 24 * 60 * 60 * 1000);
            if (task.frequency === 'Weekly') cooldownMs = Math.max(cooldownMs, 7 * 24 * 60 * 60 * 1000);
            
            const nextAvailable = new Date(lastCompletion.completedAt).getTime() + cooldownMs;
            if (now.getTime() < nextAvailable) {
                return res.status(400).json({ success: false, error: 'Task is currently in cooldown.' });
            }
        }

        // 5. Targeting Check (Plan, Currency, Country, Min Plan Value)
        if (task.targetCurrencies?.length > 0 && !task.targetCurrencies.includes(user.currency)) {
            return res.status(403).json({ success: false, error: 'Task not available for your currency.' });
        }
        if (task.targetCountries?.length > 0 && !task.targetCountries.includes(user.country)) {
            return res.status(403).json({ success: false, error: 'Task not available in your region.' });
        }
        if (task.targetPlanIds?.length > 0) {
            const userOwnedIds = (user.activePlans || []).map(p => p.planId.toString());
            const hasTargetPlan = task.targetPlanIds.some(tid => userOwnedIds.includes(tid.toString()));
            if (!hasTargetPlan) return res.status(403).json({ success: false, error: 'Required investment plan missing.' });
        }
        if (task.minPlanValue > 0) {
            const maxVal = (user.activePlans || []).reduce((max, p) => Math.max(max, p.price), 0);
            if (maxVal < task.minPlanValue) return res.status(403).json({ success: false, error: `Minimum active plan value of ${user.currency}${task.minPlanValue} required.` });
        }

        const completionData = {
            taskId: task._id,
            completedAt: now,
            status: task.requireProof ? 'Pending' : 'Approved'
        };

        if (task.requireProof) {
            if (!req.file) return res.status(400).json({ success: false, error: 'Proof screenshot required.' });
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            completionData.proofUrl = `data:${req.file.mimetype};base64,${b64}`;
        }

        user.completedTasks.push(completionData);
        
        // Instant Reward if not pending proof
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
        
        await Notification.create({
            userId: user._id,
            message: completionData.status === 'Pending' 
                ? `Submission for "${task.title}" received and awaiting verification.` 
                : `Task Completed: ${task.title}. Reward added to wallet.`
        });

        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin verify task submission
// @route   PUT /api/v1/tasks/verify/:userId/:taskId
export const verifyTaskSubmission = async (req, res) => {
    try {
        const { userId, taskId } = req.params;
        const { status, adminNotes } = req.body; // Approved or Rejected

        const user = await User.findById(userId);
        const task = await Task.findById(taskId);

        if (!user || !task) return res.status(404).json({ success: false, error: 'User or Task not found.' });

        const submission = user.completedTasks.find(ct => ct.taskId.toString() === taskId && ct.status === 'Pending');
        if (!submission) return res.status(400).json({ success: false, error: 'No pending submission found.' });

        submission.status = status;
        submission.adminNotes = adminNotes;

        if (status === 'Approved') {
            if (task.rewardAmount > 0) {
                user.walletBalance = Number((user.walletBalance + task.rewardAmount).toFixed(2));
                await Transaction.create({
                    userId: user._id, userName: user.username, currency: user.currency,
                    type: 'Manual Credit', amount: task.rewardAmount,
                    description: `Verified Reward: ${task.title}`, status: 'Approved'
                });
            }
            task.currentGlobalCompletions += 1;
            await task.save();
            
            await Notification.create({
                userId: user._id,
                message: `Submission for "${task.title}" verified! Reward added to wallet.`
            });
        } else {
            submission.retryCount = (submission.retryCount || 0) + 1;
            await Notification.create({
                userId: user._id,
                subject: 'Task Submission Rejected',
                message: `Your proof for "${task.title}" was rejected. Reason: ${adminNotes}. You can resubmit again.`,
                isPopup: true
            });
        }

        await user.save();
        res.status(200).json({ success: true, data: user });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get all pending verifications
// @route   GET /api/v1/tasks/pending-verifications
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
                        currency: u.currency,
                        taskId: ct.taskId,
                        proofUrl: ct.proofUrl,
                        completedAt: ct.completedAt,
                        retryCount: ct.retryCount || 0
                    });
                }
            });
        });

        res.status(200).json({ success: true, data: queue });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
