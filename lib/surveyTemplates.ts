import { SurveyConfig } from '../types';

export const SMARTEXN_SURVEY_TEMPLATES: SurveyConfig[] = [
    {
        id: 'tmpl_discover',
        title: 'How Did You Discover SmartExn',
        category: 'Market Research',
        description: 'Help us understand how you found SmartExn, what you were searching for, and your onboarding experience.',
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
                title: 'How did you first hear about or discover SmartExn?',
                required: true,
                options: [
                    { id: 'opt_google', text: 'Google / Web Search', value: 'Google / Web Search' },
                    { id: 'opt_yt', text: 'YouTube Video / Review', value: 'YouTube' },
                    { id: 'opt_fb', text: 'Facebook', value: 'Facebook' },
                    { id: 'opt_ig', text: 'Instagram', value: 'Instagram' },
                    { id: 'opt_tt', text: 'TikTok', value: 'TikTok' },
                    { id: 'opt_wa', text: 'WhatsApp', value: 'WhatsApp' },
                    { id: 'opt_friend', text: 'Friend or Family Referral', value: 'Friend / Referral' },
                    { id: 'opt_forum', text: 'Online Community / Forum', value: 'Online Community / Forum' },
                    { id: 'opt_ad', text: 'Advertisement', value: 'Advertisement' },
                    { id: 'opt_direct', text: 'Direct URL / Link', value: 'Direct URL / Link' },
                    { id: 'opt_other', text: 'Other', value: 'Other' }
                ],
                allowOther: true,
                otherPlaceholder: 'Please specify how you discovered SmartExn...'
            },
            {
                id: 'disc_q2_other',
                type: 'short_text',
                title: 'Please specify where or how you discovered SmartExn:',
                required: false,
                showIf: {
                    questionId: 'disc_q1',
                    operator: 'equals',
                    value: 'Other'
                },
                validation: { minLength: 2, maxLength: 100 }
            },
            {
                id: 'disc_q3_intent',
                type: 'multiple_choice',
                title: 'What were you primarily looking for when you visited SmartExn?',
                required: true,
                options: [
                    { id: 'int_earn', text: 'Earning rewards by completing online micro-tasks & surveys', value: 'Earning rewards by completing online micro-tasks & surveys' },
                    { id: 'int_promote', text: 'Promoting my own business, website, or social media campaigns', value: 'Promoting my own business, website, or social media campaigns' },
                    { id: 'int_gigs', text: 'Exploring freelance digital gigs and flexible micro-jobs', value: 'Exploring freelance digital gigs and flexible micro-jobs' },
                    { id: 'int_research', text: 'Market research and consumer opinion testing', value: 'Market research and consumer opinion testing' },
                    { id: 'int_affiliate', text: 'Referral and team affiliate income', value: 'Referral and team affiliate income' }
                ],
                allowOther: true
            },
            {
                id: 'disc_q4_reason',
                type: 'single_choice',
                title: 'What was your main reason for visiting and registering today?',
                required: true,
                options: [
                    { id: 'r_trust', text: 'Recommended by someone I trust', value: 'Recommended by someone I trust' },
                    { id: 'r_reviews', text: 'Saw positive proofs or reviews online', value: 'Saw positive proofs or reviews online' },
                    { id: 'r_side', text: 'Wanted an easy way to earn side income on mobile/PC', value: 'Wanted an easy way to earn side income on mobile/PC' },
                    { id: 'r_campaigns', text: 'Need a reliable crowdsourcing workforce for my campaigns', value: 'Need a reliable crowdsourcing workforce for my campaigns' },
                    { id: 'r_curious', text: 'Curious to explore the platform features', value: 'Curious to explore the platform features' }
                ]
            },
            {
                id: 'disc_q5_rating',
                type: 'rating',
                title: 'How seamless and easy was your initial registration and onboarding experience?',
                description: '1 = Very Difficult, 5 = Extremely Smooth',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            },
            {
                id: 'disc_q6_feedback',
                type: 'long_text',
                title: 'Any suggestions to improve the first-time user discovery or onboarding process?',
                required: false,
                validation: { minLength: 0, maxLength: 600 }
            }
        ]
    },
    {
        id: 'tmpl_rewards_exp',
        title: 'Previous Rewards Platform Experience',
        category: 'Consumer Research',
        description: 'Share your background with other micro-task and earning websites, what you liked, and what SmartExn can improve.',
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
                title: 'Have you previously used or earned on other online rewards or micro-task platforms?',
                required: true
            },
            {
                id: 'rew_q2_types',
                type: 'multiple_choice',
                title: 'What types of earning platforms have you used in the past?',
                required: true,
                showIf: {
                    questionId: 'rew_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'p_micro', text: 'Micro-task & crowdsourcing websites (e.g., SproutGigs, Picoworkers)', value: 'Micro-task & crowdsourcing websites' },
                    { id: 'p_survey', text: 'Paid survey & opinion platforms (e.g., ySense, Swagbucks, Toluna)', value: 'Paid survey & opinion platforms' },
                    { id: 'p_offers', text: 'Offerwalls, app downloads & gaming rewards (e.g., Freecash)', value: 'Offerwalls, app downloads & gaming rewards' },
                    { id: 'p_freelance', text: 'Freelance gig marketplaces (e.g., Fiverr, Upwork)', value: 'Freelance gig marketplaces' },
                    { id: 'p_ptc', text: 'PTC (Pay-To-Click) & video-watching websites', value: 'PTC & video-watching websites' }
                ],
                allowOther: true
            },
            {
                id: 'rew_q3_liked',
                type: 'multiple_choice',
                title: 'What did you like most about the platforms you previously used?',
                required: true,
                showIf: {
                    questionId: 'rew_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'l_instant', text: 'Instant / fast withdrawal processing', value: 'Instant / fast withdrawal processing' },
                    { id: 'l_variety', text: 'Wide variety of daily tasks available', value: 'Wide variety of daily tasks available' },
                    { id: 'l_rates', text: 'High and competitive reward rates per task', value: 'High and competitive reward rates per task' },
                    { id: 'l_lowmin', text: 'Low minimum cashout threshold', value: 'Low minimum cashout threshold' },
                    { id: 'l_clear', text: 'Clear instructions and easy submission process', value: 'Clear instructions and easy submission process' },
                    { id: 'l_support', text: 'Helpful and responsive customer support', value: 'Helpful and responsive customer support' }
                ]
            },
            {
                id: 'rew_q4_problems',
                type: 'multiple_choice',
                title: 'What problems or frustrations did you experience on previous platforms?',
                required: true,
                showIf: {
                    questionId: 'rew_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'pr_reject', text: 'Unfair or unexplained task rejections', value: 'Unfair or unexplained task rejections' },
                    { id: 'pr_fees', text: 'High minimum withdrawal limits or hidden payout fees', value: 'High minimum withdrawal limits or hidden payout fees' },
                    { id: 'pr_bans', text: 'Sudden account bans or verification roadblocks', value: 'Sudden account bans or verification roadblocks' },
                    { id: 'pr_delay', text: 'Payment delays or unfulfilled withdrawals', value: 'Payment delays or unfulfilled withdrawals' },
                    { id: 'pr_region', text: 'Lack of available tasks for my region/country', value: 'Lack of available tasks for my region/country' },
                    { id: 'pr_links', text: 'Too many broken links or misleading instructions', value: 'Too many broken links or misleading instructions' }
                ],
                allowOther: true
            },
            {
                id: 'rew_q5_trust',
                type: 'top_n',
                title: 'What are the Top 3 most important factors that make you trust an earning platform?',
                description: 'Select up to 3 highest priorities.',
                required: true,
                options: [
                    { id: 'f_escrow', text: 'Escrow-backed reward protection', value: 'Escrow-backed reward protection' },
                    { id: 'f_dispute', text: 'Transparent proof verification and two-level dispute process', value: 'Transparent proof verification and two-level dispute process' },
                    { id: 'f_gateways', text: 'Fast and reliable multi-gateway withdrawals', value: 'Fast and reliable multi-gateway withdrawals' },
                    { id: 'f_nofees', text: 'Clear rules with no hidden deduction fees', value: 'Clear rules with no hidden deduction fees' },
                    { id: 'f_wallets', text: 'Real-time transaction history and wallet separation', value: 'Real-time transaction history and wallet separation' },
                    { id: 'f_official', text: 'Official company registration and responsive support', value: 'Official company registration and responsive support' }
                ],
                validation: { topN: 3, maxSelections: 3 }
            },
            {
                id: 'rew_q6_stop',
                type: 'single_choice',
                title: 'What was the main factor that caused you to stop using or reduce time on other platforms?',
                required: true,
                showIf: {
                    questionId: 'rew_q1',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 's_nodispute', text: 'Unfair proof rejections with no dispute option', value: 'Unfair proof rejections with no dispute option' },
                    { id: 's_delays', text: 'Payout delays or unreasonable minimum thresholds', value: 'Payout delays or unreasonable minimum thresholds' },
                    { id: 's_shortage', text: 'Shortage of paying tasks in my region', value: 'Shortage of paying tasks in my region' },
                    { id: 's_alt', text: 'Found better alternatives', value: 'Found better alternatives' },
                    { id: 's_ui', text: 'Complex or confusing user interface', value: 'Complex or confusing user interface' },
                    { id: 's_active', text: 'Still actively using other platforms', value: 'Still actively using other platforms' }
                ]
            },
            {
                id: 'rew_q7_explain',
                type: 'multiple_choice',
                title: 'What should SmartExn explain better to new users?',
                required: true,
                options: [
                    { id: 'ex_verify', text: 'Exactly how micro-tasks are verified and approved', value: 'Exactly how micro-tasks are verified and approved' },
                    { id: 'ex_wallets', text: 'The distinction between Task Earnings, Campaign, and Investment wallets', value: 'The distinction between Task Earnings, Campaign, and Investment wallets' },
                    { id: 'ex_escrow', text: 'How escrow protection protects both workers and campaign creators', value: 'How escrow protection protects both workers and campaign creators' },
                    { id: 'ex_thresholds', text: 'Minimum withdrawal thresholds and supported payment gateways', value: 'Minimum withdrawal thresholds and supported payment gateways' },
                    { id: 'ex_create', text: 'How to create campaigns and reach crowdsourced workers', value: 'How to create campaigns and reach crowdsourced workers' }
                ],
                allowOther: true
            }
        ]
    },
    {
        id: 'tmpl_feature_priority',
        title: 'Product Feature Priority',
        category: 'Product Feedback',
        description: 'Help prioritize new tools, capabilities, and upcoming roadmap features on SmartExn.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I agree to participate in feature roadmap prioritization.',
        questions: [
            {
                id: 'feat_q1_top3',
                type: 'top_n',
                title: 'Which upcoming features would you like to see prioritized first on SmartExn? (Select Top 3)',
                required: true,
                options: [
                    { id: 'feat_app', text: 'Dedicated Mobile App (Android / iOS APK)', value: 'Dedicated Mobile App' },
                    { id: 'feat_crypto', text: 'Direct Crypto / Binance Pay Micro-Withdrawals', value: 'Direct Crypto Micro-Withdrawals' },
                    { id: 'feat_daily', text: 'Daily Login Bonus Wheel & Streak Multiplier', value: 'Daily Streak Wheel & Login Bonus' },
                    { id: 'feat_surveys', text: 'Direct Global Survey Offerwalls', value: 'Direct Global Survey Offerwalls' },
                    { id: 'feat_vip', text: 'Tiered VIP Cashback & Lower Platform Fees', value: 'Tiered VIP Cashback' },
                    { id: 'feat_chat', text: 'Direct In-App Buyer-Worker Chat', value: 'Buyer-Worker Chat' },
                    { id: 'feat_auto', text: 'Instant Automated Proof Approval', value: 'Automated Proof Approval' },
                    { id: 'feat_badges', text: 'Skill Badges & Level-Up Multipliers', value: 'Skill Badges & Multipliers' },
                    { id: 'feat_lang', text: 'Multi-Language Platform Support', value: 'Multi-Language Support' },
                    { id: 'feat_filter', text: 'Advanced Task Filtering & Job Alerts', value: 'Advanced Task Filtering' }
                ],
                validation: { topN: 3, maxSelections: 3 }
            },
            {
                id: 'feat_q2_most_imp',
                type: 'single_choice',
                title: 'Out of the features above, which single feature is MOST important to you?',
                required: true,
                options: [
                    { id: 'f_app', text: 'Dedicated Mobile App', value: 'Dedicated Mobile App' },
                    { id: 'f_crypto', text: 'Direct Crypto Micro-Withdrawals', value: 'Direct Crypto Micro-Withdrawals' },
                    { id: 'f_daily', text: 'Daily Streak Wheel & Login Bonus', value: 'Daily Streak Wheel & Login Bonus' },
                    { id: 'f_surveys', text: 'Direct Global Survey Offerwalls', value: 'Direct Global Survey Offerwalls' },
                    { id: 'f_vip', text: 'Tiered VIP Cashback', value: 'Tiered VIP Cashback' },
                    { id: 'f_chat', text: 'Buyer-Worker Chat', value: 'Buyer-Worker Chat' },
                    { id: 'f_auto', text: 'Automated Proof Approval', value: 'Automated Proof Approval' },
                    { id: 'f_badges', text: 'Skill Badges & Multipliers', value: 'Skill Badges & Multipliers' },
                    { id: 'f_lang', text: 'Multi-Language Support', value: 'Multi-Language Support' },
                    { id: 'f_filter', text: 'Advanced Task Filtering', value: 'Advanced Task Filtering' }
                ]
            },
            {
                id: 'feat_q3_why',
                type: 'long_text',
                title: 'Why is this feature most important to you, and how would it improve your experience?',
                required: true,
                validation: { minLength: 10, maxLength: 1000 }
            },
            {
                id: 'feat_q4_other',
                type: 'long_text',
                title: 'Do you have any other feature suggestions or tools you would like added?',
                required: false,
                validation: { minLength: 0, maxLength: 1000 }
            }
        ]
    },
    {
        id: 'tmpl_earning_pref',
        title: 'Earning Opportunity Preferences',
        category: 'General Survey',
        description: 'Tell us which types of micro-tasks and gigs you enjoy the most, your ideal task length, and reward expectations.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm my answers reflect my actual work preferences.',
        questions: [
            {
                id: 'earn_q1_cats',
                type: 'multiple_choice',
                title: 'Which earning categories do you prefer participating in? (Select all that apply)',
                required: true,
                options: [
                    { id: 'e_survey', text: 'Paid Surveys & Opinion Studies', value: 'Paid Surveys & Opinion Studies' },
                    { id: 'e_social', text: 'Social & Content Engagement (Likes, Follows, Comments)', value: 'Social & Content Engagement' },
                    { id: 'e_test', text: 'App Testing & Usability Feedback', value: 'App Testing & Usability Feedback' },
                    { id: 'e_ai', text: 'Data & AI Annotation / Tagging Tasks', value: 'Data & AI Annotation / Tagging Tasks' },
                    { id: 'e_web', text: 'Website Usability & Review Gigs', value: 'Website Usability & Review Gigs' },
                    { id: 'e_signup', text: 'Account Sign-ups & Trial Registrations', value: 'Account Sign-ups & Trial Registrations' }
                ],
                validation: { minSelections: 1, maxSelections: 6 }
            },
            {
                id: 'earn_q2_fav',
                type: 'single_choice',
                title: 'Which one earning category is your ABSOLUTE FAVORITE?',
                required: true,
                options: [
                    { id: 'fav_survey', text: 'Paid Surveys & Opinion Studies', value: 'Paid Surveys & Opinion Studies' },
                    { id: 'fav_social', text: 'Social & Content Engagement', value: 'Social & Content Engagement' },
                    { id: 'fav_app', text: 'App Testing & Feedback', value: 'App Testing & Feedback' },
                    { id: 'fav_ai', text: 'Data & AI Annotation Tasks', value: 'Data & AI Annotation Tasks' },
                    { id: 'fav_web', text: 'Website Usability & Review', value: 'Website Usability & Review' },
                    { id: 'fav_signup', text: 'Account Sign-ups', value: 'Account Sign-ups' }
                ]
            },
            {
                id: 'earn_q3_length',
                type: 'single_choice',
                title: 'What is your ideal task/survey completion length?',
                required: true,
                options: [
                    { id: 'sl_1', text: '1–3 Minutes (Fast Micro-Tasks / Quick Polls)', value: '1–3 Minutes' },
                    { id: 'sl_2', text: '4–7 Minutes (Standard Surveys & Social Tasks)', value: '4–7 Minutes' },
                    { id: 'sl_3', text: '8–15 Minutes (In-depth Feedback / Testing)', value: '8–15 Minutes' },
                    { id: 'sl_4', text: '16–30 Minutes (Deep Research / Comprehensive Testing)', value: '16–30 Minutes' },
                    { id: 'sl_5', text: '30+ Minutes (High-Reward Complex Gigs)', value: '30+ Minutes' }
                ]
            },
            {
                id: 'earn_q4_min_reward',
                type: 'single_choice',
                title: 'What is the minimum acceptable reward for a 5-minute task on SmartExn?',
                required: true,
                options: [
                    { id: 'r_1', text: '$0.05 – $0.10 USD', value: '$0.05 – $0.10 USD' },
                    { id: 'r_2', text: '$0.10 – $0.25 USD', value: '$0.10 – $0.25 USD' },
                    { id: 'r_3', text: '$0.25 – $0.50 USD', value: '$0.25 – $0.50 USD' },
                    { id: 'r_4', text: '$0.50 – $1.00 USD', value: '$0.50 – $1.00 USD' },
                    { id: 'r_5', text: '$1.00+ USD', value: '$1.00+ USD' }
                ]
            },
            {
                id: 'earn_q5_freq',
                type: 'single_choice',
                title: 'What is your preferred working frequency and daily availability on SmartExn?',
                required: true,
                options: [
                    { id: 'f_active', text: 'Daily active earner (1–2 hours per day)', value: 'Daily active earner (1–2 hours per day)' },
                    { id: 'f_heavy', text: 'Daily intensive earner (3+ hours per day)', value: 'Daily intensive earner (3+ hours per day)' },
                    { id: 'f_part', text: 'A few days per week (part-time)', value: 'A few days per week (part-time)' },
                    { id: 'f_weekends', text: 'Weekends only', value: 'Weekends only' },
                    { id: 'f_casual', text: 'Occasional leisure time', value: 'Occasional leisure time' }
                ]
            }
        ]
    },
    {
        id: 'tmpl_device_habits',
        title: 'Device & Digital Habits',
        category: 'Website Feedback',
        description: 'Help us optimize performance and task compatibility across your hardware, network, and digital routine.',
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
                id: 'dev_q1_devices',
                type: 'multiple_choice',
                title: 'Which devices do you regularly use for online tasks? (Select all that apply)',
                required: true,
                options: [
                    { id: 'd_android', text: 'Android Smartphone', value: 'Android Smartphone' },
                    { id: 'd_ios', text: 'Apple iPhone / iPad', value: 'Apple iPhone / iPad' },
                    { id: 'd_win', text: 'Windows PC / Laptop', value: 'Windows PC / Laptop' },
                    { id: 'd_mac', text: 'Apple MacBook / iMac (MacOS)', value: 'Apple MacBook / iMac (MacOS)' },
                    { id: 'd_tab', text: 'Android Tablet', value: 'Android Tablet' }
                ],
                validation: { minSelections: 1, maxSelections: 5 }
            },
            {
                id: 'dev_q2_primary',
                type: 'single_choice',
                title: 'Which device is your PRIMARY work device on SmartExn?',
                required: true,
                options: [
                    { id: 'p_android', text: 'Android Smartphone', value: 'Android Smartphone' },
                    { id: 'p_ios', text: 'Apple iPhone', value: 'Apple iPhone' },
                    { id: 'p_win', text: 'Windows PC / Laptop', value: 'Windows PC / Laptop' },
                    { id: 'p_mac', text: 'Apple MacBook / MacOS', value: 'Apple MacBook / MacOS' },
                    { id: 'p_tab', text: 'Tablet', value: 'Tablet' }
                ]
            },
            {
                id: 'dev_q3_net',
                type: 'single_choice',
                title: 'What is your primary internet connection type and location?',
                required: true,
                options: [
                    { id: 'net_home', text: 'Home Broadband / Fiber WiFi', value: 'Home Broadband / Fiber WiFi' },
                    { id: 'net_mobile', text: '4G / 5G Mobile Data', value: '4G / 5G Mobile Data' },
                    { id: 'net_work', text: 'Workplace / University WiFi', value: 'Workplace / University WiFi' },
                    { id: 'net_pub', text: 'Public WiFi / Shared Network', value: 'Public WiFi / Shared Network' }
                ]
            },
            {
                id: 'dev_q4_daily',
                type: 'single_choice',
                title: 'On average, how many hours per day do you spend online?',
                required: true,
                options: [
                    { id: 'h_1', text: '1–2 hours', value: '1–2 hours' },
                    { id: 'h_2', text: '3–5 hours', value: '3–5 hours' },
                    { id: 'h_3', text: '6–8 hours', value: '6–8 hours' },
                    { id: 'h_4', text: '8+ hours (Heavy daily user)', value: '8+ hours (Heavy daily user)' }
                ]
            },
            {
                id: 'dev_q5_browser',
                type: 'single_choice',
                title: 'Which web browser do you predominantly use?',
                required: true,
                options: [
                    { id: 'b_chrome', text: 'Google Chrome', value: 'Google Chrome' },
                    { id: 'b_firefox', text: 'Mozilla Firefox', value: 'Mozilla Firefox' },
                    { id: 'b_safari', text: 'Apple Safari', value: 'Apple Safari' },
                    { id: 'b_edge', text: 'Microsoft Edge', value: 'Microsoft Edge' },
                    { id: 'b_other', text: 'Brave / Opera / Other', value: 'Brave / Opera / Other' }
                ]
            },
            {
                id: 'dev_q6_gaming',
                type: 'single_choice',
                title: 'How often do you play mobile or PC games?',
                required: true,
                options: [
                    { id: 'g_daily', text: 'Daily gamer', value: 'Daily gamer' },
                    { id: 'g_weekly', text: 'Weekly casual gamer', value: 'Weekly casual gamer' },
                    { id: 'g_rarely', text: 'Occasionally / Rarely', value: 'Occasionally / Rarely' },
                    { id: 'g_never', text: 'Never play games', value: 'Never play games' }
                ]
            },
            {
                id: 'dev_q7_testing',
                type: 'single_choice',
                title: 'Are you interested in testing new mobile apps and reporting bugs for higher rewards?',
                required: true,
                options: [
                    { id: 't_very', text: 'Very interested — I test apps regularly', value: 'Very interested — I test apps regularly' },
                    { id: 't_mod', text: 'Interested — If instructions are easy to follow', value: 'Interested — If instructions are easy to follow' },
                    { id: 't_high', text: 'Only if the payout is high', value: 'Only if the payout is high' },
                    { id: 't_no', text: 'Not interested in app testing', value: 'Not interested in app testing' }
                ]
            },
            {
                id: 'dev_q8_surveys',
                type: 'single_choice',
                title: 'How experienced are you with taking online research surveys?',
                required: true,
                options: [
                    { id: 's_high', text: 'Highly experienced (Take surveys frequently)', value: 'Highly experienced' },
                    { id: 's_mod', text: 'Moderately experienced (Take surveys occasionally)', value: 'Moderately experienced' },
                    { id: 's_beg', text: 'Beginner (New to online surveys)', value: 'Beginner' }
                ]
            },
            {
                id: 'dev_q9_social',
                type: 'single_choice',
                title: 'How active are you with social media and creator content engagement?',
                required: true,
                options: [
                    { id: 'soc_high', text: 'Extremely active (Daily interactions on YouTube/TikTok/Facebook)', value: 'Extremely active' },
                    { id: 'soc_mod', text: 'Moderately active (A few times a week)', value: 'Moderately active' },
                    { id: 'soc_pas', text: 'Passive viewer (Rarely like or comment)', value: 'Passive viewer' }
                ]
            },
            {
                id: 'dev_q10_shopping',
                type: 'single_choice',
                title: 'How often do you shop online or use e-commerce apps?',
                required: true,
                options: [
                    { id: 'sh_freq', text: 'Frequently (Multiple times a month)', value: 'Frequently' },
                    { id: 'sh_occ', text: 'Occasionally (Every few months)', value: 'Occasionally' },
                    { id: 'sh_rare', text: 'Rarely or Never', value: 'Rarely or Never' }
                ]
            },
            {
                id: 'dev_q11_trap',
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
            }
        ]
    },
    {
        id: 'tmpl_user_profile',
        title: 'User Profile & Preferences',
        category: 'Demographic Survey',
        description: 'Privacy-safe demographic background to help match relevant campaigns. Never requests passwords, CNIC/passport, bank credentials or exact DOB.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm that this survey collects only non-sensitive, aggregated demographic data.',
        questions: [
            {
                id: 'prof_q1_age',
                type: 'single_choice',
                title: 'What is your age range? (Must be 18+ to participate)',
                required: true,
                options: [
                    { id: 'age_1', text: '18–24', value: '18–24' },
                    { id: 'age_2', text: '25–34', value: '25–34' },
                    { id: 'age_3', text: '35–44', value: '35–44' },
                    { id: 'age_4', text: '45–54', value: '45–54' },
                    { id: 'age_5', text: '55–64', value: '55–64' },
                    { id: 'age_6', text: '65+', value: '65+' }
                ]
            },
            {
                id: 'prof_q2_country',
                type: 'single_choice',
                title: 'What is your country or geographic region of residence?',
                required: true,
                options: [
                    { id: 'c_pk', text: 'Pakistan', value: 'Pakistan' },
                    { id: 'c_in', text: 'India', value: 'India' },
                    { id: 'c_ng', text: 'Nigeria', value: 'Nigeria' },
                    { id: 'c_bd', text: 'Bangladesh', value: 'Bangladesh' },
                    { id: 'c_ph', text: 'Philippines', value: 'Philippines' },
                    { id: 'c_uk', text: 'United Kingdom', value: 'United Kingdom' },
                    { id: 'c_us', text: 'United States / Canada', value: 'United States / Canada' },
                    { id: 'c_other', text: 'Other International', value: 'Other International' }
                ],
                allowOther: true
            },
            {
                id: 'prof_q3_lang',
                type: 'single_choice',
                title: 'What is your primary language for online communication?',
                required: true,
                options: [
                    { id: 'l_en', text: 'English', value: 'English' },
                    { id: 'l_ur', text: 'Urdu', value: 'Urdu' },
                    { id: 'l_hi', text: 'Hindi', value: 'Hindi' },
                    { id: 'l_es', text: 'Spanish', value: 'Spanish' },
                    { id: 'l_ar', text: 'Arabic', value: 'Arabic' },
                    { id: 'l_bn', text: 'Bengali', value: 'Bengali' },
                    { id: 'l_other', text: 'Other', value: 'Other' }
                ],
                allowOther: true
            },
            {
                id: 'prof_q4_status',
                type: 'single_choice',
                title: 'What is your current occupational status?',
                required: true,
                options: [
                    { id: 'occ_stu', text: 'Student (College / University)', value: 'Student (College / University)' },
                    { id: 'occ_full', text: 'Employed Full-Time', value: 'Employed Full-Time' },
                    { id: 'occ_part', text: 'Employed Part-Time', value: 'Employed Part-Time' },
                    { id: 'occ_free', text: 'Freelancer / Independent Gig Worker', value: 'Freelancer / Independent Gig Worker' },
                    { id: 'occ_home', text: 'Homemaker', value: 'Homemaker' },
                    { id: 'occ_seek', text: 'Looking for Opportunities / Unemployed', value: 'Looking for Opportunities / Unemployed' }
                ]
            },
            {
                id: 'prof_q5_exp',
                type: 'single_choice',
                title: 'What is your level of experience with online earning platforms?',
                required: true,
                options: [
                    { id: 'exp_beg', text: 'Complete Beginner (Started recently)', value: 'Complete Beginner' },
                    { id: 'exp_mid', text: 'Intermediate (< 1 year experience)', value: 'Intermediate' },
                    { id: 'exp_exp', text: 'Experienced (1–3 years experience)', value: 'Experienced' },
                    { id: 'exp_vet', text: 'Veteran (3+ years experience)', value: 'Veteran' }
                ]
            },
            {
                id: 'prof_q6_cats',
                type: 'multiple_choice',
                title: 'Which earning categories are you most interested in?',
                required: true,
                options: [
                    { id: 'cat_surveys', text: 'Paid Surveys & Market Research', value: 'Paid Surveys & Market Research' },
                    { id: 'cat_social', text: 'Social Media Tasks (Follows, Likes, Shares)', value: 'Social Media Tasks' },
                    { id: 'cat_apps', text: 'Mobile App Reviews & Testing', value: 'Mobile App Reviews & Testing' },
                    { id: 'cat_data', text: 'Data Tagging & AI Training Micro-Jobs', value: 'Data Tagging & AI Training Micro-Jobs' },
                    { id: 'cat_signup', text: 'Sign-up Gigs & Website Audits', value: 'Sign-up Gigs & Website Audits' }
                ],
                validation: { minSelections: 1, maxSelections: 5 }
            },
            {
                id: 'prof_q7_activity',
                type: 'single_choice',
                title: 'How many hours per week do you plan to dedicate to SmartExn?',
                required: true,
                options: [
                    { id: 'act_1', text: 'Under 5 hours per week', value: 'Under 5 hours per week' },
                    { id: 'act_2', text: '5–15 hours per week', value: '5–15 hours per week' },
                    { id: 'act_3', text: '15–30 hours per week', value: '15–30 hours per week' },
                    { id: 'act_4', text: '30+ hours per week (Full-time focus)', value: '30+ hours per week' }
                ]
            },
            {
                id: 'prof_q8_payout',
                type: 'single_choice',
                title: 'What is your preferred payout gateway for withdrawing your rewards?',
                required: true,
                options: [
                    { id: 'pay_mobile', text: 'Local Mobile Wallet (JazzCash / Easypaisa)', value: 'Local Mobile Wallet (JazzCash / Easypaisa)' },
                    { id: 'pay_crypto', text: 'Binance Pay / USDT (TRC20 / BEP20)', value: 'Binance Pay / USDT (TRC20 / BEP20)' },
                    { id: 'pay_bank', text: 'Local Bank Wire / Direct Transfer', value: 'Local Bank Wire / Direct Transfer' },
                    { id: 'pay_global', text: 'PayPal / Payoneer / International Gateway', value: 'PayPal / Payoneer / International Gateway' }
                ]
            }
        ]
    },
    {
        id: 'tmpl_bug_hunter',
        title: 'Bug Hunter — QA',
        category: 'Website Feedback',
        description: 'Report technical errors, glitches, or styling issues with structured reproduction steps. Genuine and reproducible reports only.',
        version: 1,
        estimatedTimeMinutes: 4,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I agree to report genuine software observations with reproducible details.',
        questions: [
            {
                id: 'bug_q0_encountered',
                type: 'single_choice',
                title: 'Did you encounter a technical bug, layout glitch, or unexpected error during your platform testing?',
                required: true,
                options: [
                    { id: 'b_yes', text: 'Yes, I found a reproducible issue to report', value: 'Yes' },
                    { id: 'b_no', text: 'No, everything tested operated normally without errors', value: 'No' }
                ]
            },
            {
                id: 'bug_q1_page',
                type: 'single_choice',
                title: 'Which feature area or page did you experience the issue on?',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'ba_deposit', text: 'Deposit / Withdrawal Flow', value: 'Deposit / Withdrawal Flow' },
                    { id: 'ba_task', text: 'User Task Hub & Proof Submission', value: 'User Task Hub & Proof Submission' },
                    { id: 'ba_campaign', text: 'Campaign Creator & Survey Builder', value: 'Campaign Creator & Survey Builder' },
                    { id: 'ba_auth', text: 'Login, Registration, or Security', value: 'Login, Registration, or Security' },
                    { id: 'ba_wallet', text: 'Wallet Transfers & Balances', value: 'Wallet Transfers & Balances' },
                    { id: 'ba_nav', text: 'Menu Navigation & Header Tabs', value: 'Menu Navigation & Header Tabs' },
                    { id: 'ba_responsive', text: 'Mobile Responsive Layout', value: 'Mobile Responsive Layout' }
                ],
                allowOther: true
            },
            {
                id: 'bug_q2_url',
                type: 'short_text',
                title: 'What is the exact URL or page route where the issue occurred? (e.g., /tasks, /deposit, /campaigns)',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 1, maxLength: 200 }
            },
            {
                id: 'bug_q3_title',
                type: 'short_text',
                title: 'Issue Title: Brief summary of the bug (e.g., Submit button unresponsive on mobile)',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 5, maxLength: 120 }
            },
            {
                id: 'bug_q4_desc',
                type: 'long_text',
                title: 'Issue Description: Detailed explanation of what happened and where it occurred',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 10, maxLength: 1000 }
            },
            {
                id: 'bug_q5_steps',
                type: 'long_text',
                title: 'Reproduction Steps: Step-by-step instructions to reproduce the issue (1. Go to page, 2. Click button, 3. Observe error)',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 10, maxLength: 1000 }
            },
            {
                id: 'bug_q6_expected',
                type: 'long_text',
                title: 'Expected Result: What should have happened normally?',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 5, maxLength: 500 }
            },
            {
                id: 'bug_q7_actual',
                type: 'long_text',
                title: 'Actual Result: What actually happened (error message, crash, blank screen)?',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 5, maxLength: 500 }
            },
            {
                id: 'bug_q8_severity',
                type: 'single_choice',
                title: 'Bug Severity Level:',
                required: true,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    { id: 'sev_crit', text: 'Critical (Blocks usage, cannot deposit/withdraw/submit)', value: 'Critical' },
                    { id: 'sev_maj', text: 'Major (Key feature broken but workarounds exist)', value: 'Major' },
                    { id: 'sev_min', text: 'Minor (Visual layout glitch, text typo, or alignment issue)', value: 'Minor' },
                    { id: 'sev_triv', text: 'Trivial (Improvement suggestion or minor polish)', value: 'Trivial' }
                ]
            },
            {
                id: 'bug_q9_proof',
                type: 'short_text',
                title: 'Screenshot / Proof URL or image hosting link showing the issue (Optional or required for visual bugs)',
                required: false,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'Yes'
                },
                validation: { minLength: 0, maxLength: 300 }
            },
            {
                id: 'bug_q10_general',
                type: 'long_text',
                title: 'General Observations: Please share any general impressions about site performance, responsiveness, and stability',
                required: false,
                showIf: {
                    questionId: 'bug_q0_encountered',
                    operator: 'equals',
                    value: 'No'
                },
                validation: { minLength: 0, maxLength: 500 }
            }
        ]
    },
    {
        id: 'tmpl_clarity',
        title: 'New User Understanding / Clarity',
        category: 'General Survey',
        description: 'Evaluate how clear the earning rules, wallets, campaigns, and guidelines are for new members.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm my answers provide constructive feedback on platform clarity.',
        questions: [
            {
                id: 'clar_q1_what_is',
                type: 'single_choice',
                title: 'Based on what you have seen, what is SmartExn?',
                required: true,
                options: [
                    { id: 'wi_1', text: 'A crowdsourced marketplace for micro-tasks, surveys, and campaigns', value: 'A crowdsourced marketplace for micro-tasks, surveys, and campaigns' },
                    { id: 'wi_2', text: 'An automated passive investment bot', value: 'An automated passive investment bot' },
                    { id: 'wi_3', text: 'A social networking platform', value: 'A social networking platform' },
                    { id: 'wi_4', text: 'An online casino or betting site', value: 'An online casino or betting site' }
                ]
            },
            {
                id: 'clar_q2_workflow',
                type: 'rating',
                title: 'How clear is the 4-step workflow: Choose task -> Complete requirements -> Submit proof -> Earn reward?',
                description: '1 = Very Confusing, 5 = Crystal Clear',
                required: true,
                minRating: 1,
                maxRating: 5,
                validation: { minRating: 1, maxRating: 5 }
            },
            {
                id: 'clar_q3_campaigns',
                type: 'single_choice',
                title: 'Do you understand how businesses and advertisers create campaigns with escrow budget protection?',
                required: true,
                options: [
                    { id: 'cp_yes', text: 'Yes, perfectly clear', value: 'Yes, perfectly clear' },
                    { id: 'cp_some', text: 'Somewhat clear, but haven\'t created a campaign yet', value: 'Somewhat clear' },
                    { id: 'cp_no', text: 'No, still confusing', value: 'No, still confusing' }
                ]
            },
            {
                id: 'clar_q4_after_task',
                type: 'single_choice',
                title: 'What happens immediately after you submit proof for a completed task?',
                required: true,
                options: [
                    { id: 'at_1', text: 'Proof is reviewed by the creator or verified automatically, then reward is credited to Task Earnings', value: 'Proof is reviewed or verified, then reward is credited' },
                    { id: 'at_2', text: 'Money is immediately wired to personal bank with zero review', value: 'Money is immediately wired with zero review' },
                    { id: 'at_3', text: 'Nothing happens until end of the month', value: 'Nothing happens until end of the month' }
                ]
            },
            {
                id: 'clar_q5_timing',
                type: 'single_choice',
                title: 'What is your expectation for reward approval timing on SmartExn?',
                required: true,
                options: [
                    { id: 't_instant', text: 'Instant for automated surveys / tasks', value: 'Instant for automated surveys / tasks' },
                    { id: 't_24h', text: 'Within 12–24 hours for manual creator review', value: 'Within 12–24 hours for manual creator review' },
                    { id: 't_48h', text: 'Up to 48 hours with dispute escalation protection', value: 'Up to 48 hours with dispute escalation protection' }
                ]
            },
            {
                id: 'clar_q6_support',
                type: 'single_choice',
                title: 'Do you know how to access support or initiate a dispute if a proof is mistakenly rejected?',
                required: true,
                options: [
                    { id: 'sup_yes', text: 'Yes, I know about the two-level dispute desk and support channels', value: 'Yes, I know about the two-level dispute desk' },
                    { id: 'sup_some', text: 'Somewhat, but need more guidance', value: 'Somewhat, but need more guidance' },
                    { id: 'sup_no', text: 'No, wasn\'t aware of the dispute desk', value: 'No, wasn\'t aware of the dispute desk' }
                ]
            },
            {
                id: 'clar_q7_confusion',
                type: 'multiple_choice',
                title: 'Which aspects of SmartExn (if any) felt confusing or need clearer instructions?',
                required: true,
                options: [
                    { id: 'c_wallets', text: 'Separation between Task Earnings, Campaign, and Investment Wallets', value: 'Separation between Wallets' },
                    { id: 'c_formats', text: 'Required proof submission formats (screenshots vs. text)', value: 'Required proof submission formats' },
                    { id: 'c_thresh', text: 'Minimum withdrawal thresholds and currency conversion', value: 'Minimum withdrawal thresholds' },
                    { id: 'c_escrow', text: 'Campaign creation and escrow budgeting', value: 'Campaign creation and escrow budgeting' },
                    { id: 'c_dispute', text: 'Two-level dispute review policy', value: 'Two-level dispute review policy' },
                    { id: 'c_none', text: 'None — everything is very clear and straightforward', value: 'None — everything is very clear' }
                ],
                validation: { minSelections: 1, maxSelections: 6 }
            },
            {
                id: 'clar_q8_misleading',
                type: 'long_text',
                title: 'Did you encounter any text, label, or guideline on the platform that felt ambiguous or misleading?',
                required: false,
                validation: { minLength: 0, maxLength: 600 }
            },
            {
                id: 'clar_q9_improve',
                type: 'long_text',
                title: 'What single change would make SmartExn the easiest earning platform to understand?',
                required: false,
                validation: { minLength: 0, maxLength: 600 }
            }
        ]
    },
    {
        id: 'tmpl_nav_hunt',
        title: 'Navigation & Broken-Link Hunt',
        category: 'Website Feedback',
        description: 'Verify page responsiveness, links, buttons, and layout transitions across SmartExn.',
        version: 1,
        estimatedTimeMinutes: 3,
        approvalMode: 'auto',
        consentRequired: true,
        consentText: 'I confirm that I tested platform navigation and provided honest findings.',
        questions: [
            {
                id: 'nav_q1_page',
                type: 'single_choice',
                title: 'Which primary page or section did you audit for broken links or buttons?',
                required: true,
                options: [
                    { id: 'aud_home', text: 'Homepage & Public Landing Sections', value: 'Homepage & Public Landing Sections' },
                    { id: 'aud_dash', text: 'User Dashboard & Overview', value: 'User Dashboard & Overview' },
                    { id: 'aud_earn', text: 'Earning Area / Tasks Hub & Submission Modals', value: 'Earning Area / Tasks Hub' },
                    { id: 'aud_camp', text: 'My Campaigns & Campaign Management', value: 'My Campaigns & Campaign Management' },
                    { id: 'aud_wall', text: 'Wallets, Deposits, Transfers & Withdrawals', value: 'Wallets, Deposits, Transfers & Withdrawals' },
                    { id: 'aud_prof', text: 'Profile, Settings & Security', value: 'Profile, Settings & Security' },
                    { id: 'aud_legal', text: 'Legal Pages (Terms, Privacy, FAQs, Policy)', value: 'Legal Pages' }
                ]
            },
            {
                id: 'nav_q2_url',
                type: 'short_text',
                title: 'What is the exact URL or route of the page tested? (e.g., /dashboard, /tasks, /terms)',
                required: true,
                validation: { minLength: 1, maxLength: 200 }
            },
            {
                id: 'nav_q3_element',
                type: 'short_text',
                title: 'Which specific button, tab, or link did you test? (e.g., \'View Details\' button, \'Converter\' tab)',
                required: true,
                validation: { minLength: 2, maxLength: 150 }
            },
            {
                id: 'nav_q4_issue_type',
                type: 'single_choice',
                title: 'What was the result of your test?',
                required: true,
                options: [
                    { id: 'res_ok', text: 'Worked perfectly (Navigated to correct destination)', value: 'Worked perfectly' },
                    { id: 'res_404', text: '404 / Page Not Found error', value: '404 / Page Not Found error' },
                    { id: 'res_unresp', text: 'Button clicked but nothing happened (Unresponsive)', value: 'Button clicked but nothing happened' },
                    { id: 'res_wrong', text: 'Navigated to wrong or unexpected page', value: 'Navigated to wrong or unexpected page' },
                    { id: 'res_crash', text: 'Page crashed or showed white screen', value: 'Page crashed or showed white screen' },
                    { id: 'res_visual', text: 'Visual alignment or text clipping glitch', value: 'Visual alignment or text clipping glitch' }
                ]
            },
            {
                id: 'nav_q5_expected',
                type: 'short_text',
                title: 'What was the expected result when clicking the element?',
                required: true,
                validation: { minLength: 3, maxLength: 300 }
            },
            {
                id: 'nav_q6_actual',
                type: 'short_text',
                title: 'What was the actual result you observed?',
                required: true,
                validation: { minLength: 3, maxLength: 300 }
            },
            {
                id: 'nav_q7_device_browser',
                type: 'short_text',
                title: 'What device and browser were you using? (e.g., Chrome on Android, Safari on iPhone)',
                required: true,
                validation: { minLength: 3, maxLength: 150 }
            },
            {
                id: 'nav_q8_proof',
                type: 'short_text',
                title: 'Screenshot / Proof URL or image link (if an issue was found)',
                required: false,
                validation: { minLength: 0, maxLength: 300 }
            }
        ]
    }
];
