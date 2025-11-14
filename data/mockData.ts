import { User, Deposit, Withdrawal, PaymentMethod, InvestmentPlan, Transaction, Status, Rule, Transfer, Notification } from '../types';

export const mockUsers: User[] = [
  { _id: '1', username: 'john.doe', fullName: 'John Doe', email: 'john.doe@example.com', phone: '123-456-7890', whatsapp: '1234567890', country: 'USA', walletBalance: 221.00, activePlan: 'Gold Plan', registrationDate: '2023-10-26', status: Status.Active, sponsor: 'admin' },
  { _id: '2', username: 'jane.smith', fullName: 'Jane Smith', email: 'jane.smith@example.com', phone: '234-567-8901', whatsapp: '2345678901', country: 'Canada', walletBalance: 50.00, activePlan: 'Silver Plan', registrationDate: '2023-10-25', status: Status.Active, sponsor: 'john.doe' },
  { _id: '3', username: 'sam.wilson', fullName: 'Sam Wilson', email: 'sam.wilson@example.com', phone: '345-678-9012', whatsapp: '3456789012', country: 'UK', walletBalance: 0, activePlan: 'None', registrationDate: '2023-10-24', status: Status.Pending, sponsor: 'jane.smith' },
  { _id: '4', username: 'chris.green', fullName: 'Chris Green', email: 'chris.green@example.com', phone: '456-789-0123', whatsapp: '4567890123', country: 'Australia', walletBalance: 55.20, activePlan: 'Bronze Plan', registrationDate: '2023-10-23', status: Status.Blocked, sponsor: 'john.doe' },
];

export const mockDeposits: Deposit[] = [];

export const mockWithdrawals: Withdrawal[] = [
    { _id: 'WDR2001', userId: '1', userName: 'john.doe', method: 'Easypaisa', amount: 50, fee: 2.5, finalAmount: 47.5, status: Status.Paid, date: '2023-10-26', accountTitle: 'John Doe', accountNumber: '03001234567' },
    { _id: 'WDR2002', userId: '2', userName: 'jane.smith', method: 'Bank Transfer', amount: 100, fee: 5, finalAmount: 95, status: Status.Pending, date: '2023-10-27', accountTitle: 'Jane Smith', accountNumber: '1234-5678-9012-3456', userNotes: 'Please process this quickly, thanks!' },
    { _id: 'WDR2003', userId: '1', userName: 'john.doe', method: 'BTC', amount: 75, fee: 3.75, finalAmount: 71.25, status: Status.Approved, date: '2023-10-25', accountTitle: 'John Doe BTC', accountNumber: 'bc1q...' },
    { _id: 'WDR2004', userId: '4', userName: 'chris.green', method: 'Easypaisa', amount: 50, fee: 2.5, finalAmount: 47.5, status: Status.Matching, date: '2023-10-28', accountTitle: 'Chris Green', accountNumber: '03129876543', matchRemainingAmount: 50 },
];

export const mockPaymentMethods: PaymentMethod[] = [
    { _id: '1', name: 'Easypaisa', type: 'Deposit', accountTitle: 'John Doe', accountNumber: '03001234567', instructions: 'Send to this account and upload receipt.', minAmount: 10, maxAmount: 1000, feePercent: 0, status: 'Enabled' },
    { _id: '2', name: 'JazzCash', type: 'Deposit', accountTitle: 'Jane Smith', accountNumber: '03017654321', instructions: 'Send and mention your username in reference.', minAmount: 10, maxAmount: 1000, feePercent: 0, status: 'Enabled' },
    { _id: '3', name: 'USDT (TRC20)', type: 'Withdrawal', accountTitle: 'Company Wallet', accountNumber: 'TXYZ...', instructions: 'Withdrawals are processed within 24 hours.', minAmount: 50, maxAmount: 5000, feePercent: 2, status: 'Enabled' },
    { _id: '4', name: 'Bank Transfer', type: 'Withdrawal', accountTitle: 'N/A', accountNumber: 'N/A', instructions: 'Provide your bank details in the form.', minAmount: 100, maxAmount: 10000, feePercent: 5, status: 'Disabled' },
];

export const mockInvestmentPlans: InvestmentPlan[] = [
    { 
        _id: '1', name: 'Bronze Plan', price: 50, durationDays: 30, minWithdraw: 10, description: 'A great starting plan.', status: Status.Active,
        directReferralLimit: 10,
        directCommission: { type: 'percentage', value: 10 },
        indirectCommissions: [
            { type: 'percentage', value: 5 },
            { type: 'percentage', value: 2 },
        ],
        commissionDeductions: {
            afterMaxPayout: { type: 'fixed', value: 10 },
            afterMaxEarning: { type: 'fixed', value: 10 },
            afterMaxDirect: { type: 'fixed', value: 5 },
        },
        autoUpgrade: { enabled: true, toPlanId: '2' },
        holdPosition: { enabled: true, slots: [9, 10] },
    },
    { 
        _id: '2', name: 'Silver Plan', price: 100, durationDays: 60, minWithdraw: 25, description: 'Balanced plan for steady growth.', status: Status.Active,
        directReferralLimit: 20,
        directCommission: { type: 'fixed', value: 25 },
        indirectCommissions: [
            { type: 'fixed', value: 10 },
            { type: 'fixed', value: 5 },
            { type: 'fixed', value: 2 },
        ],
        commissionDeductions: {
            afterMaxPayout: { type: 'percentage', value: 5 },
            afterMaxEarning: { type: 'percentage', value: 5 },
            afterMaxDirect: { type: 'percentage', value: 2 },
        },
        autoUpgrade: { enabled: true, toPlanId: '3' },
        holdPosition: { enabled: false, slots: [] },
    },
    { 
        _id: '3', name: 'Gold Plan', price: 200, durationDays: 0, minWithdraw: 100, description: 'Premium plan for maximum returns. Never expires.', status: Status.Active,
        directReferralLimit: 0,
        directCommission: { type: 'percentage', value: 15 },
        indirectCommissions: [
            { type: 'percentage', value: 7 },
            { type: 'percentage', value: 3 },
            { type: 'percentage', value: 1 },
            { type: 'percentage', value: 0.5 },
        ],
        commissionDeductions: {
            afterMaxPayout: { type: 'fixed', value: 0 },
            afterMaxEarning: { type: 'fixed', value: 0 },
            afterMaxDirect: { type: 'fixed', value: 0 },
        },
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] },
    },
    { 
        _id: '4', name: 'Starter (Old)', price: 25, durationDays: 15, minWithdraw: 5, description: 'This plan is no longer available.', status: Status.Disabled,
        directReferralLimit: 5,
        directCommission: { type: 'fixed', value: 5 },
        indirectCommissions: [],
        commissionDeductions: {
            afterMaxPayout: { type: 'fixed', value: 0 },
            afterMaxEarning: { type: 'fixed', value: 0 },
            afterMaxDirect: { type: 'fixed', value: 0 },
        },
        autoUpgrade: { enabled: false },
        holdPosition: { enabled: false, slots: [] },
    },
];

export const mockTransfers: Transfer[] = [
    { _id: 'TRF4001', senderId: '1', senderName: 'john.doe', recipientId: '2', recipientName: 'jane.smith', amount: 25, status: Status.Pending, date: '2023-10-28' },
    { _id: 'TRF4002', senderId: '2', senderName: 'jane.smith', recipientId: '4', recipientName: 'chris.green', amount: 50, status: Status.Approved, date: '2023-10-27', adminNotes: 'Approved' },
];

export const mockTransactions: Transaction[] = [];

export const mockRules: Rule[] = [
    { _id: '1', fromPlan: 'Bronze Plan', toPlan: 'Silver Plan', requiredEarnings: 500 },
    { _id: '2', fromPlan: 'Silver Plan', toPlan: 'Gold Plan', requiredEarnings: 2000 },
];

export const mockNotifications: Notification[] = [];