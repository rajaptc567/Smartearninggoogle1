
export enum Status {
  Active = 'Active',
  Blocked = 'Blocked',
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Paid = 'Paid',
  Disabled = 'Disabled',
  Matching = 'Matching',
  Paused = 'Paused',
  Open = 'Open',
  Resolved = 'Resolved',
  Closed = 'Closed',
}

export interface ActivePlan {
    planId: string;
    planName: string;
    price: number;
    purchaseDate: string;
}

export interface UserRestrictions {
    deposit: boolean;
    withdrawal: boolean;
    transfer: boolean;
    earning: boolean; // Blocks commissions
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
  activePlan: string; // Primary/Latest plan string for legacy display
  activePlans?: ActivePlan[]; // Array of all purchased plans
  registrationDate: string;
  status: Status;
  sponsor?: string;
  restrictions?: UserRestrictions;
}

export interface Deposit {
  _id: string;
  userId: string;
  userName: string;
  method: string;
  amount: number;
  transactionId: string;
  senderAccountTitle?: string; // Name on the sender's account
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
    matchedDepositIds?: Deposit[]; // Populated full objects
}

export interface Transfer {
  _id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  fee?: number;
  totalDeducted?: number;
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
    p2pWithdrawalId?: string; // Optional ID linking to a withdrawal
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
    directCommissions: Commission[]; // Array for tiered commissions
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
    
    // Legacy field kept for type compatibility if needed, but main logic uses global settings
    transferConfig?: {
        enabled: boolean;
        feeType: CommissionType;
        feeValue: number;
        minAmount: number;
        maxAmount: number;
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
    relatedPlanId?: string;
}

export interface Rule {
    _id: string;
    fromPlan: string;
    toPlan: string;
    requiredEarnings: number;
}

export interface TransferFeeTier {
    minAmount: number;
    maxAmount: number;
    feeType: 'percentage' | 'fixed';
    feeValue: number;
    enabled?: boolean; // New flag to enable/disable specific tiers
}

export interface Settings {
    // Legacy boolean kept for backward compat if needed, but UI uses transferConfig.enabled
    isUserTransferEnabled: boolean; 
    
    transferConfig: {
        enabled: boolean;
        tiers: TransferFeeTier[];
    };

    restrictWithdrawalAmount: boolean; // Restrict to own active plan prices
    requirePlanMatchForCommission: boolean; 
    requireActivePlanForCommission: boolean;
    withdrawalFrequency: {
        enabled: boolean;
        value: number;
        unit: 'hours' | 'days' | 'weeks' | 'months';
    };
}

export interface Notification {
  _id: string;
  userId: string; // User who receives the notification
  subject?: string; // Optional subject
  message: string;
  isPopup?: boolean; // Should this show as a modal?
  popupShown?: boolean; // Has the modal been shown/closed?
  read: boolean;
  date: string;
}

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

export interface Dispute {
    _id: string;
    userId: string;
    userName: string;
    type: 'Deposit' | 'Withdrawal' | 'Transfer';
    referenceId: string; // The ID of the rejected/failed item
    description: string;
    proofUrl?: string; // New proof if re-submitting
    status: Status.Open | Status.Resolved | Status.Closed;
    adminResponse?: string;
    date: string;
}