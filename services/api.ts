
import { User, Deposit, Transaction, Notification, Withdrawal, PaymentMethod, InvestmentPlan, Rule, Settings, Transfer, Log, PasswordResetRequest, Dispute, UserRestrictions, Currency, Status } from '../types';
import { 
    mockUsers, mockDeposits, mockWithdrawals, mockTransactions, mockNotifications, 
    mockPaymentMethods, mockInvestmentPlans, mockRules, mockSettings, mockTransfers, 
    mockLogs, mockPasswordResets, mockDisputes 
} from '../data/mockData';

// --- Local Storage Helpers ---
const STORAGE_KEYS = {
    USERS: 'se_users',
    DEPOSITS: 'se_deposits',
    WITHDRAWALS: 'se_withdrawals',
    TRANSACTIONS: 'se_transactions',
    NOTIFICATIONS: 'se_notifications',
    PAYMENT_METHODS: 'se_payment_methods',
    INVESTMENT_PLANS: 'se_investment_plans',
    RULES: 'se_rules',
    SETTINGS: 'se_settings',
    TRANSFERS: 'se_transfers',
    LOGS: 'se_logs',
    PASSWORD_RESETS: 'se_password_resets',
    DISPUTES: 'se_disputes'
};

const loadData = <T>(key: string, defaultData: T): T => {
    const stored = localStorage.getItem(key);
    if (!stored) {
        localStorage.setItem(key, JSON.stringify(defaultData));
        return defaultData;
    }
    try {
        return JSON.parse(stored);
    } catch (e) {
        return defaultData;
    }
};

const saveData = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getUploadsBaseUrl() {
    return ''; // No real uploads in mock mode
}

// --- INITIALIZATION ---
// Load initial data into memory from LocalStorage or MockData
let users = loadData(STORAGE_KEYS.USERS, mockUsers);
let deposits = loadData(STORAGE_KEYS.DEPOSITS, mockDeposits);
let withdrawals = loadData(STORAGE_KEYS.WITHDRAWALS, mockWithdrawals);
let transactions = loadData(STORAGE_KEYS.TRANSACTIONS, mockTransactions);
let notifications = loadData(STORAGE_KEYS.NOTIFICATIONS, mockNotifications);
let paymentMethods = loadData(STORAGE_KEYS.PAYMENT_METHODS, mockPaymentMethods);
let investmentPlans = loadData(STORAGE_KEYS.INVESTMENT_PLANS, mockInvestmentPlans);
let rules = loadData(STORAGE_KEYS.RULES, mockRules);
let settings = loadData(STORAGE_KEYS.SETTINGS, mockSettings);
let transfers = loadData(STORAGE_KEYS.TRANSFERS, mockTransfers);
let logs = loadData(STORAGE_KEYS.LOGS, mockLogs);
let passwordResetRequests = loadData(STORAGE_KEYS.PASSWORD_RESETS, mockPasswordResets);
let disputes = loadData(STORAGE_KEYS.DISPUTES, mockDisputes);

// Force update settings to ensure new keys exist
if (!settings.exchangeRates || !settings.exchangeRates.PKR || settings.exchangeRates.PKR === 1) {
    settings.exchangeRates = { 
        USD: 1, 
        EUR: 0.92, 
        PKR: 278.50,
        ...(settings.exchangeRates || {}) // keep others if valid
    };
    // Ensure PKR is set to default if it was missing or 1
    if(!settings.exchangeRates.PKR || settings.exchangeRates.PKR === 1) settings.exchangeRates.PKR = 278.50;
    saveData(STORAGE_KEYS.SETTINGS, settings);
}

// --- API IMPLEMENTATION ---

export const getUsers = async (): Promise<User[]> => {
    await delay(300);
    return [...users];
};

export const createUser = async (userData: Partial<User>): Promise<User> => {
    await delay(300);
    const newUser: User = {
        _id: `u${Date.now()}`,
        activePlans: [],
        activePlan: 'None',
        walletBalance: 0,
        registrationDate: new Date().toISOString(),
        status: Status.Active,
        currency: 'USD', // Default
        fullName: userData.fullName || '',
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        country: userData.country || '',
        ...userData,
        restrictions: { deposit: false, withdrawal: false, transfer: false, earning: false, dispute: false, excludeFromTicker: false }
    };
    
    // Logic for auto-currency
    if (newUser.country.toLowerCase() === 'pakistan') newUser.currency = 'PKR';
    else if (['germany', 'france', 'italy', 'spain'].includes(newUser.country.toLowerCase())) newUser.currency = 'EUR';

    users.push(newUser);
    saveData(STORAGE_KEYS.USERS, users);
    
    // Notification
    const notif = {
        _id: `n${Date.now()}`,
        userId: newUser._id,
        message: `Welcome to SmartEarning, ${newUser.fullName}!`,
        read: false,
        date: new Date().toISOString(),
        isPopup: true
    };
    notifications.push(notif);
    saveData(STORAGE_KEYS.NOTIFICATIONS, notifications);

    return newUser;
};

export const updateUser = async (id: string, userData: Partial<User>): Promise<User> => {
    await delay(300);
    const index = users.findIndex(u => u._id === id);
    if (index === -1) throw new Error('User not found');
    
    users[index] = { ...users[index], ...userData };
    saveData(STORAGE_KEYS.USERS, users);
    return users[index];
};

export const deleteUser = async (id: string): Promise<{}> => {
    await delay(300);
    users = users.filter(u => u._id !== id);
    saveData(STORAGE_KEYS.USERS, users);
    return {};
};

export const bulkUpdateUserRestrictions = async (payload: any): Promise<{ message: string }> => {
    await delay(500);
    // Logic omitted for brevity in mock, just return success
    return { message: 'Bulk update simulated successfully' };
};

export const login = async (email: string, password: string): Promise<User> => {
    await delay(500);
    // Allow admin login without checking password for demo
    if (email === 'admin' || email === 'admin@smartearning.com') {
        const admin = users.find(u => u.username === 'admin');
        if (admin) return admin;
    }
    
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error('Invalid credentials');
    if (user.status === 'Blocked') throw new Error('Account blocked');
    return user;
};

export const adjustUserWallet = async (id: string, data: { amount: number; description: string }): Promise<{ user: User; transaction: Transaction }> => {
    await delay(300);
    const index = users.findIndex(u => u._id === id);
    if (index === -1) throw new Error('User not found');

    const user = users[index];
    const newBalance = user.walletBalance + data.amount;
    users[index] = { ...user, walletBalance: newBalance };
    saveData(STORAGE_KEYS.USERS, users);

    const tx: Transaction = {
        _id: `tx${Date.now()}`,
        userId: user._id,
        userName: user.username,
        currency: user.currency,
        type: data.amount > 0 ? 'Manual Credit' : 'Manual Debit',
        amount: data.amount,
        description: data.description,
        status: 'Approved',
        date: new Date().toISOString()
    };
    transactions.push(tx);
    saveData(STORAGE_KEYS.TRANSACTIONS, transactions);

    return { user: users[index], transaction: tx };
};

export const purchasePlan = async (userId: string, planId: string): Promise<{ user: User; transaction: Transaction }> => {
    await delay(500);
    const userIndex = users.findIndex(u => u._id === userId);
    const plan = investmentPlans.find(p => p._id === planId);
    
    if (userIndex === -1 || !plan) throw new Error('User or Plan not found');
    const user = users[userIndex];

    if (user.walletBalance < plan.price) throw new Error('Insufficient balance');

    // Deduct
    const newBalance = user.walletBalance - plan.price;
    const newActivePlans = [...(user.activePlans || []), {
        planId: plan._id,
        planName: plan.name,
        price: plan.price,
        purchaseDate: new Date().toISOString()
    }];

    users[userIndex] = { ...user, walletBalance: newBalance, activePlans: newActivePlans, activePlan: plan.name };
    saveData(STORAGE_KEYS.USERS, users);

    const tx: Transaction = {
        _id: `tx${Date.now()}`,
        userId: user._id,
        userName: user.username,
        currency: user.currency,
        type: 'Plan Purchase',
        amount: -plan.price,
        description: `Purchased ${plan.name} plan`,
        status: 'Approved',
        date: new Date().toISOString()
    };
    transactions.push(tx);
    saveData(STORAGE_KEYS.TRANSACTIONS, transactions);

    return { user: users[userIndex], transaction: tx };
};

// --- DEPOSITS ---
export const getDeposits = async () => { await delay(200); return deposits; };
export const createDeposit = async (formData: FormData): Promise<{deposit: Deposit, transaction: Transaction}> => {
    await delay(500);
    // Mock extraction from FormData
    const userId = formData.get('userId') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const user = users.find(u => u._id === userId);
    if (!user) throw new Error('User not found');

    const newDeposit: Deposit = {
        _id: `d${Date.now()}`,
        userId,
        userName: user.username,
        amount,
        currency: user.currency,
        method: formData.get('method') as string,
        transactionId: formData.get('transactionId') as string,
        senderAccountTitle: formData.get('senderAccountTitle') as string,
        status: Status.Pending,
        date: new Date().toISOString(),
        receiptUrl: 'https://via.placeholder.com/150?text=Receipt' // Mock image
    };
    deposits.unshift(newDeposit);
    saveData(STORAGE_KEYS.DEPOSITS, deposits);

    const tx: Transaction = {
        _id: `tx${Date.now()}`,
        userId,
        userName: user.username,
        currency: user.currency,
        type: 'Deposit',
        amount: amount,
        status: 'Pending',
        description: `Pending Deposit #${newDeposit._id}`,
        date: new Date().toISOString()
    };
    transactions.unshift(tx);
    saveData(STORAGE_KEYS.TRANSACTIONS, transactions);

    return { deposit: newDeposit, transaction: tx };
};

export const updateDeposit = async (id: string, updateData: Partial<Deposit>): Promise<{deposit: Deposit, user: User}> => {
    await delay(300);
    const index = deposits.findIndex(d => d._id === id);
    if (index === -1) throw new Error('Deposit not found');
    
    const oldStatus = deposits[index].status;
    const newStatus = updateData.status;
    deposits[index] = { ...deposits[index], ...updateData };
    saveData(STORAGE_KEYS.DEPOSITS, deposits);

    const userIndex = users.findIndex(u => u._id === deposits[index].userId);
    const user = users[userIndex];

    if (oldStatus !== 'Approved' && newStatus === 'Approved') {
        users[userIndex] = { ...user, walletBalance: user.walletBalance + deposits[index].amount };
        saveData(STORAGE_KEYS.USERS, users);
        
        // Update Transaction Status
        const txIndex = transactions.findIndex(t => t.description.includes(deposits[index]._id));
        if (txIndex !== -1) {
            transactions[txIndex].status = 'Approved';
            transactions[txIndex].description = `Approved Deposit #${deposits[index]._id}`;
            saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
        }
    }

    return { deposit: deposits[index], user: users[userIndex] };
};

// --- WITHDRAWALS ---
export const getWithdrawals = async () => { await delay(200); return withdrawals; };
export const createWithdrawal = async (data: Partial<Withdrawal>): Promise<any> => {
    await delay(500);
    const userIndex = users.findIndex(u => u._id === data.userId);
    const user = users[userIndex];
    if (user.walletBalance < (data.amount || 0)) throw new Error('Insufficient balance');

    // Deduct immediately
    users[userIndex] = { ...user, walletBalance: user.walletBalance - (data.amount || 0) };
    saveData(STORAGE_KEYS.USERS, users);

    const newWithdrawal: Withdrawal = {
        _id: `w${Date.now()}`,
        ...data as any,
        status: Status.Pending,
        date: new Date().toISOString()
    };
    withdrawals.unshift(newWithdrawal);
    saveData(STORAGE_KEYS.WITHDRAWALS, withdrawals);

    const tx: Transaction = {
        _id: `tx${Date.now()}`,
        userId: user._id,
        userName: user.username,
        currency: user.currency,
        type: 'Withdrawal Request',
        amount: -(data.amount || 0),
        status: 'Pending',
        description: `Pending Withdrawal #${newWithdrawal._id}`,
        date: new Date().toISOString()
    };
    transactions.unshift(tx);
    saveData(STORAGE_KEYS.TRANSACTIONS, transactions);

    return { withdrawal: newWithdrawal, user: users[userIndex], transaction: tx };
};

export const updateWithdrawal = async (id: string, updateData: Partial<Withdrawal>): Promise<any> => {
    await delay(300);
    const index = withdrawals.findIndex(w => w._id === id);
    if (index === -1) throw new Error('Withdrawal not found');
    
    const oldStatus = withdrawals[index].status;
    const newStatus = updateData.status;
    
    withdrawals[index] = { ...withdrawals[index], ...updateData };
    saveData(STORAGE_KEYS.WITHDRAWALS, withdrawals);
    
    const userIndex = users.findIndex(u => u._id === withdrawals[index].userId);
    const user = users[userIndex];

    // If rejected, refund
    if (oldStatus !== 'Rejected' && newStatus === 'Rejected') {
        users[userIndex] = { ...user, walletBalance: user.walletBalance + withdrawals[index].amount };
        saveData(STORAGE_KEYS.USERS, users);
        
        // Add Refund Transaction
        const tx: Transaction = {
            _id: `tx${Date.now()}`,
            userId: user._id,
            userName: user.username,
            currency: user.currency,
            type: 'Withdrawal Refund',
            amount: withdrawals[index].amount,
            status: 'Approved',
            description: `Refund for rejected withdrawal #${id}`,
            date: new Date().toISOString()
        };
        transactions.unshift(tx);
        saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
    }
    
    if (newStatus === 'Paid') {
         const txIndex = transactions.findIndex(t => t.description.includes(id));
         if(txIndex !== -1) {
             transactions[txIndex].status = 'Approved';
             transactions[txIndex].description = `Paid Withdrawal #${id}`;
             saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
         }
    }

    return { withdrawal: withdrawals[index], user: users[userIndex] };
};

// --- OTHERS ---
export const getTransactions = async () => { await delay(200); return transactions; };
export const getNotifications = async () => { await delay(200); return notifications; };
export const sendAdminNotification = async (data: any) => { 
    await delay(200); 
    // Simplified logic: just add a notification for the first target found or dummy
    return { count: 1, data: [] }; 
};
export const updateNotification = async (id: string, data: any) => {
    const idx = notifications.findIndex(n => n._id === id);
    if(idx !== -1) {
        notifications[idx] = { ...notifications[idx], ...data };
        saveData(STORAGE_KEYS.NOTIFICATIONS, notifications);
        return notifications[idx];
    }
    throw new Error("Not found");
}
export const markNotificationsAsRead = async (userId: string) => {
    notifications.forEach(n => { if (n.userId === userId) n.read = true; });
    saveData(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return notifications;
};
export const markNotificationPopupAsShown = async (id: string) => {
    const idx = notifications.findIndex(n => n._id === id);
    if(idx !== -1) {
        notifications[idx].popupShown = true;
        saveData(STORAGE_KEYS.NOTIFICATIONS, notifications);
    }
    return notifications;
}

export const getPaymentMethods = async () => { await delay(200); return paymentMethods; };
export const createPaymentMethod = async (data: any) => { 
    const newItem = { ...data, _id: `pm${Date.now()}` }; 
    paymentMethods.push(newItem); 
    saveData(STORAGE_KEYS.PAYMENT_METHODS, paymentMethods); 
    return newItem; 
};
export const updatePaymentMethod = async (id: string, data: any) => {
    const idx = paymentMethods.findIndex(p => p._id === id);
    paymentMethods[idx] = { ...paymentMethods[idx], ...data };
    saveData(STORAGE_KEYS.PAYMENT_METHODS, paymentMethods);
    return paymentMethods[idx];
};
export const deletePaymentMethod = async (id: string) => {
    paymentMethods = paymentMethods.filter(p => p._id !== id);
    saveData(STORAGE_KEYS.PAYMENT_METHODS, paymentMethods);
    return {};
};

export const getInvestmentPlans = async () => { await delay(200); return investmentPlans; };
export const createInvestmentPlan = async (data: any) => {
    const newItem = { ...data, _id: `p${Date.now()}` };
    investmentPlans.push(newItem);
    saveData(STORAGE_KEYS.INVESTMENT_PLANS, investmentPlans);
    return newItem;
};
export const updateInvestmentPlan = async (id: string, data: any) => {
    const idx = investmentPlans.findIndex(p => p._id === id);
    investmentPlans[idx] = { ...investmentPlans[idx], ...data };
    saveData(STORAGE_KEYS.INVESTMENT_PLANS, investmentPlans);
    return investmentPlans[idx];
};
export const deleteInvestmentPlan = async (id: string) => {
    investmentPlans = investmentPlans.filter(p => p._id !== id);
    saveData(STORAGE_KEYS.INVESTMENT_PLANS, investmentPlans);
    return {};
};

export const getRules = async () => { await delay(200); return rules; };
export const createRule = async (data: any) => {
    const newItem = { ...data, _id: `r${Date.now()}` };
    rules.push(newItem);
    saveData(STORAGE_KEYS.RULES, rules);
    return newItem;
};
export const deleteRule = async (id: string) => {
    rules = rules.filter(r => r._id !== id);
    saveData(STORAGE_KEYS.RULES, rules);
    return {};
};

export const getSettings = async () => { await delay(200); return settings; };
export const updateSettings = async (data: any) => {
    settings = { ...settings, ...data };
    saveData(STORAGE_KEYS.SETTINGS, settings);
    return settings;
};

export const getTransfers = async () => { await delay(200); return transfers; };
export const createTransfer = async (data: any) => {
    await delay(300);
    const sender = users.find(u => u._id === data.senderId);
    const recipient = users.find(u => u._id === data.recipientId);
    if (!sender || !recipient) throw new Error('User not found');
    
    // Fee Logic Mock
    const fee = 0; // Simplify for mock
    const total = data.amount + fee;
    
    if (sender.walletBalance < total) throw new Error('Insufficient funds');
    
    // Deduct
    sender.walletBalance -= total;
    saveData(STORAGE_KEYS.USERS, users);

    const newItem = { 
        ...data, 
        currency: sender.currency, // Ensure source currency is saved
        _id: `tr${Date.now()}`, 
        status: 'Pending', 
        fee, 
        totalDeducted: total, 
        date: new Date().toISOString() 
    };
    transfers.unshift(newItem);
    saveData(STORAGE_KEYS.TRANSFERS, transfers);
    
    return { transfer: newItem, user: sender, transaction: {} as any };
};
export const updateTransfer = async (id: string, data: any): Promise<{ transfer: Transfer, sender?: User, recipient?: User, transaction?: Transaction }> => {
    await delay(300);
    const idx = transfers.findIndex(t => t._id === id);
    transfers[idx] = { ...transfers[idx], ...data };
    
    let sender: User | undefined;
    let recipient: User | undefined;
    let transaction: Transaction | undefined;

    if (data.status === 'Approved') {
        const t = transfers[idx];
        recipient = users.find(u => u._id === t.recipientId);
        sender = users.find(u => u._id === t.senderId);

        if(recipient) {
            // Dynamic Conversion Logic
            let amountToAdd = t.amount;
            const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278.50 };
            const fromCurr = t.currency;
            const toCurr = recipient.currency;

            if (fromCurr && toCurr && fromCurr !== toCurr) {
                const fromRate = rates[fromCurr as Currency] || 1;
                const toRate = rates[toCurr as Currency] || 1;
                // Convert to USD base then to target currency
                const amountInUSD = t.amount / fromRate;
                amountToAdd = amountInUSD * toRate;
                // Round to 2 decimals
                amountToAdd = Math.round(amountToAdd * 100) / 100;
            }
            
            recipient.walletBalance += amountToAdd;
            users = users.map(u => u._id === recipient!._id ? recipient! : u);
            saveData(STORAGE_KEYS.USERS, users);
        }
    }
    
    saveData(STORAGE_KEYS.TRANSFERS, transfers);
    return { transfer: transfers[idx], sender, recipient, transaction };
};

export const getLogs = async () => { await delay(200); return logs; };
export const clearLogs = async () => { logs = []; saveData(STORAGE_KEYS.LOGS, logs); return []; };

export const getPasswordResetRequests = async () => { await delay(200); return passwordResetRequests; };
export const deletePasswordResetRequest = async (id: string) => {
    passwordResetRequests = passwordResetRequests.filter(p => p._id !== id);
    saveData(STORAGE_KEYS.PASSWORD_RESETS, passwordResetRequests);
    return {};
};
export const adminInitiatePasswordReset = async (id: string) => ({ resetToken: 'mock-token' });
export const userRequestPasswordReset = async (email: string) => {}; // No op
export const verifyResetToken = async (token: string) => {}; // No op
export const resetPasswordWithToken = async (token: string, pass: string) => {}; // No op

export const getDisputes = async () => { await delay(200); return disputes; };
export const createDispute = async (data: any): Promise<Dispute> => {
    const newItem: Dispute = { 
        _id: `ds${Date.now()}`,
        userId: data.get('userId'),
        userName: data.get('userName'),
        type: data.get('type'),
        referenceId: data.get('referenceId'),
        description: data.get('description'),
        status: Status.Open,
        date: new Date().toISOString(),
        adminUnread: true
    };
    disputes.unshift(newItem);
    saveData(STORAGE_KEYS.DISPUTES, disputes);
    return newItem;
};
export const updateDispute = async (id: string, data: any) => {
    const idx = disputes.findIndex(d => d._id === id);
    
    if (data instanceof FormData) {
       // Mock file logic
       const msg = data.get('newMessage') as string;
       if(msg) {
           if(!disputes[idx].messages) disputes[idx].messages = [];
           disputes[idx].messages!.push({ sender: 'Admin', message: msg, date: new Date().toISOString() });
       }
    } else {
        if(data.status) disputes[idx].status = data.status;
    }
    
    saveData(STORAGE_KEYS.DISPUTES, disputes);
    return disputes[idx];
};
export const markDisputeAsRead = async (id: string, role: string) => {
    const idx = disputes.findIndex(d => d._id === id);
    if (role === 'admin') disputes[idx].adminUnread = false;
    else disputes[idx].userUnread = false;
    saveData(STORAGE_KEYS.DISPUTES, disputes);
    return disputes[idx];
};
