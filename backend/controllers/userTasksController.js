import UserTask from '../models/UserTask.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Setting from '../models/Setting.js';

export const getUserTasks = async (req, res) => {
    try {
        const tasks = await UserTask.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createUserTask = async (req, res) => {
    try {
        const { userId, category, subType, title, description, link, targetQuantity, rewardPerTask } = req.body;
        
        const settings = await Setting.getSettings();
        if (settings.isUserTaskEnabled === false) {
            return res.status(400).json({ success: false, error: 'User task submissions are currently disabled by administrator.' });
        }

        const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10 };
        if (targetQuantity < config.minQuantity) {
            return res.status(400).json({ success: false, error: `Minimum target quantity is ${config.minQuantity}.` });
        }
        if (rewardPerTask < config.minRewardAmount) {
            return res.status(400).json({ success: false, error: `Minimum reward amount per task is ${config.minRewardAmount} USD.` });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // Entire setup in USD
        const subtotal = targetQuantity * rewardPerTask;
        const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
        const totalBudget = Number((subtotal + adminCommission).toFixed(2));

        // Convert user's wallet balance or deduct in USD equivalent if needed, but user wallet is in user.currency.
        // Let's convert totalBudget (USD) to user's currency using settings exchangeRates so we check sufficient balance accurately.
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
        const userCurr = user.currency || 'USD';
        let budgetInUserCurr = totalBudget * (rates[userCurr] || 1);
        budgetInUserCurr = Number(budgetInUserCurr.toFixed(2));

        if (user.walletBalance < budgetInUserCurr) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient wallet balance. Required: ${budgetInUserCurr} ${userCurr} (${totalBudget} USD), Available: ${user.walletBalance} ${userCurr}` 
            });
        }

        // Deduct from wallet
        user.walletBalance = Number((user.walletBalance - budgetInUserCurr).toFixed(2));
        await user.save();

        // Create transaction
        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: userCurr,
            type: 'Task Budget Deduction',
            amount: -budgetInUserCurr,
            description: `Submitted User Task (USD): ${title} (${targetQuantity} completions)`,
            status: 'Approved'
        });

        const task = await UserTask.create({
            userId: user._id,
            userName: user.username,
            category,
            subType: subType || 'Like',
            title,
            description,
            link,
            targetQuantity,
            rewardPerTask,
            totalBudget,
            adminCommission,
            currency: 'USD',
            status: 'Pending'
        });

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: { task, user } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateUserTaskStatus = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const oldStatus = task.status;
        task.status = status || task.status;
        if (adminNotes !== undefined) task.adminNotes = adminNotes;

        // If rejected and was pending/approved (not yet paid/completed refund), refund user
        if (status === 'Rejected' && oldStatus !== 'Rejected' && oldStatus !== 'Paid') {
            const user = await User.findById(task.userId);
            if (user) {
                const settings = await Setting.getSettings();
                const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
                const userCurr = user.currency || 'USDT';
                let refundInUserCurr = task.totalBudget * (rates[userCurr] || 1);
                refundInUserCurr = Number(refundInUserCurr.toFixed(2));

                user.walletBalance = Number((user.walletBalance + refundInUserCurr).toFixed(2));
                await user.save();
                await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: userCurr,
                    type: 'Task Refund',
                    amount: refundInUserCurr,
                    description: `Refund for rejected user task: ${task.title}`,
                    status: 'Approved'
                });
            }
        }

        await task.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: task });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteUserTask = async (req, res) => {
    try {
        const task = await UserTask.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        // If pending, refund user
        if (task.status === 'Pending') {
            const user = await User.findById(task.userId);
            if (user) {
                const settings = await Setting.getSettings();
                const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
                const userCurr = user.currency || 'USDT';
                let refundInUserCurr = task.totalBudget * (rates[userCurr] || 1);
                refundInUserCurr = Number(refundInUserCurr.toFixed(2));

                user.walletBalance = Number((user.walletBalance + refundInUserCurr).toFixed(2));
                await user.save();
                await Transaction.create({
                    userId: user._id,
                    userName: user.username,
                    currency: userCurr,
                    type: 'Task Refund',
                    amount: refundInUserCurr,
                    description: `Refund for deleted user task: ${task.title}`,
                    status: 'Approved'
                });
            }
        }

        await UserTask.findByIdAndDelete(req.params.id);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const getUserTaskSubmissions = async (req, res) => {
    try {
        const submissions = await UserTaskSubmission.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: submissions.length, data: submissions });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const submitUserTaskProof = async (req, res) => {
    try {
        const { taskId, workerId, proofText, proofImage } = req.body;
        const task = await UserTask.findById(taskId);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
        if (task.status !== 'Approved' && task.status !== 'Paid') {
            return res.status(400).json({ success: false, error: 'This task campaign is not active or approved yet.' });
        }
        if (task.currentCompletions >= task.targetQuantity) {
            return res.status(400).json({ success: false, error: 'This task campaign has already reached its target completions.' });
        }

        const worker = await User.findById(workerId);
        if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

        const existing = await UserTaskSubmission.findOne({ taskId, workerId });
        if (existing) {
            return res.status(400).json({ success: false, error: 'You have already submitted proof for this task.' });
        }

        const submission = await UserTaskSubmission.create({
            taskId: task._id,
            workerId: worker._id,
            workerName: worker.username,
            proofText: proofText || '',
            proofImage: proofImage || '',
            rewardAmount: task.rewardPerTask,
            currency: task.currency || 'USDT',
            taskTitle: task.title,
            taskCategory: task.category,
            status: 'Pending'
        });

        global.appDataVersion = Date.now();
        res.status(201).json({ success: true, data: submission });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateSubmissionStatus = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const submission = await UserTaskSubmission.findById(req.params.subId);
        if (!submission) return res.status(404).json({ success: false, error: 'Submission not found' });

        const oldStatus = submission.status;
        submission.status = status || submission.status;
        if (adminNotes !== undefined) submission.adminNotes = adminNotes;

        const task = await UserTask.findById(submission.taskId);

        if (status === 'Approved' && oldStatus !== 'Approved') {
            if (task && task.currentCompletions < task.targetQuantity) {
                task.currentCompletions += 1;
                if (task.currentCompletions >= task.targetQuantity) {
                    task.status = 'Completed';
                }
                await task.save();
            }

            const worker = await User.findById(submission.workerId);
            if (worker) {
                const settings = await Setting.getSettings();
                const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };
                
                const workerCurr = worker.currency || 'USD';
                let rewardInUSD = submission.rewardAmount;
                let finalReward = rewardInUSD * (rates[workerCurr] || 1);
                finalReward = Number(finalReward.toFixed(2));

                worker.walletBalance = Number((worker.walletBalance + finalReward).toFixed(2));
                await worker.save();

                await Transaction.create({
                    userId: worker._id,
                    userName: worker.username,
                    currency: workerCurr,
                    type: 'Task Reward',
                    amount: finalReward,
                    description: `Completed User Task: ${submission.taskTitle || 'Engagement Task'}`,
                    status: 'Approved'
                });
            }
        }

        await submission.save();
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: submission });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deleteSubmission = async (req, res) => {
    try {
        await UserTaskSubmission.findByIdAndDelete(req.params.subId);
        global.appDataVersion = Date.now();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const convertUserCurrency = async (req, res) => {
    try {
        const { userId, amount, fromCurrency, toCurrency } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];
        
        let allowedCurrency = user.currency || 'USD';
        if (user.country === 'Pakistan') allowedCurrency = 'PKR';
        else if (europeanCountries.includes(user.country)) allowedCurrency = 'EUR';

        if (toCurrency !== allowedCurrency) {
            return res.status(400).json({ success: false, error: `You can only convert to your registered country currency (${allowedCurrency}).` });
        }

        const settings = await Setting.getSettings();
        const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };

        let amountInUSD = amount;
        if (fromCurrency === 'PKR') amountInUSD = amount / (rates.PKR || 278);
        else if (fromCurrency === 'EUR') amountInUSD = amount / (rates.EUR || 0.92);
        else if (fromCurrency === 'USD') amountInUSD = amount / (rates.USD || 1);

        let convertedAmount = amountInUSD * (rates[toCurrency] || 1);
        convertedAmount = Number(convertedAmount.toFixed(2));

        user.walletBalance = Number((user.walletBalance + convertedAmount).toFixed(2));
        user.currency = toCurrency;
        await user.save();

        await Transaction.create({
            userId: user._id,
            userName: user.username,
            currency: toCurrency,
            type: 'Currency Conversion',
            amount: convertedAmount,
            description: `Converted ${amount} USD to ${convertedAmount} ${toCurrency}`,
            status: 'Approved'
        });

        global.appDataVersion = Date.now();
        res.status(200).json({
            success: true,
            data: {
                fromAmount: amount,
                fromCurrency: 'USD',
                toAmount: convertedAmount,
                toCurrency,
                rates,
                user
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
