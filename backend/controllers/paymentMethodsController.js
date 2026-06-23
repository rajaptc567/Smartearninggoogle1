import PaymentMethod from '../models/PaymentMethod.js';
import Setting from '../models/Setting.js';

export const getPaymentMethods = async (req, res) => {
    try {
        let methods = await PaymentMethod.find();
        
        // Seed default methods if none exist
        if (methods.length === 0) {
            const defaultMethods = [
                {
                    name: 'Easypaisa',
                    currency: 'PKR',
                    type: 'Deposit',
                    accountTitle: 'SmartEarning EP',
                    accountNumber: '03001234567',
                    instructions: 'Please send the amount to the Easypaisa account provided and upload the transaction receipt.',
                    status: 'Enabled',
                    minAmount: 500,
                    maxAmount: 50000,
                    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/archive/8/82/20210207125345%21Easypaisa_logo.png' 
                },
                {
                    name: 'JazzCash',
                    currency: 'PKR',
                    type: 'Deposit',
                    accountTitle: 'SmartEarning JC',
                    accountNumber: '03011234567',
                    instructions: 'Please send the amount to the JazzCash account provided and upload the transaction receipt.',
                    status: 'Enabled',
                    minAmount: 500,
                    maxAmount: 50000,
                    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/JazzCash_logo.png' 
                },
                {
                    name: 'Bank Transfer',
                    currency: 'PKR',
                    type: 'Deposit',
                    accountTitle: 'SmartEarning Bank',
                    accountNumber: 'PK00MEZN0000000000000000',
                    instructions: 'Transfer funds to the bank account via internet banking or ATM. Upload proof.',
                    status: 'Enabled',
                    minAmount: 1000,
                    maxAmount: 1000000,
                    logoUrl: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png' 
                },
                {
                    name: 'PayPal',
                    currency: 'USD',
                    type: 'Deposit',
                    accountTitle: 'SmartEarning LLC',
                    accountNumber: 'payments@smartearning.com',
                    instructions: 'Send payment via PayPal using Friends & Family option if possible to avoid extra fees.',
                    status: 'Enabled',
                    minAmount: 10,
                    maxAmount: 5000,
                    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg' 
                },
                {
                    name: 'Stripe',
                    currency: 'USD',
                    type: 'Deposit',
                    accountTitle: 'Stripe Payment',
                    accountNumber: 'Link via Dashboard',
                    instructions: 'Use the payment link provided in your dashboard to pay via Credit/Debit Card.',
                    status: 'Enabled',
                    minAmount: 10,
                    maxAmount: 5000,
                    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' 
                },
                {
                    name: 'Payoneer',
                    currency: 'USD',
                    type: 'Deposit',
                    accountTitle: 'SmartEarning Payoneer',
                    accountNumber: 'payoneer@smartearning.com',
                    instructions: 'Send USD balance to our Payoneer email.',
                    status: 'Enabled',
                    minAmount: 50,
                    maxAmount: 10000,
                    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Payoneer_logo.svg' 
                },
                {
                    name: 'Crypto',
                    currency: 'USD',
                    type: 'Deposit',
                    accountTitle: 'USDT TRC20',
                    accountNumber: 'TWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                    instructions: 'Send USDT (TRC20) only. Upload the hash/TXID proof.',
                    status: 'Enabled',
                    minAmount: 20,
                    maxAmount: 100000,
                    logoUrl: 'https://upload.wikimedia.org/wikipedia/thumb/4/46/Bitcoin.svg/1200px-Bitcoin.svg.png' 
                }
            ];
            
            methods = await PaymentMethod.insertMany(defaultMethods);
        }

        res.status(200).json({ success: true, data: methods });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const createPaymentMethod = async (req, res) => {
    try {
        const methodData = { ...req.body };

        if (req.files) {
            if (req.files['logo']) {
                const b64 = Buffer.from(req.files['logo'][0].buffer).toString('base64');
                methodData.logoUrl = `data:${req.files['logo'][0].mimetype};base64,${b64}`;
            }
            if (req.files['qrCode']) {
                const b64 = Buffer.from(req.files['qrCode'][0].buffer).toString('base64');
                methodData.qrCodeUrl = `data:${req.files['qrCode'][0].mimetype};base64,${b64}`;
            }
        }

        // Parse customFields if it comes as a string (FormData)
        if (methodData.customFields && typeof methodData.customFields === 'string') {
            try {
                methodData.customFields = JSON.parse(methodData.customFields);
            } catch (e) {
                console.error("Failed to parse customFields", e);
                methodData.customFields = [];
            }
        }

        // Parse confirmationFields if it comes as a string
        if (methodData.confirmationFields && typeof methodData.confirmationFields === 'string') {
            try {
                methodData.confirmationFields = JSON.parse(methodData.confirmationFields);
            } catch (e) {
                console.error("Failed to parse confirmationFields", e);
                methodData.confirmationFields = [];
            }
        }

        // Parse customLabels if it comes as a string
        if (methodData.customLabels && typeof methodData.customLabels === 'string') {
            try {
                methodData.customLabels = JSON.parse(methodData.customLabels);
            } catch (e) {
                console.error("Failed to parse customLabels", e);
            }
        }

        // Parse howToDeposit if it comes as a string
        if (methodData.howToDeposit && typeof methodData.howToDeposit === 'string') {
            try {
                methodData.howToDeposit = JSON.parse(methodData.howToDeposit);
            } catch (e) {
                console.error("Failed to parse howToDeposit", e);
            }
        }

        const method = await PaymentMethod.create(methodData);
        
        // Update version for real-time sync and notify connected clients
        await Setting.bumpVersion();
        const io = req.app.get('io');
        if (io) {
            io.emit('DATA_CHANGED');
        }
        
        res.status(201).json({ success: true, data: method });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const updatePaymentMethod = async (req, res) => {
    try {
        const methodData = { ...req.body };

        if (req.files) {
            if (req.files['logo']) {
                const b64 = Buffer.from(req.files['logo'][0].buffer).toString('base64');
                methodData.logoUrl = `data:${req.files['logo'][0].mimetype};base64,${b64}`;
            }
            if (req.files['qrCode']) {
                const b64 = Buffer.from(req.files['qrCode'][0].buffer).toString('base64');
                methodData.qrCodeUrl = `data:${req.files['qrCode'][0].mimetype};base64,${b64}`;
            }
        }

        // Handle QR code removal flag
        if (methodData.removeQrCode === 'true') {
            // Only remove if a new file wasn't uploaded in the same request
            if (!req.files || !req.files['qrCode']) {
                methodData.qrCodeUrl = '';
            }
        }

        // Parse customFields if it comes as a string (FormData)
        if (methodData.customFields && typeof methodData.customFields === 'string') {
            try {
                methodData.customFields = JSON.parse(methodData.customFields);
            } catch (e) {
                console.error("Failed to parse customFields", e);
                methodData.customFields = [];
            }
        }

        // Parse confirmationFields if it comes as a string
        if (methodData.confirmationFields && typeof methodData.confirmationFields === 'string') {
            try {
                methodData.confirmationFields = JSON.parse(methodData.confirmationFields);
            } catch (e) {
                console.error("Failed to parse confirmationFields", e);
                methodData.confirmationFields = [];
            }
        }

        // Parse customLabels if it comes as a string
        if (methodData.customLabels && typeof methodData.customLabels === 'string') {
            try {
                methodData.customLabels = JSON.parse(methodData.customLabels);
            } catch (e) {
                console.error("Failed to parse customLabels", e);
            }
        }

        // Parse howToDeposit if it comes as a string
        if (methodData.howToDeposit && typeof methodData.howToDeposit === 'string') {
            try {
                methodData.howToDeposit = JSON.parse(methodData.howToDeposit);
            } catch (e) {
                console.error("Failed to parse howToDeposit", e);
            }
        }

        const method = await PaymentMethod.findByIdAndUpdate(req.params.id, methodData, { new: true, runValidators: true });
        if (!method) return res.status(404).json({ success: false, error: 'Payment method not found' });
        
        // Update version for real-time sync and notify connected clients
        await Setting.bumpVersion();
        const io = req.app.get('io');
        if (io) {
            io.emit('DATA_CHANGED');
        }
        
        res.status(200).json({ success: true, data: method });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

export const deletePaymentMethod = async (req, res) => {
    try {
        const method = await PaymentMethod.findByIdAndDelete(req.params.id);
        if (!method) return res.status(404).json({ success: false, error: 'Payment method not found' });
        
        // Update version for real-time sync and notify connected clients
        await Setting.bumpVersion();
        const io = req.app.get('io');
        if (io) {
            io.emit('DATA_CHANGED');
        }
        
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};