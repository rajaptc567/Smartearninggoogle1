import PaymentMethod from '../models/PaymentMethod.js';
import Setting from '../models/Setting.js';

// Clean standard fallback logos map for popular gateways
const STANDARD_FALLBACK_LOGOS = {
    'easypaisa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Easypaisa_logo.png/320px-Easypaisa_logo.png',
    'jazzcash': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Jazzcash_logo.png/320px-Jazzcash_logo.png',
    'bank transfer': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
    'paypal': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
    'stripe': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
    'payoneer': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Payoneer_logo.svg',
    'crypto': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    'usdt': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    'usdt (trc20)': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    'visa': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg',
    'perfect money': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Perfect_Money_logo.png',
    'payeer': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Payeer_logo.png'
};

/**
 * Public lightweight payment methods endpoint:
 * Returns only the minimal fields required for homepage / public rendering.
 * Strips Base64 image blobs, admin credentials, instructions, account numbers, and confirmation configs.
 */
export const getPublicPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find({ status: { $ne: 'Disabled' } })
            .select('name currency type minAmount maxAmount status logoUrl')
            .lean();

        // Sanitize any large Base64 logos to keep payload ultra-light (< 5 KB total)
        const sanitized = methods.map(m => {
            let logoUrl = m.logoUrl || '';
            // If logo is a huge Base64 string (> 500 chars), replace with lightweight fallback if available
            if (logoUrl.startsWith('data:image/') && logoUrl.length > 500) {
                const lowerName = (m.name || '').toLowerCase().trim();
                const matchedLogo = Object.keys(STANDARD_FALLBACK_LOGOS).find(k => lowerName.includes(k));
                logoUrl = matchedLogo ? STANDARD_FALLBACK_LOGOS[matchedLogo] : '';
            }
            return {
                _id: m._id,
                name: m.name,
                currency: m.currency,
                type: m.type,
                minAmount: m.minAmount,
                maxAmount: m.maxAmount,
                status: m.status,
                logoUrl
            };
        });

        // Set caching headers for optimal public delivery
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.status(200).json({ success: true, data: sanitized });
    } catch (err) {
        return res.status(200).json({ success: false, data: [], error: err.message });
    }
};

export const getPaymentMethods = async (req, res) => {
    try {
        // If caller explicitly requested lightweight public data
        if (req.query.public === 'true') {
            return getPublicPaymentMethods(req, res);
        }

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

        // Parse confirmationFields if it comes as a string or array
        if (methodData.confirmationFields) {
            if (typeof methodData.confirmationFields === 'string') {
                try {
                    methodData.confirmationFields = JSON.parse(methodData.confirmationFields);
                } catch (e) {
                    console.error("Failed to parse confirmationFields string", e);
                    methodData.confirmationFields = [];
                }
            } else if (Array.isArray(methodData.confirmationFields)) {
                let parsedList = [];
                for (const item of methodData.confirmationFields) {
                    if (typeof item === 'string') {
                        if (item === '[object Object]') continue;
                        try {
                            const parsed = JSON.parse(item);
                            if (Array.isArray(parsed)) {
                                parsedList = parsedList.concat(parsed);
                            } else if (parsed && typeof parsed === 'object') {
                                parsedList.push(parsed);
                            }
                        } catch (e) {
                            console.error("Failed to parse confirmationFields item", e);
                        }
                    } else if (item && typeof item === 'object') {
                        parsedList.push(item);
                    }
                }
                methodData.confirmationFields = parsedList;
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

        // Parse confirmationFields if it comes as a string or array
        if (methodData.confirmationFields) {
            if (typeof methodData.confirmationFields === 'string') {
                try {
                    methodData.confirmationFields = JSON.parse(methodData.confirmationFields);
                } catch (e) {
                    console.error("Failed to parse confirmationFields string", e);
                    methodData.confirmationFields = [];
                }
            } else if (Array.isArray(methodData.confirmationFields)) {
                let parsedList = [];
                for (const item of methodData.confirmationFields) {
                    if (typeof item === 'string') {
                        if (item === '[object Object]') continue;
                        try {
                            const parsed = JSON.parse(item);
                            if (Array.isArray(parsed)) {
                                parsedList = parsedList.concat(parsed);
                            } else if (parsed && typeof parsed === 'object') {
                                parsedList.push(parsed);
                            }
                        } catch (e) {
                            console.error("Failed to parse confirmationFields item", e);
                        }
                    } else if (item && typeof item === 'object') {
                        parsedList.push(item);
                    }
                }
                methodData.confirmationFields = parsedList;
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