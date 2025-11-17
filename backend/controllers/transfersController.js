
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';

export const getTransfers = async (req, res) => {
    try {
        const transfers = await Transfer.find().sort({ date: -1 });
        res.status(200).json({ success: true, data: transfers });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createTransfer = async (req, res) => {
    const { senderId, recipientId, amount } = req.body;
    try {
        const sender = await User.findById(senderId);
        const recipient = await User.findById(recipientId);

        if (!sender || !recipient) {
            return res.status(404).json({ success: false, error: 'Sender or recipient not found.' });
        }
        if (sender.walletBalance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient funds.' });
        }

        sender.walletBalance -= amount;
        
        const transfer = await Transfer.create(req.body);

        const transaction = await Transaction.create({
            userId: sender._id,
            userName: sender.username,
            type: 'Transfer Request',
            amount: -amount,
            description: `Transfer request to ${recipient.username}`,
            status: 'Pending'
        });
        
        await Notification.create({
            userId: sender._id,
            message: `Your transfer of $${amount} to ${recipient.username} is pending approval.`
        });
        
        await sender.save();

        res.status(201).json({ success: true, data: { transfer, user: sender, transaction }});

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updateTransfer = async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        let transfer = await Transfer.findById(req.params.id);
        if (!transfer || transfer.status !== 'Pending') {
            return res.status(400).json({ success: false, error: 'Transfer not found or already processed.' });
        }

        const sender = await User.findById(transfer.senderId);
        const recipient = await User.findById(transfer.recipientId);
        if (!sender || !recipient) {
            return res.status(404).json({ success: false, error: 'Sender or recipient user not found.' });
        }

        let transaction;

        if (status === 'Approved') {
            recipient.walletBalance += transfer.amount;
            await recipient.save();

            transaction = await Transaction.create({
                userId: recipient._id,
                userName: recipient.username,
                type: 'Transfer Received',
                amount: transfer.amount,
                description: `Received from ${sender.username}`,
                status: 'Approved'
            });

            await Notification.create({ userId: sender._id, message: `Your transfer to ${recipient.username} was approved.` });
            await Notification.create({ userId: recipient._id, message: `You received $${transfer.amount} from ${sender.username}.` });
        
        } else if (status === 'Rejected') {
            sender.walletBalance += transfer.amount;
            await sender.save();

            await Notification.create({ userId: sender._id, message: `Your transfer to ${recipient.username} was rejected and funds returned.` });
        }
        
        transfer.status = status;
        transfer.adminNotes = adminNotes;
        await transfer.save();
        
        res.status(200).json({ success: true, data: { transfer, sender, recipient, transaction }});

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
