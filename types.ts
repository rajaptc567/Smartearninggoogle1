export enum Status {
  Active = 'Active',
  Blocked = 'Blocked',
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Paid = 'Paid',
  Disabled = 'Disabled',
  Matching = 'Matching',
}

export interface User {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  country?: string;
  walletBalance: number;
  activePlan: string;
  registrationDate: string;
  status: Status;
  sponsor?: string;
}

export interface Deposit {
  _id: string;
  userId: string;
  userName: string;
  method: string;
  amount: number;
  transactionId: string;
  receiptUrl?: string;
  status: Status.Pending | Status.Approved | Status.Rejected;
  date: string;
  adminNotes?: string;
  userNotes?: string;
  matchedWithdrawalId?: string;
}

export interface Withdrawal {
    _id: string;
    userId: string;
    userName: string;
    method: string;
    amount: number;
    fee: number;
    finalAmount: number;
    accountTitle: string;
    accountNumber: string;
    status: Status.Pending | Status.Approved | Status.Paid | Status.Rejected | Status.Matching;
    date: string;
    adminNotes?: string;
    userNotes?: string;
    matchRemainingAmount?: number;
}

export interface Transfer {
  _id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  status: Status.Pending | Status.Approved | Status.Rejected;
  date: string;
  adminNotes?: string;
}

export interface PaymentMethod {
    _id: string;
    name: string;
    type: 'Deposit' | 'Withdrawal';
    accountTitle: string;
    accountNumber: string;
    instructions: string;
    minAmount: number;
    maxAmount: number;
    feePercent: number;
    status: 'Enabled' | 'Disabled';
    logoUrl?: string;
}

// New types for InvestmentPlan
export type CommissionType = 'percentage' | 'fixed';

export interface Commission {
    type: CommissionType;
    value: number;
}

export interface InvestmentPlan {
    _id: string;
    name: string;
    price: number;
    durationDays: number; // 0 for unlimited
    minWithdraw: number;
    description: string;
    status: Status.Active | Status.Disabled;
    
    directReferralLimit: number; // 0 for unlimited
    directCommission: Commission;
    indirectCommissions: Commission[]; // Array for multi-level

    commissionDeductions: {
        afterMaxPayout: Commission;
        afterMaxEarning: Commission;
        afterMaxDirect: Commission;
    };
    
    autoUpgrade: {
        enabled: boolean;
        toPlanId?: string; // ID of the plan to upgrade to
    };

    holdPosition: {
        enabled: boolean;
        slots: number[]; // e.g., [5, 6] for holding 5th and 6th referral commissions
    };
}


export interface Transaction {
    _id: string;
    userId: string;
    userName: string;
    type: 'Deposit' | 'Withdrawal' | 'Commission' | 'Manual Credit' | 'Manual Debit' | 'Withdrawal Request' | 'Withdrawal Refund' | 'Plan Purchase' | 'Transfer Sent' | 'Transfer Received' | 'Transfer Request' | 'Transfer Refund';
    amount: number;
    date: string;
    description: string;
    level?: number;
    status?: 'Pending' | 'Approved' | 'Rejected';
}

export interface Rule {
    _id: string;
    fromPlan: string;
    toPlan: string;
    requiredEarnings: number;
}

export interface Settings {
    isUserTransferEnabled: boolean;
    restrictWithdrawalAmount: boolean;
    // Add other settings here in the future
}

export interface Notification {
  _id: string;
  userId: string; // User who receives the notification
  message: string;
  date: string;
  read: boolean;
}

// FIX: Added missing Log interface
export interface Log {
  _id: string;
  timestamp: string;
  action: string;
  affectedUser: string;
  details: string;
  performedBy: string;
}

export interface PasswordResetRequest {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: 'Pending' | 'Handled';
  requestDate: string;
}