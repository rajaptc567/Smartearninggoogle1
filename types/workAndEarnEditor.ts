export interface WorkAndEarnPageEditableConfig {
    id: string;
    pageTitle: string;
    pageSubtitle: string;
    tabName: string;
    heading: string;
    description: string;
    buttonText: string;
    popupTitle: string;
    popupDescription: string;
    commentBoxPlaceholder: string;
    detailsMessage: string;
    primaryColor: string;
    backgroundColor: string;
    cardStyle: 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl' | 'rounded-none';
    layoutColumns: number;
    showNoticeBanner: boolean;
    noticeBannerText: string;
    showCustomInstructions?: boolean;
    customInstructionsHtml: string;
    visibleColumns: { [key: string]: boolean };
    isPageEnabled?: boolean;
    showStatsCards?: boolean;
    showActionButtons?: boolean;
    showInviteCard?: boolean;
    showBalanceCard?: boolean;
    showRecentProofsWidget?: boolean;
    showActiveCampaignsWidget?: boolean;
    showSearchFilter?: boolean;
    showCategoryFilter?: boolean;
    showDetailsModal?: boolean;
    showPurposeFinancialHistory?: boolean;
    purposeHistoryDefaultPerPage?: number;
    purposeHistoryHeading?: string;
    purposeHistoryDescription?: string;
}

export interface WorkAndEarnModuleConfig {
    moduleName: string;
    moduleDescription: string;
    menuTitle: string;
    submenus: {
        dashboard: WorkAndEarnPageEditableConfig;
        availableTasks: WorkAndEarnPageEditableConfig;
        myCampaigns: WorkAndEarnPageEditableConfig;
        createCampaign: WorkAndEarnPageEditableConfig;
        reviewProofs: WorkAndEarnPageEditableConfig;
        pendingReviews: WorkAndEarnPageEditableConfig;
        tasksHistory: WorkAndEarnPageEditableConfig;
        earnHistory: WorkAndEarnPageEditableConfig;
        disputes: WorkAndEarnPageEditableConfig;
    };
}

export const defaultWorkAndEarnConfig: WorkAndEarnModuleConfig = {
    moduleName: "Work & Earn",
    moduleDescription: "Complete micro-tasks, launch promotional campaigns, review worker proofs, and track task earnings.",
    menuTitle: "Work & Earn Hub",
    submenus: {
        dashboard: {
            id: 'dashboard',
            pageTitle: "Work & Earn Main Dashboard",
            pageSubtitle: "Overview of active campaigns, task earnings, worker progress, and wallet balances.",
            tabName: "Dashboard",
            heading: "Work & Earn Command Center",
            description: "Manage your active worker gigs, campaign escrow balances, and live task performance.",
            buttonText: "Browse Available Tasks",
            popupTitle: "Work & Earn System Info",
            popupDescription: "Earn rewards by performing verified tasks or launch targeted campaigns with guaranteed escrow.",
            commentBoxPlaceholder: "Type your feedback or note here...",
            detailsMessage: "Select an active task or campaign to inspect live metrics, submission proofs, and payouts.",
            primaryColor: "#4f46e5",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 3,
            showNoticeBanner: true,
            noticeBannerText: "Welcome to Work & Earn! Complete worker proofs accurately to earn instant task rewards.",
            customInstructionsHtml: "Follow campaign instructions carefully. False submissions may result in account review.",
            visibleColumns: { title: true, reward: true, status: true, action: true },
            showPurposeFinancialHistory: true,
            purposeHistoryDefaultPerPage: 10,
            purposeHistoryHeading: "Financial History by Purpose",
            purposeHistoryDescription: "Comprehensive audit trail categorized by worker rewards, conversions, campaign fund transfers, and expenditures."
        },
        availableTasks: {
            id: 'availableTasks',
            pageTitle: "Browse Available Micro-Tasks",
            pageSubtitle: "Explore verified task campaigns created by advertisers and earn instant rewards upon approval.",
            tabName: "Available Tasks",
            heading: "Available Gig Tasks",
            description: "Pick high-paying tasks, follow employer instructions, and submit proof screenshots or text.",
            buttonText: "Submit Proof Now",
            popupTitle: "Task Proof Submission Modal",
            popupDescription: "Upload your screenshot proof or enter proof text as requested by the campaign creator.",
            commentBoxPlaceholder: "Provide submission details, reference code, username or proof text...",
            detailsMessage: "Task details, reward rate, remaining worker slots, and employer guidelines.",
            primaryColor: "#2563eb",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 3,
            showNoticeBanner: true,
            noticeBannerText: "Make sure your submission proof matches the advertiser instructions precisely.",
            customInstructionsHtml: "Ensure screenshots are clear and unedited to guarantee immediate approval.",
            visibleColumns: { title: true, category: true, reward: true, slots: true, action: true }
        },
        myCampaigns: {
            id: 'myCampaigns',
            pageTitle: "My Created Task Campaigns Status",
            pageSubtitle: "Track your running campaigns, manage spots, review worker proofs, or pause campaigns.",
            tabName: "My Campaigns",
            heading: "My Created Task Campaigns Status",
            description: "Monitor worker progress, review submitted proofs, top up campaign budget, or pause active campaigns.",
            buttonText: "Create New Campaign",
            popupTitle: "Campaign Action Confirmation",
            popupDescription: "Are you sure you want to perform this campaign management action?",
            commentBoxPlaceholder: "Enter campaign note or feedback for workers...",
            detailsMessage: "Campaign budget breakdown, worker slots reserved, proof review status, and escrow balance.",
            primaryColor: "#059669",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 4,
            showNoticeBanner: true,
            noticeBannerText: "Advertisers must review submitted worker proofs within the designated review window.",
            customInstructionsHtml: "Approved worker proofs immediately credit rewards from campaign escrow balance.",
            visibleColumns: { campaignTitle: true, budget: true, progress: true, status: true, actions: true }
        },
        createCampaign: {
            id: 'createCampaign',
            pageTitle: "Create New Task Campaign",
            pageSubtitle: "Launch a targeted task campaign, set custom worker proof requirements, and deposit escrow budget.",
            tabName: "Create Campaign",
            heading: "Campaign Creation Studio",
            description: "Define worker instructions, required proof types (screenshot/text), slot count, and reward per task.",
            buttonText: "Publish Campaign Now",
            popupTitle: "Campaign Escrow Reservation",
            popupDescription: "The total campaign budget will be locked from your campaign fund/task wallet.",
            commentBoxPlaceholder: "Add special guidelines or instructions for workers...",
            detailsMessage: "Summary of campaign budget, worker reward, system fee, and required proof format.",
            primaryColor: "#d97706",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 2,
            showNoticeBanner: true,
            noticeBannerText: "Campaigns undergo brief verification before becoming visible to public workers.",
            customInstructionsHtml: "Provide clear step-by-step instructions for workers to achieve the best results.",
            visibleColumns: { title: true, reward: true, workerCount: true, totalBudget: true }
        },
        reviewProofs: {
            id: 'reviewProofs',
            pageTitle: "Review Worker Task Proofs",
            pageSubtitle: "Inspect submitted screenshots and text proofs from workers for your active campaigns.",
            tabName: "Review Proofs",
            heading: "Worker Proof Audit Desk",
            description: "Approve valid worker proofs to credit earnings or reject invalid submissions with feedback.",
            buttonText: "Approve Proof",
            popupTitle: "Proof Rejection / Approval Confirmation",
            popupDescription: "Confirm your decision for this worker proof submission.",
            commentBoxPlaceholder: "Enter reason for rejection or approval note for worker...",
            detailsMessage: "Worker details, submission timestamp, submitted proof image, text response, and status.",
            primaryColor: "#7c3aed",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 2,
            showNoticeBanner: true,
            noticeBannerText: "Worker proofs not reviewed before the deadline will be auto-approved by the audit engine.",
            customInstructionsHtml: "Check proof image details thoroughly before marking as approved or rejected.",
            visibleColumns: { workerName: true, taskName: true, proofData: true, submittedDate: true, action: true }
        },
        pendingReviews: {
            id: 'pendingReviews',
            pageTitle: "My Pending Review Tasks",
            pageSubtitle: "Track tasks you submitted that are currently waiting for employer review or auto-approval.",
            tabName: "Pending Reviews",
            heading: "Pending Worker Submissions",
            description: "Tasks currently undergoing review by campaign owners or scheduled for automatic payout release.",
            buttonText: "Check Review Details",
            popupTitle: "Submission Status Information",
            popupDescription: "Your proof was submitted successfully and is queued for verification.",
            commentBoxPlaceholder: "Add follow-up note or message for advertiser...",
            detailsMessage: "Submission details, countdown timer to auto-approval, and proof data.",
            primaryColor: "#0284c7",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 3,
            showNoticeBanner: true,
            noticeBannerText: "If an advertiser rejects your valid proof, you can open a dispute ticket with support.",
            customInstructionsHtml: "Submissions undergo automatic payout if the employer does not respond in time.",
            visibleColumns: { taskTitle: true, submittedAt: true, countdown: true, reward: true, status: true }
        },
        tasksHistory: {
            id: 'tasksHistory',
            pageTitle: "My Completed Tasks History",
            pageSubtitle: "Review your past completed tasks, approved payouts, and rejected submission records.",
            tabName: "Completed Tasks",
            heading: "Task Completion History",
            description: "Full archive of your completed micro-tasks with earnings credited to your task wallet.",
            buttonText: "View Receipt",
            popupTitle: "Task Receipt Details",
            popupDescription: "Detailed record of task reward credit and approval timestamp.",
            commentBoxPlaceholder: "Archived submission notes...",
            detailsMessage: "Reward amount, employer name, approval date, and proof record.",
            primaryColor: "#16a34a",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 4,
            showNoticeBanner: false,
            noticeBannerText: "",
            customInstructionsHtml: "",
            visibleColumns: { taskTitle: true, category: true, earnedAmount: true, completedDate: true, status: true }
        },
        earnHistory: {
            id: 'earnHistory',
            pageTitle: "Work & Earn Activity Ledger",
            pageSubtitle: "Comprehensive history of campaign purchases, wallet transfers, task rewards, and payouts.",
            tabName: "Earn History",
            heading: "Work & Earn Financial History",
            description: "Filter activity logs by campaign purchases, wallet transfers, rewards, conversions, and payouts.",
            buttonText: "Filter Activity",
            popupTitle: "Transaction Record Details",
            popupDescription: "Complete audit log for selected financial entry.",
            commentBoxPlaceholder: "Filter search query...",
            detailsMessage: "Transaction ID, source wallet, destination wallet, timestamp, and status.",
            primaryColor: "#4f46e5",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 4,
            showNoticeBanner: true,
            noticeBannerText: "Track all credits, debits, escrow reserves, and conversions in real time.",
            customInstructionsHtml: "",
            visibleColumns: { type: true, amount: true, date: true, reference: true, status: true }
        },
        disputes: {
            id: 'disputes',
            pageTitle: "Work & Earn Disputes Desk",
            pageSubtitle: "Submit formal disputes for rejected task proofs, creator auto-review delays, or campaign issues.",
            tabName: "Disputes & Support",
            heading: "Disputes & Resolution Portal",
            description: "Raise dispute tickets with supporting screenshots for level-1 review and level-2 admin escalation.",
            buttonText: "Open New Dispute",
            popupTitle: "Raise New Dispute Ticket",
            popupDescription: "Select your affected task submission or campaign and describe the issue in detail.",
            commentBoxPlaceholder: "Explain the issue, dispute details, or reason in full detail...",
            detailsMessage: "Dispute ticket status, level-1 creator review, admin investigation notes, and timeline.",
            primaryColor: "#dc2626",
            backgroundColor: "#0f172a",
            cardStyle: "rounded-2xl",
            layoutColumns: 2,
            showNoticeBanner: true,
            noticeBannerText: "Provide clear evidence when opening disputes to ensure fast resolution by our audit team.",
            customInstructionsHtml: "Selected 'Other' category? Explain your issue thoroughly in the comment box.",
            visibleColumns: { ticketId: true, category: true, urgency: true, date: true, status: true, action: true }
        }
    }
};
