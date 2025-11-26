
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
  Processing = 'Processing',
  Resolved = 'Resolved',
  Closed = 'Closed',
}

export type Currency = 'USD' | 'EUR' | 'PKR';

export interface CurrencyValue {
    currency: Currency;
    value: number;
}

export interface ActivePlan {
    planId: string;
    planName: string;
    price: number; // Price at time of purchase
    currency: Currency; // Currency of purchase
    purchaseDate: string;
}

export interface UserRestrictions {
    deposit: boolean;
    withdrawal: boolean;
    transfer: boolean;
    earning: boolean; // Blocks commissions
    dispute: boolean; // Blocks disputes
}

export interface User {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  country?: string;
  currency: Currency; // User's primary currency
  walletBalances: Partial<Record<Currency, number>>; // Multi-currency wallet
  activePlans?: ActivePlan[]; // Array of all purchased plans
  registrationDate: string;
  status: Status;
  sponsor?: string;
  restrictions?: UserRestrictions;
  // Legacy fields for backward compatibility, should not be used for new logic
  walletBalance: number;
  activePlan: string; 
}

export interface Deposit {
  _id: string;
  userId: string;
  userName: string;
  method: string;
  amount: number;
  currency: Currency;
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
    currency: Currency;
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
  currency: Currency;
  fee?: number;
  totalDeducted?: number;
  status: Status.Pending | Status.Approved | Status.Rejected;
  date: string;
  adminNotes?: string;
}

export interface PaymentMethodAmountLimit {
    currency: Currency;
    min: number;
    max: number;
}

export interface PaymentMethod {
    _id: string;
    name: string;
    type: 'Deposit' | 'Withdrawal';
    accountTitle: string;
    accountNumber: string;
    instructions: string;
    supportedCurrencies: Currency[];
    amountLimits: PaymentMethodAmountLimit[];
    feePercent: number;
    status: 'Enabled' | 'Disabled';
    logoUrl?: string;
    p2pWithdrawalId?: string; // Optional ID linking to a withdrawal
    // Legacy fields for backward compatibility
    minAmount: number;
    maxAmount: number;
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
    prices: CurrencyValue[];
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
    
    // Legacy field
    price: number;
}


export interface Transaction {
    _id: string;
    userId: string;
    userName: string;
    type: 'Deposit' | 'Withdrawal' | 'Commission' | 'Manual Credit' | 'Manual Debit' | 'Withdrawal Request' | 'Withdrawal Refund' | 'Plan Purchase' | 'Transfer Sent' | 'Transfer Received' | 'Transfer Request' | 'Transfer Refund';
    amount: number;
    currency: Currency;
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
    currency: Currency;
    minAmount: number;
    maxAmount: number;
    feeType: 'percentage' | 'fixed';
    feeValue: number;
    enabled?: boolean;
}

export interface Settings {
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
    // Legacy boolean
    isUserTransferEnabled: boolean; 
}

export interface Notification {
  _id: string;
  userId: string; // User who receives the notification
  senderType?: 'Admin' | 'System'; // Who sent it
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

export interface DisputeMessage {
    sender: 'User' | 'Admin' | 'System';
    message: string;
    date: string;
    attachmentUrl?: string;
}

export interface Dispute {
    _id: string;
    userId: string;
    userName: string;
    type: 'Deposit' | 'Withdrawal' | 'Transfer';
    referenceId: string; // The ID of the rejected/failed item
    description: string;
    proofUrl?: string; // New proof if re-submitting
    status: Status.Open | Status.Processing | Status.Resolved | Status.Closed;
    adminResponse?: string; // Kept for legacy/summary, actual chat is in messages
    messages?: DisputeMessage[];
    date: string;
    adminUnread?: boolean;
    userUnread?: boolean;
}
