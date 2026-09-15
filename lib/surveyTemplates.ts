import { SurveyConfig } from '../types';

export const SMARTEXN_SURVEY_TEMPLATES: SurveyConfig[] = [
    {
        id: 'tmpl_discover',
        title: 'How Did You Discover SmartExn',
        category: 'Market Research',
        description: 'Help us understand how you found SmartExn and how your onboarding experience was.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm that I am participating voluntarily and will provide genuine feedback.',
        qualityRules: {
            minCompletionTimeSeconds: 30,
            flagFastCompletion: true,
            attentionCheckRequired: false,
            autoRejectOnFail: false
        },
        questions: [
            {
                id: 'disc_q1',
                type: 'single_choice',
                title: 'How did you first hear about SmartExn?',
                required: true,
                options: [
                    { id: 'opt_yt', text: 'YouTube Video / Review', value: 'YouTube Video / Review' },
                    { id: 'opt_friend', text: 'Friend or Family Referral', value: 'Friend or Family Referral' },
                    { id: 'opt_google', text: 'Google / Web Search', value: 'Google / Web Search' },
                    { id: 'opt_social', text: 'Social Media (Facebook / Instagram / TikTok)', value: 'Social Media' },
                    { id: 'opt_forum', text: 'Online Forum / Telegram Group', value: 'Online Forum / Telegram Group' }
                ],
                allowOther: true,
                otherPlaceholder: 'Please specify how you found us...'
            },
            {
                id: 'disc_q2_yt',
                type: 'short_text',
                title: 'Which YouTube channel or video did you find us through?',
                description: 'Enter the channel name or topic if you remember.',
                required: false,
                showIf: {
                    questionId: 'disc_q1',
                    operator: 'equals',
                    value: 'YouTube Video / Review'
                },
                validation: { minLength: 2, maxLength: 100 }
            },
            {
                id: 'disc_q2_ref',
                type: 'yes_no',
                title: 'Did your referral contact guide you through your first task?',
                required: true,
                showIf: {
                    questionId: 'disc_q1',
                    operator: 'equals',
                    value: 'Friend or Family Referral'
                }
            },
            {
                id: 'disc_q3',
                type: 'rating',
                title: 'How seamless was the sign-up and account creation process?',
                description: '1 = Very Difficult, 5 = Extremely Smooth',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            },
            {
                id: 'disc_q4',
                type: 'long_text',
                title: 'Any suggestions to improve the first-time user onboarding?',
                required: false,
                validation: { minLength: 0, maxLength: 600 }
            }
        ]
    },
    {
        id: 'tmpl_rewards_exp',
        title: 'Previous Rewards Platform Experience',
        category: 'Consumer Research',
        description: 'Share your background with other micro-task and earning websites.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I agree to provide accurate feedback about my previous online gig experiences.',
        qualityRules: {
            minCompletionTimeSeconds: 40,
            flagFastCompletion: true
        },
        questions: [
            {
                id: 'rew_q1',
                type: 'yes_no',
                title: 'Have you previously worked on online micro-task or reward platforms?',
                required: true
            },
            {
                id: 'rew_q2',
                type: 'multiple_choice',
                title: 'Which platforms have you used in the past?',
                description: 'Select all platforms you have actively earned on.',
                required: true,
                showIf: {
                    questionId: 'rew_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'p_sprout', text: 'SproutGigs / Picoworkers', value: 'SproutGigs' },
                    { id: 'p_freecash', text: 'Freecash', value: 'Freecash' },
                    { id: 'p_timebucks', text: 'TimeBucks', value: 'TimeBucks' },
                    { id: 'p_swagbucks', text: 'Swagbucks / ySense', value: 'Swagbucks / ySense' },
                    { id: 'p_remotasks', text: 'Remotasks / Outlier', value: 'Remotasks' }
                ],
                allowOther: true,
                otherPlaceholder: 'Other platform name...',
                validation: { minSelections: 1, maxSelections: 5 }
            },
            {
                id: 'rew_q3',
                type: 'top_n',
                title: 'What are the Top 3 most important factors for you in an earning platform?',
                description: 'Select up to 3 highest priorities.',
                required: true,
                options: [
                    { id: 'f_instant', text: 'Instant Withdrawals & Fast Processing', value: 'Instant Withdrawals' },
                    { id: 'f_variety', text: 'High Variety of Available Tasks', value: 'High Task Variety' },
                    { id: 'f_fairness', text: 'Fair Proof Review & Fast Dispute Resolution', value: 'Fair Proof Review' },
                    { id: 'f_lowmin', text: 'Low Minimum Withdrawal Threshold', value: 'Low Minimum Threshold' },
                    { id: 'f_support', text: 'Responsive Customer Support', value: 'Responsive Support' },
                    { id: 'f_rates', text: 'Competitive Payout Rates per Task', value: 'Competitive Payout Rates' }
                ],
                validation: { topN: 3, maxSelections: 3 }
            },
            {
                id: 'rew_q4',
                type: 'long_text',
                title: 'What was your biggest frustration on previous platforms?',
                required: false,
                validation: { minLength: 0, maxLength: 800 }
            }
        ]
    },
    {
        id: 'tmpl_feature_priority',
        title: 'Product Feature Priority',
        category: 'Product Feedback',
        description: 'Help prioritize new tools and capabilities on SmartExn.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I agree to participate in feature roadmap prioritization.',
        questions: [
            {
                id: 'feat_q1',
                type: 'top_n',
                title: 'Which upcoming features would you like to see prioritized first on SmartExn? (Select Top 3)',
                required: true,
                options: [
                    { id: 'feat_app', text: 'Dedicated Mobile App (Android / iOS APK)', value: 'Mobile App' },
                    { id: 'feat_crypto', text: 'Direct Crypto / Binance Pay Micro-Withdrawals', value: 'Crypto Micro-Withdrawals' },
                    { id: 'feat_daily', text: 'Daily Login Bonus Wheel & Streak Multiplier', value: 'Daily Streak Wheel' },
                    { id: 'feat_surveys', text: 'Direct Global Survey Offerwalls', value: 'Direct Global Survey Offerwalls' },
                    { id: 'feat_vip', text: 'Tiered VIP Cashback & Lower Platform Fees', value: 'Tiered VIP Cashback' },
                    { id: 'feat_chat', text: 'Direct In-App Buyer-Worker Chat', value: 'Buyer-Worker Chat' }
                ],
                validation: { topN: 3, maxSelections: 3 }
            },
            {
                id: 'feat_q2',
                type: 'single_choice',
                title: 'How important is automated instant proof approval to you?',
                required: true,
                options: [
                    { id: 'fi_1', text: 'Extremely Important — Immediate Rewards', value: 'Extremely Important' },
                    { id: 'fi_2', text: 'Moderately Important — Within a Few Hours', value: 'Moderately Important' },
                    { id: 'fi_3', text: 'Neutral — 24-48 Hours is Acceptable', value: 'Neutral' },
                    { id: 'fi_4', text: 'Not Important', value: 'Not Important' }
                ]
            },
            {
                id: 'feat_q3',
                type: 'long_text',
                title: 'Describe one new tool or feature that would double your daily time on SmartExn.',
                required: true,
                validation: { minLength: 10, maxLength: 1000 }
            }
        ]
    },
    {
        id: 'tmpl_earning_pref',
        title: 'Earning Opportunity Preferences',
        category: 'General Survey',
        description: 'Tell us which types of micro-tasks and gigs you enjoy the most.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm my answers reflect my actual work preferences.',
        questions: [
            {
                id: 'earn_q1',
                type: 'multiple_choice',
                title: 'Which types of micro-tasks do you prefer completing?',
                description: 'Select all task formats you actively seek.',
                required: true,
                options: [
                    { id: 'e_survey', text: 'Feedback & Opinion Surveys', value: 'Surveys' },
                    { id: 'e_social', text: 'Social Media Engagement (Likes, Follows, Shares)', value: 'Social Media' },
                    { id: 'e_signup', text: 'App Downloads & Account Sign-ups', value: 'Sign-ups' },
                    { id: 'e_test', text: 'Website Usability Testing & Reviews', value: 'Website Testing' },
                    { id: 'e_video', text: 'Video Watching & Content Feedback', value: 'Video Watching' }
                ],
                validation: { minSelections: 1, maxSelections: 5 }
            },
            {
                id: 'earn_q2',
                type: 'single_choice',
                title: 'What is your ideal survey length?',
                required: true,
                showIf: {
                    questionId: 'earn_q1',
                    operator: 'contains',
                    value: 'Surveys'
                },
                options: [
                    { id: 'sl_short', text: '1–3 Minutes (Fast Micro-Polls)', value: '1-3 Minutes' },
                    { id: 'sl_med', text: '5–10 Minutes (Standard Surveys)', value: '5-10 Minutes' },
                    { id: 'sl_long', text: '15+ Minutes (Deep Research with Higher Reward)', value: '15+ Minutes' }
                ]
            },
            {
                id: 'earn_q3',
                type: 'single_choice',
                title: 'How many hours per week do you spend on online earning platforms?',
                required: true,
                options: [
                    { id: 'h_1', text: 'Under 5 hours / week', value: '< 5 hours' },
                    { id: 'h_2', text: '5–15 hours / week', value: '5-15 hours' },
                    { id: 'h_3', text: '15–30 hours / week', value: '15-30 hours' },
                    { id: 'h_4', text: '30+ hours / week (Primary Income Source)', value: '30+ hours' }
                ]
            },
            {
                id: 'earn_q4',
                type: 'short_text',
                title: 'What is your monthly earning target on SmartExn in USD?',
                required: true,
                validation: { minLength: 1, maxLength: 50 }
            }
        ]
    },
    {
        id: 'tmpl_device_habits',
        title: 'Device & Digital Habits',
        category: 'Website Feedback',
        description: 'Technical specs and device preferences for optimizing platform performance.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I agree to share my device setup for platform optimization.',
        qualityRules: {
            minCompletionTimeSeconds: 30,
            attentionCheckRequired: true
        },
        questions: [
            {
                id: 'dev_q1',
                type: 'single_choice',
                title: 'What is your primary device for completing online tasks?',
                required: true,
                options: [
                    { id: 'd_android', text: 'Android Smartphone', value: 'Android' },
                    { id: 'd_ios', text: 'Apple iPhone / iPad', value: 'iOS' },
                    { id: 'd_win', text: 'Windows PC / Laptop', value: 'Windows PC' },
                    { id: 'd_mac', text: 'MacBook / MacOS', value: 'MacOS' }
                ]
            },
            {
                id: 'dev_q2',
                type: 'single_choice',
                title: 'What type of internet connection do you primarily use?',
                required: true,
                options: [
                    { id: 'net_wifi', text: 'Home Broadband WiFi', value: 'WiFi' },
                    { id: 'net_cell', text: '4G / 5G Mobile Data', value: 'Mobile Data' },
                    { id: 'net_pub', text: 'Public or Workplace WiFi', value: 'Public WiFi' }
                ]
            },
            {
                id: 'dev_q3_trap',
                type: 'single_choice',
                title: 'Quality Verification: Please select "Strongly Agree" below to confirm active reading.',
                required: true,
                isAttentionCheck: true,
                expectedAnswer: 'Strongly Agree',
                options: [
                    { id: 'trap_1', text: 'Strongly Disagree', value: 'Strongly Disagree' },
                    { id: 'trap_2', text: 'Neutral', value: 'Neutral' },
                    { id: 'trap_3', text: 'Strongly Agree', value: 'Strongly Agree' },
                    { id: 'trap_4', text: 'Disagree', value: 'Disagree' }
                ]
            },
            {
                id: 'dev_q4',
                type: 'rating',
                title: 'Rate the speed and responsiveness of SmartExn on your device.',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            },
            {
                id: 'dev_q5',
                type: 'long_text',
                title: 'Have you experienced any lag or display issues on any specific page?',
                required: false,
                validation: { minLength: 0, maxLength: 500 }
            }
        ]
    },
    {
        id: 'tmpl_user_profile',
        title: 'User Profile & Preferences',
        category: 'Demographic Survey',
        description: 'Privacy-safe demographic background to help match relevant campaigns.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm that this survey collects only non-sensitive, aggregated demographic data.',
        questions: [
            {
                id: 'prof_q1',
                type: 'single_choice',
                title: 'What is your age range?',
                description: 'Used solely for aggregate demographic mapping. Exact birth date is never requested.',
                required: true,
                options: [
                    { id: 'age_1', text: '18–24', value: '18-24' },
                    { id: 'age_2', text: '25–34', value: '25-34' },
                    { id: 'age_3', text: '35–44', value: '35-44' },
                    { id: 'age_4', text: '45–54', value: '45-54' },
                    { id: 'age_5', text: '55+', value: '55+' }
                ]
            },
            {
                id: 'prof_q2',
                type: 'single_choice',
                title: 'What is your current occupational status?',
                required: true,
                options: [
                    { id: 'occ_stu', text: 'Student', value: 'Student' },
                    { id: 'occ_emp', text: 'Employed (Full-Time or Part-Time)', value: 'Employed' },
                    { id: 'occ_free', text: 'Freelancer / Gig Worker', value: 'Freelancer' },
                    { id: 'occ_home', text: 'Homemaker', value: 'Homemaker' },
                    { id: 'occ_seek', text: 'Looking for Opportunities', value: 'Looking for Opportunities' }
                ]
            },
            {
                id: 'prof_q3',
                type: 'single_choice',
                title: 'What is your preferred payout method for receiving rewards?',
                required: true,
                options: [
                    { id: 'pay_crypto', text: 'Binance Pay / USDT Crypto', value: 'Binance Pay / USDT' },
                    { id: 'pay_mobile', text: 'Local Mobile Wallet (JazzCash / Easypaisa)', value: 'Local Mobile Wallet' },
                    { id: 'pay_bank', text: 'Bank Wire / Local Account Transfer', value: 'Bank Transfer' },
                    { id: 'pay_global', text: 'PayPal / Payoneer', value: 'PayPal / Payoneer' }
                ]
            },
            {
                id: 'prof_q4',
                type: 'multiple_choice',
                title: 'What are your primary fields of interest? (Select up to 3)',
                required: true,
                options: [
                    { id: 'int_game', text: 'Gaming & Esports', value: 'Gaming' },
                    { id: 'int_fin', text: 'Finance, Crypto & Investing', value: 'Finance & Crypto' },
                    { id: 'int_tech', text: 'Technology & AI Apps', value: 'Technology' },
                    { id: 'int_shop', text: 'Online Shopping & E-Commerce Deals', value: 'Online Shopping' },
                    { id: 'int_ent', text: 'Movies, Music & Entertainment', value: 'Entertainment' }
                ],
                validation: { minSelections: 1, maxSelections: 3 }
            }
        ]
    },
    {
        id: 'tmpl_bug_hunter',
        title: 'Bug Hunter — QA',
        category: 'Website Feedback',
        description: 'Report technical errors, glitches, or styling problems you noticed.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I agree to report genuine software observations to help improve SmartExn.',
        questions: [
            {
                id: 'bug_q1',
                type: 'single_choice',
                title: 'Have you encountered any bug or unexpected error on SmartExn recently?',
                required: true,
                options: [
                    { id: 'bug_yes', text: 'Yes, I experienced a problem', value: 'Yes' },
                    { id: 'bug_no', text: 'No, everything operated smoothly', value: 'No' }
                ]
            },
            {
                id: 'bug_q2',
                type: 'single_choice',
                title: 'Which section of the platform did the issue occur in?',
                required: true,
                showIf: {
                    questionId: 'bug_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'ba_deposit', text: 'Deposit or Withdrawal Flow', value: 'Deposit or Withdrawal' },
                    { id: 'ba_task', text: 'Task / Survey Submission & Proof', value: 'Task / Survey Submission' },
                    { id: 'ba_auth', text: 'Login, Registration, or Security', value: 'Login / Security' },
                    { id: 'ba_nav', text: 'Menu Navigation or Broken Link', value: 'Navigation' },
                    { id: 'ba_dash', text: 'Dashboard Balances or Numbers', value: 'Dashboard Balances' }
                ],
                allowOther: true,
                otherPlaceholder: 'Other page or section...'
            },
            {
                id: 'bug_q3',
                type: 'long_text',
                title: 'Describe what happened and steps to reproduce the issue.',
                required: true,
                showIf: {
                    questionId: 'bug_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 10, maxLength: 1000 }
            },
            {
                id: 'bug_q4',
                type: 'rating',
                title: 'Overall rating of platform stability and reliability.',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            }
        ]
    },
    {
        id: 'tmpl_clarity',
        title: 'New User Understanding / Clarity',
        category: 'General Survey',
        description: 'Evaluate how clear the earning rules, wallets, and guidelines are.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm my answers provide constructive feedback on platform clarity.',
        questions: [
            {
                id: 'clar_q1',
                type: 'rating',
                title: 'How clear is the explanation of how to complete tasks and earn on SmartExn?',
                description: '1 = Very Confusing, 5 = Crystal Clear',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            },
            {
                id: 'clar_q2',
                type: 'single_choice',
                title: 'Do you clearly understand the separation between Investment, Task Earnings, and Campaign Wallets?',
                required: true,
                options: [
                    { id: 'cw_yes', text: 'Yes, very clear and makes sense', value: 'Very Clear' },
                    { id: 'cw_some', text: 'Somewhat clear after browsing around', value: 'Somewhat Clear' },
                    { id: 'cw_no', text: 'No, still a bit confusing', value: 'Confusing' }
                ]
            },
            {
                id: 'clar_q3',
                type: 'single_choice',
                title: 'Which guide or learning resource would be most useful to you?',
                required: true,
                options: [
                    { id: 'g_video', text: 'Short 2-Minute Video Walkthrough', value: 'Video Walkthrough' },
                    { id: 'g_guide', text: 'Step-by-step Interactive Tutorial with Screenshots', value: 'Interactive Tutorial' },
                    { id: 'g_faq', text: 'Searchable FAQ & Help Center', value: 'FAQ Help Center' },
                    { id: 'g_chat', text: '24/7 Community Support Group', value: 'Community Support' }
                ]
            },
            {
                id: 'clar_q4',
                type: 'long_text',
                title: 'What part of the rules or instructions could be improved?',
                required: false,
                validation: { minLength: 0, maxLength: 600 }
            }
        ]
    },
    {
        id: 'tmpl_nav_hunt',
        title: 'Navigation & Broken-Link Hunt',
        category: 'Website Feedback',
        description: 'Verify page responsiveness, links, and layout transitions across SmartExn.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm that I tested platform navigation and provided honest findings.',
        questions: [
            {
                id: 'nav_q1',
                type: 'single_choice',
                title: 'Did all buttons and links you clicked navigate to the correct page?',
                required: true,
                options: [
                    { id: 'nav_all', text: 'Yes, all buttons and navigation worked as expected', value: 'All Worked' },
                    { id: 'nav_few', text: 'Found 1–2 broken or unresponsive links', value: 'Found 1-2 Issues' },
                    { id: 'nav_many', text: 'Encountered several broken links or dead ends', value: 'Several Issues' }
                ]
            },
            {
                id: 'nav_q2',
                type: 'short_text',
                title: 'If any button or link failed, which page or button was it?',
                required: true,
                showIf: {
                    questionId: 'nav_q1',
                    operator: 'not_equals',
                    value: 'All Worked'
                },
                validation: { minLength: 3, maxLength: 200 }
            },
            {
                id: 'nav_q3',
                type: 'rating',
                title: 'How easy is it to navigate between Work & Earn, Gigs Hub, and your Profile?',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            },
            {
                id: 'nav_q4',
                type: 'long_text',
                title: 'Any overall suggestions to make menus and navigation simpler?',
                required: false,
                validation: { minLength: 0, maxLength: 500 }
            }
        ]
    }
];
