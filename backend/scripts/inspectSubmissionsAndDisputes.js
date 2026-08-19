import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import UserTaskSubmission from '../models/UserTaskSubmission.js';
import Transaction from '../models/Transaction.js';
import Dispute from '../models/Dispute.js';
import Notification from '../models/Notification.js';

dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);

    const submissions = await UserTaskSubmission.find({}).lean();
    const transactions = await Transaction.find({}).lean();
    const disputes = await Dispute.find({}).lean();
    const notifications = await Notification.find({}).lean();

    console.log('--- ALL SUBMISSIONS & THEIR REWARD TXS ---');
    for (const sub of submissions) {
        const matchingTxs = transactions.filter(t => 
            String(t.submissionId) === String(sub._id) || 
            (sub.rewardTransactionId && String(t._id) === String(sub.rewardTransactionId))
        );
        console.log(`Sub ID: ${sub._id} | Task: ${sub.taskTitle || sub.taskId} | Worker: ${sub.workerName || sub.workerId} | Status: ${sub.status} | Reward: $${sub.rewardAmount} | Matching Txs Count: ${matchingTxs.length}`);
        matchingTxs.forEach(tx => {
            console.log(`   -> Tx ID: ${tx._id} | Type: ${tx.type} | Amount: $${tx.amount} (${tx.currency}) | Desc: ${tx.description}`);
        });
    }

    console.log('\n--- ALL DISPUTES ---');
    for (const disp of disputes) {
        console.log(`Dispute ID: ${disp._id} | SubmissionId: ${disp.submissionId} | Status: ${disp.status} | Ruling: ${disp.ruling || 'N/A'}`);
    }

    console.log('\n--- NOTIFICATIONS SUMMARY ---');
    console.log(`Total Notifications: ${notifications.length}`);
    const disputeNotifs = notifications.filter(n => n.title?.toLowerCase().includes('dispute') || n.message?.toLowerCase().includes('dispute'));
    console.log(`Dispute Related Notifications: ${disputeNotifs.length}`);
    disputeNotifs.forEach(n => {
        console.log(`   -> Notif ID: ${n._id} | User: ${n.userId} | Title: ${n.title} | Msg: ${n.message}`);
    });

    await mongoose.disconnect();
}

run();
