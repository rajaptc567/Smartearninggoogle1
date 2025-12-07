
export type Currency = 'EUR' | 'PKR' | 'USD';

export const currencySymbols: Record<Currency, string> = {
    EUR: '€',
    PKR: 'Rs',
    USD: '$',
};

export const formatCurrency = (amount: number, currency: Currency | string) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        amount = 0;
    }
    const symbol = (currencySymbols as any)[currency] || '';

    if (currency === 'PKR') {
        if (Number.isInteger(amount)) {
             return `${symbol}${amount.toFixed(0)}`;
        }
        return `${symbol}${amount.toFixed(2)}`;
    }
    
    return `${symbol}${amount.toFixed(2)}`;
};


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
    dispute: boolean; // Blocks disputes
    excludeFromTicker?: boolean;
}

export interface User {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  country: string;
  currency: Currency;
  walletBalance: number;
  activePlan: string;
  activePlans?: ActivePlan[];
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
  currency: Currency;
  transactionId: string;
  senderAccountTitle?: string;
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
    matchedDepositIds?: Deposit[];
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

export interface PaymentMethod {
    _id: string;
    name: string;
    currency: Currency;
    type: 'Deposit' | 'Withdrawal';
    accountTitle: string;
    accountNumber: string;
    instructions: string;
    minAmount: number;
    maxAmount: number;
    feePercent: number;
    status: 'Enabled' | 'Disabled';
    logoUrl?: string;
    p2pWithdrawalId?: string;
}

export type CommissionType = 'percentage' | 'fixed';

export interface Commission {
    type: CommissionType;
    value: number;
}

export interface InvestmentPlan {
    _id: string;
    name: string;
    currency: Currency;
    price: number;
    durationDays: number;
    minWithdraw: number;
    description: string;
    status: Status.Active | Status.Disabled;
    
    directReferralLimit: number;
    directCommissions: Commission[];
    indirectCommissions: Commission[];

    commissionDeductions: {
        afterMaxPayout: Commission;
        afterMaxEarning: Commission;
        afterMaxDirect: Commission;
    };
    
    autoUpgrade: {
        enabled: boolean;
        toPlanId?: string;
    };

    holdPosition: {
        enabled: boolean;
        slots: number[];
    };
    
    transferConfig?: {
        enabled: boolean;
        feeType: CommissionType;
        feeValue: number;
        minAmount: number;
        maxAmount: number;
    };
    equivalentPlanIds?: string[];
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
    sourceUserId?: string;
    status?: 'Pending' | 'Approved' | 'Rejected';
    relatedPlanId?: string;
    originalAmount?: number;
    originalCurrency?: Currency;
    exchangeRate?: number;
}

export interface Rule {
    _id: string;
    fromPlan: string;
    toPlan: string;
    requiredEarnings: number;
    currency: Currency;
}

export interface TransferFeeTier {
    minAmount: number;
    maxAmount: number;
    feeType: 'percentage' | 'fixed';
    feeValue: number;
    currency: Currency;
    enabled?: boolean;
}

export interface DemoProfile {
    _id: string;
    name: string;
    country: string;
    currency: Currency;
}

export interface DemoActivityTemplate {
    _id: string;
    template: string;
    type: 'withdrawal' | 'transfer' | 'joined' | 'deposit' | 'plan';
    enabled: boolean;
}

export interface PlanEquivalencyGroup {
    _id: string;
    pkrPlanId?: string;
    eurPlanId?: string;
    usdPlanId?: string;
}

export interface HomepageContent {
    heroTitle: string;
    heroSubtitle: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
    videoTitle: string;
    videoDesc: string;
    multiCurrencyTitle: string;
    multiCurrencyDesc: string;
    mlmTitle: string;
    mlmDesc: string;
    ctaTitle: string;
    ctaDesc: string;
}

export interface Settings {
    tickerEnabled?: boolean;
    isUserTransferEnabled: boolean; 
    
    transferConfig: {
        enabled: boolean;
        tiers: TransferFeeTier[];
        allowCrossCurrency?: boolean;
    };

    exchangeRates: {
        EUR: number;
        PKR: number;
        USD: number;
    };

    restrictWithdrawalAmount: boolean;
    requirePlanMatchForCommission: boolean; 
    requireActivePlanForCommission: boolean;
    oneTimeCommissionPerGroup: boolean;
    recurringCommissionPlanIds?: string[];
    requireUplineEligibility: boolean;
    withdrawalFrequency: {
        enabled: boolean;
        value: number;
        unit: 'hours' | 'days' | 'weeks' | 'months';
    };
    demoProfiles?: DemoProfile[];
    demoActivityTemplates?: DemoActivityTemplate[];
    tickerSpeed?: number;
    tickerContentSource?: 'hybrid' | 'real_only' | 'demo_only';
    tickerRealActivities?: {
        deposits: boolean;
        withdrawals: boolean;
        registrations: boolean;
        commissions: boolean;
        transfers: boolean;
        planPurchases: boolean;
    };
    tickerDemoAmountRanges?: {
        EUR: { min: number; max: number };
        PKR: { min: number; max: number };
        USD?: { min: number; max: number };
    };
    planEquivalencyGroups?: PlanEquivalencyGroup[];
    homepageVideoUrl?: string;
    homepageContent?: HomepageContent;
    featuredPlanIds?: string[];
}

export interface Notification {
  _id: string;
  userId: string;
  senderType?: 'Admin' | 'System';
  subject?: string;
  message: string;
  isPopup?: boolean;
  popupShown?: boolean;
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
    referenceId: string;
    description: string;
    proofUrl?: string;
    status: Status.Open | Status.Processing | Status.Resolved | Status.Closed;
    adminResponse?: string;
    messages?: DisputeMessage[];
    date: string;
    adminUnread?: boolean;
    userUnread?: boolean;
}

export const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the",
  "Congo, Republic of the", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti",
  "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
  "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala",
  "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos",
  "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia",
  "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal",
  "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];