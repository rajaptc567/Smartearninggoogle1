import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';

dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const txs = await Transaction.find({ type: { $in: ['Currency Conversion', 'Campaign Creation', 'Task Budget Deduction', 'Investment To Task Wallet Transfer', 'Task Reward'] } }).lean();
    console.log('Sample Txs count:', txs.length);
    console.log('Sample Txs:', txs.slice(0, 15).map(t => ({
        id: t._id,
        user: t.userName,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        amountUSD: t.amountUSD,
        desc: t.description
    })));
    await mongoose.disconnect();
}
check();
