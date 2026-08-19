import { ModulePageControlsConfig, ModulePageControl } from '../types';

export const defaultInvestmentPages: Record<string, ModulePageControl> = {
    dashboard: {
        id: 'dashboard',
        name: 'Dashboard Hub',
        route: '/member',
        icon: '📊',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'The Dashboard Hub is temporarily offline for scheduled system maintenance.'
    },
    deposit: {
        id: 'deposit',
        name: 'Deposit Funds',
        route: '/member/deposit',
        icon: '💳',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Deposits are currently paused by the administrator. Please check back shortly.'
    },
    withdraw: {
        id: 'withdraw',
        name: 'Withdraw Funds',
        route: '/member/withdraw',
        icon: '💸',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Withdrawals are temporarily disabled for batch settlement. Please check back soon.'
    },
    transfer: {
        id: 'transfer',
        name: 'Transfer Funds',
        route: '/member/transfer',
        icon: '🔄',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Internal user wallet transfers are currently disabled.'
    },
    plans: {
        id: 'plans',
        name: 'Investment Plans',
        route: '/member/plans',
        icon: '📈',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Investment plan enrollment is currently closed.'
    },
    activePlans: {
        id: 'activePlans',
        name: 'My Active Plans',
        route: '/member/active-plans',
        icon: '⚡',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Active plans tracking is temporarily under maintenance.'
    },
    tasks: {
        id: 'tasks',
        name: 'My Daily Tasks',
        route: '/member/tasks',
        icon: '✅',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Daily dividend tasks are currently unavailable.'
    },
    userTasks: {
        id: 'userTasks',
        name: 'Earn Cash & Gigs Hub',
        route: '/member/user-tasks',
        icon: '💼',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'The Cash & Gigs Hub is temporarily disabled.'
    },
    transactions: {
        id: 'transactions',
        name: 'Transactions History',
        route: '/member/transactions',
        icon: '📜',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Transaction records are temporarily undergoing ledger synchronization.'
    },
    referrals: {
        id: 'referrals',
        name: 'My Referral Network',
        route: '/member/referrals',
        icon: '👥',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Referral network views are temporarily offline.'
    },
    messages: {
        id: 'messages',
        name: 'Inbox',
        route: '/member/messages',
        icon: '✉️',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Inbox messaging center is currently undergoing upgrades.'
    },
    disputes: {
        id: 'disputes',
        name: 'Disputes & Support',
        route: '/member/disputes?module=Investment',
        icon: '🛡️',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'The dispute submission desk is temporarily paused.'
    },
    profile: {
        id: 'profile',
        name: 'Profile Settings',
        route: '/member/profile',
        icon: '⚙️',
        category: 'investment',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Profile settings updates are temporarily locked.'
    }
};

export const defaultWorkAndEarnPages: Record<string, ModulePageControl> = {
    dashboard: {
        id: 'dashboard',
        name: 'Dashboard Hub',
        route: '/member',
        icon: '⚡',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'The Dashboard Hub is temporarily unavailable.'
    },
    deposit: {
        id: 'deposit',
        name: 'Deposit Hub Funds',
        route: '/member/deposit',
        icon: '💳',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Hub escrow deposits are currently paused.'
    },
    withdraw: {
        id: 'withdraw',
        name: 'Withdraw Hub Funds',
        route: '/member/withdraw',
        icon: '💸',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Work & Earn reward withdrawals are temporarily under maintenance.'
    },
    workHistory: {
        id: 'workHistory',
        name: 'Work & Earn History',
        route: '/member/work-history',
        icon: '📊',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Work & Earn history ledger is temporarily undergoing synchronization.'
    },
    userTasks: {
        id: 'userTasks',
        name: 'Earn Cash & Gigs Hub',
        route: '/member/user-tasks',
        icon: '💼',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'The Earn Cash & Gigs Hub is temporarily disabled.'
    },
    availableTasks: {
        id: 'availableTasks',
        name: 'Available Tasks',
        route: '/member/available-tasks',
        icon: '📋',
        category: 'work_and_earn',
        menuLocation: 'Submenu: My Tasks & Gigs',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Available micro-tasks are temporarily disabled by the administrator.'
    },
    pendingReviews: {
        id: 'pendingReviews',
        name: 'Pending Reviews',
        route: '/member/pending-reviews',
        icon: '⏳',
        category: 'work_and_earn',
        menuLocation: 'Submenu: My Tasks & Gigs',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Worker pending review audit desk is temporarily offline.'
    },
    tasksHistory: {
        id: 'tasksHistory',
        name: 'Tasks Submission History',
        route: '/member/tasks-history',
        icon: '📜',
        category: 'work_and_earn',
        menuLocation: 'Submenu: My Tasks & Gigs',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Task submission history is temporarily unavailable.'
    },
    createCampaign: {
        id: 'createCampaign',
        name: 'Create Campaign / Task',
        route: '/member/create-campaign',
        icon: '🚀',
        category: 'work_and_earn',
        menuLocation: 'Submenu: My Campaigns',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'New campaign creation is currently paused by the administrator.'
    },
    myCampaigns: {
        id: 'myCampaigns',
        name: 'My Campaigns',
        route: '/member/my-campaigns',
        icon: '📂',
        category: 'work_and_earn',
        menuLocation: 'Submenu: My Campaigns',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Campaign management desk is temporarily undergoing system maintenance.'
    },
    reviewProofs: {
        id: 'reviewProofs',
        name: 'Review Proofs',
        route: '/member/review-proofs',
        icon: '👁️',
        category: 'work_and_earn',
        menuLocation: 'Submenu: My Campaigns',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Worker proof reviews are temporarily paused.'
    },
    messages: {
        id: 'messages',
        name: 'Inbox',
        route: '/member/messages',
        icon: '✉️',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Inbox messaging center is temporarily undergoing maintenance.'
    },
    disputes: {
        id: 'disputes',
        name: 'Disputes & Support',
        route: '/member/disputes?module=Work%20%26%20Earn',
        icon: '🛡️',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Disputes & Support desk for Work & Earn is currently offline.'
    },
    hubFaqs: {
        id: 'hubFaqs',
        name: 'Hub FAQs',
        route: '/member/hub-faqs',
        icon: '❓',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Hub FAQs are temporarily unavailable.'
    },
    hubLegal: {
        id: 'hubLegal',
        name: 'Hub Legal Info',
        route: '/member/hub-legal',
        icon: '⚖️',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Hub legal information is temporarily undergoing updates.'
    },
    profile: {
        id: 'profile',
        name: 'Profile Settings',
        route: '/member/profile',
        icon: '⚙️',
        category: 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'Profile settings are temporarily locked.'
    }
};

export const getDefaultModulePagesConfig = (): ModulePageControlsConfig => {
    return {
        investment: { ...defaultInvestmentPages } as any,
        workAndEarn: { ...defaultWorkAndEarnPages } as any
    };
};

export const getEffectiveModulePageControl = (
    modulePagesConfig: ModulePageControlsConfig | undefined,
    category: 'investment' | 'workAndEarn',
    pageId: string
): ModulePageControl => {
    const defaults = category === 'investment' ? defaultInvestmentPages : defaultWorkAndEarnPages;
    const defaultPage = defaults[pageId] || {
        id: pageId,
        name: pageId,
        route: `/member/${pageId}`,
        category: category === 'investment' ? 'investment' : 'work_and_earn',
        menuLocation: 'Main Navigation',
        isEnabled: true,
        isHiddenInNav: false,
        disabledNotice: 'This page is currently disabled by the administrator.'
    };

    if (!modulePagesConfig || !modulePagesConfig[category] || !(modulePagesConfig[category] as any)[pageId]) {
        return defaultPage;
    }

    const saved = (modulePagesConfig[category] as any)[pageId];
    return {
        ...defaultPage,
        ...saved,
        name: defaultPage.name, // Always enforce the canonical name as shown in user dashboard / site menu
        menuLocation: defaultPage.menuLocation,
        route: defaultPage.route,
        icon: defaultPage.icon,
        isEnabled: saved.isEnabled !== undefined ? saved.isEnabled : defaultPage.isEnabled,
        isHiddenInNav: saved.isHiddenInNav !== undefined ? saved.isHiddenInNav : defaultPage.isHiddenInNav,
        disabledNotice: saved.disabledNotice || defaultPage.disabledNotice
    };
};
