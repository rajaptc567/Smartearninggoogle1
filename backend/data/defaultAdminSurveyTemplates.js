/**
 * Default Admin-Only Master Survey Templates
 * 
 * Master Template 1: SmartExn Member Profile, Experience & Preferences Survey
 * 
 * 12 Structured Sections, 51 Comprehensive Questions with stable logic rules and D2 profile mappings.
 */

export const MASTER_MEMBER_SURVEY_TEMPLATE = {
    name: 'SmartExn Member Profile, Experience & Preferences Survey',
    description: 'Comprehensive member survey assessing user demographics, internet & device habits, discovery channels, earning platform history, SmartExn UX, withdrawal satisfaction, bugs, feature priorities, and marketing promoter interest.',
    category: 'Member Intelligence & Experience',
    version: 1,
    enabled: true,
    estimatedTimeMinutes: 6,
    isMasterDefault: true,
    rewardConfig: {
        mode: 'no_reward',
        amount: 0,
        currency: 'USD'
    },
    requirementConfig: {
        mode: 'optional'
    },
    recompletionPolicy: {
        policy: 'never',
        intervalDays: 30
    },
    surveyConfig: {
        title: 'SmartExn Member Profile, Experience & Preferences Survey',
        description: 'Please complete this feedback survey to help us tailor earning tasks, optimize withdrawal channels, and prioritize new features.',
        category: 'Member Intelligence & Experience',
        version: 1,
        estimatedTimeMinutes: 6,
        consentRequired: true,
        consentText: 'I confirm that I am participating voluntarily and will provide honest, accurate feedback to help improve the SmartExn platform.',
        approvalMode: 'auto',
        qualityRules: {
            minCompletionTimeSeconds: 45,
            flagFastCompletion: true,
            attentionCheckRequired: false,
            autoRejectOnFail: false
        },
        sections: [
            { id: 'sec_1', title: 'Welcome & Consent', description: 'Survey introduction and readiness verification.' },
            { id: 'sec_2', title: 'About You', description: 'General background and employment context.' },
            { id: 'sec_3', title: 'Internet & Social Media', description: 'Device usage, online habits, and social channels.' },
            { id: 'sec_4', title: 'SmartExn Discovery', description: 'How you found SmartExn and your onboarding goals.' },
            { id: 'sec_5', title: 'Previous Online Earning Experience', description: 'Prior experience with reward and microtask platforms.' },
            { id: 'sec_6', title: 'SmartExn Experience', description: 'Satisfaction with usability, tasks, and submission flows.' },
            { id: 'sec_7', title: 'Withdrawal Experience', description: 'Payout satisfaction and feedback.' },
            { id: 'sec_8', title: 'Bugs & Platform Problems', description: 'Technical issue reports and UX friction.' },
            { id: 'sec_9', title: 'Earning Preferences', description: 'Task types and decision priorities.' },
            { id: 'sec_10', title: 'Feature Priorities', description: 'Product roadmap suggestions and enhancements.' },
            { id: 'sec_11', title: 'SmartExn Sharing & Marketing', description: 'Community growth and advocacy.' },
            { id: 'sec_12', title: 'Future SmartExn & Final Thoughts', description: 'NPS rating and concluding ideas.' }
        ],
        questions: [
            // Section 1: Welcome
            {
                id: 'q1_welcome',
                sectionId: 'sec_1',
                type: 'single_choice',
                title: 'Welcome to the SmartExn Member Profile, Experience & Preferences Survey. We collect this feedback to personalize earning opportunities, improve payout flows, and build features that matter to you.',
                required: true,
                options: [
                    'I understand and wish to proceed with the survey'
                ]
            },
            {
                id: 'q2_ready',
                sectionId: 'sec_1',
                type: 'single_choice',
                title: 'Are you ready to continue with this survey?',
                required: true,
                options: [
                    "Yes, I'm ready",
                    'No, maybe later'
                ],
                logicRules: [
                    {
                        id: 'rule_q2_abort',
                        matchType: 'ALL',
                        conditions: [
                            { questionId: 'q2_ready', operator: 'equals', value: 'No, maybe later' }
                        ],
                        action: 'end_survey'
                    }
                ]
            },

            // Section 2: About You
            {
                id: 'q3_age',
                sectionId: 'sec_2',
                type: 'single_choice',
                title: 'What is your age?',
                required: true,
                options: [
                    '18–24 years',
                    '25–34 years',
                    '35–44 years',
                    '45–54 years',
                    '55 years or older',
                    'Prefer not to say'
                ]
            },
            {
                id: 'q4_employment',
                sectionId: 'sec_2',
                type: 'single_choice',
                title: 'Which of the following best describes your current employment status?',
                required: true,
                options: [
                    'Full-time employee',
                    'Part-time employee',
                    'Freelancer',
                    'Self-employed / Business owner',
                    'Student',
                    'Currently unemployed',
                    'Homemaker',
                    'Retired',
                    'Other',
                    'Prefer not to say'
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'employmentStatus'
                }
            },
            {
                id: 'q5_industry',
                sectionId: 'sec_2',
                type: 'single_choice',
                title: 'What type of work, business or study are you currently involved in?',
                required: true,
                options: [
                    'Technology / IT',
                    'Education',
                    'Finance / Accounting',
                    'Healthcare',
                    'Marketing / Sales',
                    'E-commerce',
                    'Business / Entrepreneurship',
                    'Freelancing',
                    'Content creation',
                    'Customer service',
                    'Engineering',
                    'Government / Public sector',
                    'Other',
                    'Prefer not to say'
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'industry'
                }
            },
            {
                id: 'q6_income',
                sectionId: 'sec_2',
                type: 'single_choice',
                title: 'Which income range best describes your approximate monthly personal income?',
                required: false,
                options: [
                    'I currently have no personal income',
                    'Under $100',
                    '$100–$249',
                    '$250–$499',
                    '$500–$999',
                    '$1,000–$2,499',
                    '$2,500 or more',
                    'Prefer not to say'
                ]
            },

            // Section 3: Internet & Social Media
            {
                id: 'q7_internet_freq',
                sectionId: 'sec_3',
                type: 'single_choice',
                title: 'How often do you use the internet?',
                required: true,
                options: [
                    'Less than 1 hour per day',
                    '1–3 hours per day',
                    '3–5 hours per day',
                    '5–8 hours per day',
                    'More than 8 hours per day'
                ]
            },
            {
                id: 'q8_primary_device',
                sectionId: 'sec_3',
                type: 'single_choice',
                title: 'Which device do you use most often to access the internet?',
                required: true,
                options: [
                    'Android smartphone',
                    'iPhone',
                    'Windows PC/Laptop',
                    'Mac',
                    'Tablet',
                    'I use multiple devices equally'
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'primaryDevice'
                }
            },
            {
                id: 'q9_social_platforms',
                sectionId: 'sec_3',
                type: 'multiple_choice',
                title: 'Which social media platforms do you actively use?',
                required: true,
                options: [
                    'Facebook',
                    'YouTube',
                    'Instagram',
                    'TikTok',
                    'WhatsApp',
                    'X / Twitter',
                    'LinkedIn',
                    'Snapchat',
                    'Telegram',
                    'Reddit',
                    'Other',
                    "I don't use social media"
                ]
            },
            {
                id: 'q10_top_social',
                sectionId: 'sec_3',
                type: 'single_choice',
                title: 'Which ONE social media platform do you use the most?',
                required: true,
                options: [
                    'Facebook',
                    'YouTube',
                    'Instagram',
                    'TikTok',
                    'WhatsApp',
                    'X / Twitter',
                    'LinkedIn',
                    'Snapchat',
                    'Telegram',
                    'Reddit',
                    'Other',
                    "I don't use social media"
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'primarySocialPlatform'
                }
            },
            {
                id: 'q11_yt_freq',
                sectionId: 'sec_3',
                type: 'single_choice',
                title: 'How often do you watch videos on YouTube?',
                required: true,
                options: [
                    'Several times a day',
                    'Once a day',
                    'Several times a week',
                    'Occasionally',
                    'I rarely use YouTube',
                    "I don't use YouTube"
                ]
            },
            {
                id: 'q12_yt_content',
                sectionId: 'sec_3',
                type: 'multiple_choice',
                title: 'What type of content do you usually watch on YouTube?',
                required: false,
                options: [
                    'Entertainment',
                    'Educational / Tutorials',
                    'Technology',
                    'Online earning / Freelancing',
                    'Gaming',
                    'News',
                    'Reviews',
                    'Business / Finance',
                    'Lifestyle',
                    'Other'
                ]
            },

            // Section 4: SmartExn Discovery
            {
                id: 'q13_discovery',
                sectionId: 'sec_4',
                type: 'single_choice',
                title: 'How did you first discover SmartExn?',
                required: true,
                options: [
                    'Google Search',
                    'YouTube',
                    'Facebook',
                    'Instagram',
                    'TikTok',
                    'WhatsApp',
                    'Friend or family member',
                    'Online community/forum',
                    'Advertisement',
                    'Referral',
                    'Direct website address',
                    'Other'
                ]
            },
            {
                id: 'q14_intent',
                sectionId: 'sec_4',
                type: 'multiple_choice',
                title: 'What were you mainly looking for when you discovered SmartExn?',
                required: true,
                options: [
                    'Paid surveys',
                    'Microtasks',
                    'Online earning opportunities',
                    'Freelancing',
                    'App testing',
                    'Game testing',
                    'Offerwalls',
                    'Extra income',
                    'Work-from-home opportunities',
                    'Other'
                ]
            },
            {
                id: 'q15_signup_reason',
                sectionId: 'sec_4',
                type: 'single_choice',
                title: 'What was the main reason you decided to create a SmartExn account?',
                required: true,
                options: [
                    'Earn extra income in my free time',
                    'Complete interesting micro-tasks',
                    'Take paid surveys on global topics',
                    'Recommended by a trusted friend or creator',
                    'Wanted a platform with easy and fast withdrawals',
                    'Curiosity about crowdsourced work',
                    'Other'
                ]
            },

            // Section 5: Previous Online Earning Experience
            {
                id: 'q16_prev_platforms',
                sectionId: 'sec_5',
                type: 'single_choice',
                title: 'Have you ever used another online earning, survey or rewards platform?',
                required: true,
                options: [
                    'Yes',
                    'No',
                    'Prefer not to say'
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'previousEarningExperience'
                }
            },
            {
                id: 'q17_prev_types',
                sectionId: 'sec_5',
                type: 'multiple_choice',
                title: 'What types of online earning platforms have you used before?',
                required: true,
                showIf: {
                    questionId: 'q16_prev_platforms',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Paid survey platforms',
                    'Microtask platforms',
                    'Offerwall platforms',
                    'Cashback/reward platforms',
                    'Gaming/reward platforms',
                    'App testing platforms',
                    'Freelancing platforms',
                    'Other'
                ]
            },
            {
                id: 'q18_prev_likes',
                sectionId: 'sec_5',
                type: 'multiple_choice',
                title: 'What did you like most about those platforms?',
                required: true,
                showIf: {
                    questionId: 'q16_prev_platforms',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Higher rewards',
                    'More available tasks',
                    'Fast payments',
                    'Easy withdrawals',
                    'Good user interface',
                    'Clear instructions',
                    'Good customer support',
                    'Many earning options',
                    'Other'
                ]
            },
            {
                id: 'q19_prev_problems',
                sectionId: 'sec_5',
                type: 'multiple_choice',
                title: 'What problems have you experienced with other earning platforms?',
                required: true,
                showIf: {
                    questionId: 'q16_prev_platforms',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Too few tasks',
                    'Low rewards',
                    'High withdrawal minimum',
                    'Payment delays',
                    'Account restrictions',
                    'Survey disqualifications',
                    'Poor support',
                    'Complicated website',
                    'Tasks unavailable in my country',
                    'Other'
                ]
            },

            // Section 6: SmartExn Experience
            {
                id: 'q20_overall_rating',
                sectionId: 'sec_6',
                type: 'rating',
                title: 'How would you rate your overall experience with SmartExn so far?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q21_nav_rating',
                sectionId: 'sec_6',
                type: 'rating',
                title: 'How easy is it for you to understand and navigate SmartExn?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q22_opportunities_rating',
                sectionId: 'sec_6',
                type: 'rating',
                title: 'How satisfied are you with the availability of earning opportunities?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q23_instructions_rating',
                sectionId: 'sec_6',
                type: 'rating',
                title: 'How clear and easy to understand are the task instructions?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q24_submission_rating',
                sectionId: 'sec_6',
                type: 'rating',
                title: 'How easy is the task submission process?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q25_experienced_bug',
                sectionId: 'sec_6',
                type: 'single_choice',
                title: 'Have you experienced any problem, error or bug while using SmartExn?',
                required: true,
                options: [
                    'Yes',
                    'No'
                ]
            },

            // Section 7: Withdrawal Experience
            {
                id: 'q26_requested_withdrawal',
                sectionId: 'sec_7',
                type: 'single_choice',
                title: 'Have you ever requested a withdrawal from SmartExn?',
                required: true,
                options: [
                    'Yes',
                    'No'
                ]
            },
            {
                id: 'q27_withdrawal_satisfaction',
                sectionId: 'sec_7',
                type: 'rating',
                title: 'How satisfied were you with your withdrawal experience?',
                required: true,
                minRating: 1,
                maxRating: 5,
                showIf: {
                    questionId: 'q26_requested_withdrawal',
                    operator: 'equals',
                    value: 'Yes'
                }
            },
            {
                id: 'q28_withdrawal_speed',
                sectionId: 'sec_7',
                type: 'rating',
                title: 'How satisfied were you with the processing speed of your withdrawal?',
                required: true,
                minRating: 1,
                maxRating: 5,
                showIf: {
                    questionId: 'q26_requested_withdrawal',
                    operator: 'equals',
                    value: 'Yes'
                }
            },
            {
                id: 'q29_withdrawal_problem',
                sectionId: 'sec_7',
                type: 'single_choice',
                title: 'Did you experience any problem during your withdrawal?',
                required: true,
                options: [
                    'Yes',
                    'No'
                ],
                showIf: {
                    questionId: 'q26_requested_withdrawal',
                    operator: 'equals',
                    value: 'Yes'
                }
            },
            {
                id: 'q30_withdrawal_problem_desc',
                sectionId: 'sec_7',
                type: 'long_text',
                title: 'Please briefly describe the withdrawal problem you experienced.',
                required: true,
                showIf: {
                    questionId: 'q29_withdrawal_problem',
                    operator: 'equals',
                    value: 'Yes'
                }
            },

            // Section 8: Bugs / Problems
            {
                id: 'q31_bug_location',
                sectionId: 'sec_8',
                type: 'single_choice',
                title: 'Where did you experience the problem?',
                required: true,
                showIf: {
                    questionId: 'q25_experienced_bug',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Login / Registration',
                    'Dashboard',
                    'Available Tasks',
                    'Surveys',
                    'Task Submission',
                    'Campaigns',
                    'Withdrawals',
                    'Profile',
                    'Notifications',
                    'Other'
                ]
            },
            {
                id: 'q32_bug_description',
                sectionId: 'sec_8',
                type: 'long_text',
                title: 'Please describe what happened.',
                required: true,
                showIf: {
                    questionId: 'q25_experienced_bug',
                    operator: 'equals',
                    value: 'Yes'
                }
            },
            {
                id: 'q33_bug_device',
                sectionId: 'sec_8',
                type: 'single_choice',
                title: 'Which device were you using when the problem occurred?',
                required: true,
                showIf: {
                    questionId: 'q25_experienced_bug',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Android',
                    'iPhone',
                    'Windows PC/Laptop',
                    'Mac',
                    'Tablet',
                    'Other'
                ]
            },
            {
                id: 'q34_bug_severity',
                sectionId: 'sec_8',
                type: 'single_choice',
                title: 'How serious was the problem?',
                required: true,
                showIf: {
                    questionId: 'q25_experienced_bug',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Minor',
                    'Moderate',
                    'Major',
                    'Critical'
                ]
            },
            {
                id: 'q35_bug_proof_interest',
                sectionId: 'sec_8',
                type: 'single_choice',
                title: 'Would you like to provide a screenshot or additional proof?',
                required: false,
                showIf: {
                    questionId: 'q25_experienced_bug',
                    operator: 'equals',
                    value: 'Yes'
                },
                options: [
                    'Yes',
                    'No'
                ]
            },

            // Section 9: Earning Preferences
            {
                id: 'q36_earning_interests',
                sectionId: 'sec_9',
                type: 'multiple_choice',
                title: 'Which earning opportunities would you be most interested in?',
                required: true,
                validation: {
                    maxSelections: 5
                },
                options: [
                    'Paid surveys',
                    'Microtasks',
                    'App testing',
                    'Game testing',
                    'Offerwalls',
                    'Product testing',
                    'Research studies',
                    'Data-related tasks',
                    'AI-related tasks',
                    'Content/creative tasks',
                    'Other'
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'earningInterests'
                }
            },
            {
                id: 'q37_top_earning_opportunity',
                sectionId: 'sec_9',
                type: 'single_choice',
                title: 'Which ONE earning opportunity would you most like SmartExn to increase?',
                required: true,
                options: [
                    'Paid surveys',
                    'Microtasks',
                    'App testing',
                    'Game testing',
                    'Offerwalls',
                    'Product testing',
                    'Research studies',
                    'Data-related tasks',
                    'AI-related tasks',
                    'Content/creative tasks',
                    'Other'
                ],
                profileMapping: {
                    enabled: true,
                    fieldKey: 'preferredEarningCategory'
                }
            },
            {
                id: 'q38_task_decision_factors',
                sectionId: 'sec_9',
                type: 'multiple_choice',
                title: 'When choosing an earning task, which factors are most important to you? (Select up to 3)',
                required: true,
                validation: {
                    maxSelections: 3
                },
                options: [
                    'Higher reward',
                    'Short completion time',
                    'Fast approval',
                    'Fast payment',
                    'More available tasks',
                    'Clear instructions',
                    'Low rejection risk',
                    'Interesting work',
                    'Trusted advertiser',
                    'Multiple payment methods'
                ]
            },

            // Section 10: Feature Priorities
            {
                id: 'q39_feature_priorities',
                sectionId: 'sec_10',
                type: 'multiple_choice',
                title: 'Which features would you most like SmartExn to improve or add? (Select up to 5)',
                required: true,
                validation: {
                    maxSelections: 5
                },
                options: [
                    'More paid surveys',
                    'More microtasks',
                    'Higher-paying tasks',
                    'App testing',
                    'Game testing',
                    'Faster withdrawals',
                    'More withdrawal methods',
                    'Mobile app',
                    'Better task filtering',
                    'Personalized task recommendations',
                    'Better customer support',
                    'Referral features',
                    'Other'
                ]
            },
            {
                id: 'q40_top_feature',
                sectionId: 'sec_10',
                type: 'single_choice',
                title: 'If you could choose only ONE new SmartExn feature, which would be your first choice?',
                required: true,
                options: [
                    'More paid surveys',
                    'More microtasks',
                    'Higher-paying tasks',
                    'Mobile app (Android / iOS)',
                    'Faster withdrawals',
                    'More withdrawal methods',
                    'Personalized task recommendations',
                    'Advanced dispute arbitration',
                    'Enhanced referral rewards',
                    'Other'
                ]
            },
            {
                id: 'q41_feature_importance_reason',
                sectionId: 'sec_10',
                type: 'long_text',
                title: 'Why would this feature be important to you?',
                required: false
            },

            // Section 11: SmartExn Sharing / Marketing
            {
                id: 'q42_recommend_willingness',
                sectionId: 'sec_11',
                type: 'single_choice',
                title: 'Would you be interested in recommending SmartExn to your friends or family?',
                required: true,
                options: [
                    'Yes, definitely',
                    'Maybe',
                    'No',
                    'I already recommend SmartExn'
                ]
            },
            {
                id: 'q43_sharing_channels',
                sectionId: 'sec_11',
                type: 'multiple_choice',
                title: 'Where would you be most comfortable sharing SmartExn?',
                required: true,
                showIf: {
                    questionId: 'q42_recommend_willingness',
                    operator: 'not_equals',
                    value: 'No'
                },
                options: [
                    'WhatsApp',
                    'Facebook',
                    'Instagram',
                    'TikTok',
                    'YouTube',
                    'X / Twitter',
                    'Telegram',
                    'Reddit',
                    'Personal website/blog',
                    'Directly with friends/family',
                    'Other'
                ]
            },
            {
                id: 'q44_public_sharing',
                sectionId: 'sec_11',
                type: 'single_choice',
                title: 'Would you be interested in sharing SmartExn publicly on your social media?',
                required: true,
                showIf: {
                    questionId: 'q42_recommend_willingness',
                    operator: 'not_equals',
                    value: 'No'
                },
                options: [
                    'Yes',
                    'Maybe',
                    'No'
                ]
            },
            {
                id: 'q45_sharing_content_types',
                sectionId: 'sec_11',
                type: 'multiple_choice',
                title: 'What type of content would you prefer to share?',
                required: true,
                showIf: {
                    questionId: 'q42_recommend_willingness',
                    operator: 'not_equals',
                    value: 'No'
                },
                options: [
                    'Personal experience',
                    'Referral/link',
                    'SmartExn promotional post',
                    'Short video',
                    'YouTube video',
                    'Review',
                    'Information about earning opportunities',
                    'Other'
                ]
            },
            {
                id: 'q46_shared_link',
                sectionId: 'sec_11',
                type: 'short_text',
                title: 'If you have already shared SmartExn, would you like to provide the post/video/link?',
                required: false,
                showIf: {
                    questionId: 'q42_recommend_willingness',
                    operator: 'not_equals',
                    value: 'No'
                }
            },
            {
                id: 'q47_creator_promotion_interest',
                sectionId: 'sec_11',
                type: 'multiple_choice',
                title: 'If you would like to help us promote SmartExn, what type of promotional content would you be interested in creating?',
                required: false,
                showIf: {
                    questionId: 'q42_recommend_willingness',
                    operator: 'not_equals',
                    value: 'No'
                },
                options: [
                    'YouTube video',
                    'TikTok/Reel',
                    'Facebook post',
                    'Instagram post/story',
                    'Blog/article',
                    'Community/forum post',
                    'Referral sharing',
                    'Other'
                ]
            },

            // Section 12: Future SmartExn
            {
                id: 'q48_future_usage_likelihood',
                sectionId: 'sec_12',
                type: 'rating',
                title: 'If SmartExn provides more earning opportunities that match your interests, how likely are you to use SmartExn more often?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q49_nps',
                sectionId: 'sec_12',
                type: 'opinion_scale',
                title: 'How likely are you to recommend SmartExn to someone you know? (0 = Not at all likely, 10 = Extremely likely)',
                required: true,
                minRating: 0,
                maxRating: 10
            },
            {
                id: 'q50_one_improvement',
                sectionId: 'sec_12',
                type: 'long_text',
                title: 'What is the ONE thing SmartExn could do that would make your experience significantly better?',
                required: true
            },
            {
                id: 'q51_final_thoughts',
                sectionId: 'sec_12',
                type: 'long_text',
                title: 'Is there anything else you would like the SmartExn team to know?',
                required: false
            }
        ]
    }
};

export const MASTER_57_MEMBER_SURVEY_TEMPLATE = {
    name: 'SmartExn Complete Member Profile & Earning Preferences Survey (57 Questions)',
    description: 'Comprehensive 57-question master survey covering demographics, education, digital skills, social media platforms, online earning history, task preferences, payment provider preferences (withdrawal, deposit, current), SmartExn usage, bug reports, and future feedback.',
    category: 'Member Intelligence & Experience',
    version: 1,
    enabled: true,
    estimatedTimeMinutes: 7,
    isMasterDefault: false,
    rewardConfig: {
        mode: 'no_reward',
        amount: 0,
        currency: 'USD'
    },
    requirementConfig: {
        mode: 'optional'
    },
    recompletionPolicy: {
        policy: 'never',
        intervalDays: 30
    },
    surveyConfig: {
        title: 'SmartExn Complete Member Profile & Earning Preferences Survey',
        description: 'Please complete this comprehensive 57-question feedback survey to help us tailor earning tasks, optimize withdrawal channels, and prioritize new features.',
        category: 'Member Intelligence & Experience',
        version: 1,
        estimatedTimeMinutes: 7,
        consentRequired: true,
        consentText: 'I confirm that I am participating voluntarily and will provide honest, accurate feedback to help improve the SmartExn platform.',
        approvalMode: 'auto',
        qualityRules: {
            minCompletionTimeSeconds: 50,
            flagFastCompletion: true,
            attentionCheckRequired: false,
            autoRejectOnFail: false
        },
        sections: [
            { id: 'sec_1_57', title: '1. Basic Profile and Demographics', description: 'General background and demographics.' },
            { id: 'sec_2_57', title: '2. Education and Professional Background', description: 'Education and employment context.' },
            { id: 'sec_3_57', title: '3. Digital Skills and Languages', description: 'Technical literacy and language proficiency.' },
            { id: 'sec_4_57', title: '4. Social Media and Online Platforms', description: 'Social media usage and platform preferences.' },
            { id: 'sec_5_57', title: '5. Online Earning Experience', description: 'Prior experience with online microtask and reward platforms.' },
            { id: 'sec_6_57', title: '6. Earning Interests and Task Preferences', description: 'Task types, schedule, and payout priorities.' },
            { id: 'sec_7_57', title: '7. Payment Methods and Provider Preferences', description: 'Current providers, withdrawal preferences, and deposit preferences.' },
            { id: 'sec_8_57', title: '8. SmartExn Usage and Experience', description: 'Discovery, login frequency, and platform rating.' },
            { id: 'sec_9_57', title: '9. Task Experience, Bugs and Technical Problems', description: 'Technical issue reports and task instruction clarity.' },
            { id: 'sec_10_57', title: '10. Trust, Recommendations and Future Preferences', description: 'Privacy trust, NPS, and feature suggestions.' },
            { id: 'sec_11_57', title: '11. Final Feedback and Suggestions', description: 'Beta testing interest and final comments.' }
        ],
        questions: [
            // Section 1: Basic Profile and Demographics (Q1 - Q5)
            {
                id: 'q1_57_welcome',
                sectionId: 'sec_1_57',
                type: 'single_choice',
                title: 'Welcome to the SmartExn Complete Member Profile & Earning Preferences Survey (57 Questions). We collect this feedback to personalize earning opportunities, improve payout flows, and build features that matter to you.',
                required: true,
                options: ['I understand and wish to proceed with the survey']
            },
            {
                id: 'q2_57_age',
                sectionId: 'sec_1_57',
                type: 'single_choice',
                title: 'What is your age group?',
                required: true,
                options: ['18–24 years', '25–34 years', '35–44 years', '45–54 years', '55 years or older', 'Prefer not to say']
            },
            {
                id: 'q3_57_gender',
                sectionId: 'sec_1_57',
                type: 'single_choice',
                title: 'What is your gender identity?',
                required: true,
                options: ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other']
            },
            {
                id: 'q4_57_country',
                sectionId: 'sec_1_57',
                type: 'short_text',
                title: 'Which country do you currently reside in?',
                required: true,
                validation: { minLength: 2, maxLength: 60 }
            },
            {
                id: 'q5_57_language',
                sectionId: 'sec_1_57',
                type: 'single_choice',
                title: 'What is your primary spoken language?',
                required: true,
                options: ['English', 'Spanish', 'French', 'Arabic', 'Hindi', 'Portuguese', 'Other']
            },

            // Section 2: Education and Professional Background (Q6 - Q10)
            {
                id: 'q6_57_education',
                sectionId: 'sec_2_57',
                type: 'single_choice',
                title: 'What is the highest level of education you have completed?',
                required: true,
                options: ['High School Diploma', "Bachelor's Degree", "Master's Degree", 'Doctorate / Ph.D.', 'Vocational / Technical Certification', 'Other', 'Prefer not to say']
            },
            {
                id: 'q7_57_employment',
                sectionId: 'sec_2_57',
                type: 'single_choice',
                title: 'Which of the following best describes your current employment status?',
                required: true,
                options: ['Full-time employee', 'Part-time employee', 'Freelancer', 'Self-employed / Business owner', 'Student', 'Currently unemployed', 'Homemaker', 'Retired', 'Prefer not to say'],
                profileMapping: { enabled: true, fieldKey: 'employmentStatus' }
            },
            {
                id: 'q8_57_industry',
                sectionId: 'sec_2_57',
                type: 'single_choice',
                title: 'What field or industry do you work or study in?',
                required: true,
                options: ['Technology / IT', 'Education', 'Finance / Accounting', 'Healthcare', 'Marketing / Sales', 'E-commerce', 'Freelancing', 'Content Creation', 'Engineering', 'Other', 'Prefer not to say'],
                profileMapping: { enabled: true, fieldKey: 'industry' }
            },
            {
                id: 'q9_57_experience',
                sectionId: 'sec_2_57',
                type: 'single_choice',
                title: 'How many years of professional or digital work experience do you have?',
                required: true,
                options: ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years']
            },
            {
                id: 'q10_57_income',
                sectionId: 'sec_2_57',
                type: 'single_choice',
                title: 'Which approximate monthly personal income range best describes your earnings?',
                required: false,
                options: ['I currently have no personal income', 'Under $100', '$100–$249', '$250–$499', '$500–$999', '$1,000–$2,499', '$2,500 or more', 'Prefer not to say']
            },

            // Section 3: Digital Skills and Languages (Q11 - Q15)
            {
                id: 'q11_57_literacy',
                sectionId: 'sec_3_57',
                type: 'single_choice',
                title: 'How would you rate your overall computer and internet literacy?',
                required: true,
                options: ['Beginner', 'Intermediate', 'Advanced', 'Expert']
            },
            {
                id: 'q12_57_tools',
                sectionId: 'sec_3_57',
                type: 'multiple_choice',
                title: 'Which programming, design, or technical tools are you familiar with?',
                required: true,
                options: ['HTML / CSS / JavaScript', 'Graphic Design (Canva / Photoshop)', 'Video Editing (Premiere / CapCut)', 'Data Entry (Excel / Google Sheets)', 'Writing / Copywriting', 'None']
            },
            {
                id: 'q13_57_english',
                sectionId: 'sec_3_57',
                type: 'yes_no',
                title: 'Can you communicate and work in English fluently?',
                required: true
            },
            {
                id: 'q14_57_other_langs',
                sectionId: 'sec_3_57',
                type: 'multiple_choice',
                title: 'What other languages are you proficient in for reading and writing?',
                required: false,
                options: ['Spanish', 'French', 'Arabic', 'Portuguese', 'Hindi', 'German', 'Mandarin', 'None']
            },
            {
                id: 'q15_57_screen_time',
                sectionId: 'sec_3_57',
                type: 'single_choice',
                title: 'How many hours per day do you spend actively using computers or smartphones?',
                required: true,
                options: ['Less than 2 hours', '2–4 hours', '4–6 hours', '6–8 hours', '8+ hours']
            },

            // Section 4: Social Media and Online Platforms (Q16 - Q22)
            {
                id: 'q16_57_social_active',
                sectionId: 'sec_4_57',
                type: 'yes_no',
                title: 'Do you actively use social media platforms?',
                required: true
            },
            {
                id: 'q17_57_platforms',
                sectionId: 'sec_4_57',
                type: 'multiple_choice',
                title: 'Which of the following social media platforms do you use regularly?',
                required: true,
                showIf: { questionId: 'q16_57_social_active', operator: 'equals', value: 'Yes' },
                options: [
                    'Facebook',
                    'YouTube',
                    'Instagram',
                    'TikTok',
                    'WhatsApp',
                    'X/Twitter',
                    'LinkedIn',
                    'Snapchat',
                    'Telegram',
                    'Reddit'
                ]
            },
            {
                id: 'q18_57_top_platform',
                sectionId: 'sec_4_57',
                type: 'single_choice',
                title: 'Which social media platform do you spend the most time on daily?',
                required: true,
                showIf: { questionId: 'q16_57_social_active', operator: 'equals', value: 'Yes' },
                options: ['Facebook', 'YouTube', 'Instagram', 'TikTok', 'WhatsApp', 'X/Twitter', 'LinkedIn', 'Snapchat', 'Telegram', 'Reddit', 'Other']
            },
            {
                id: 'q19_57_content_creator',
                sectionId: 'sec_4_57',
                type: 'yes_no',
                title: 'Do you manage or create content for any online channels or business pages?',
                required: true,
                showIf: { questionId: 'q16_57_social_active', operator: 'equals', value: 'Yes' }
            },
            {
                id: 'q20_57_followers',
                sectionId: 'sec_4_57',
                type: 'single_choice',
                title: 'How many total followers or subscribers do you have across your main social profiles?',
                required: true,
                showIf: { questionId: 'q16_57_social_active', operator: 'equals', value: 'Yes' },
                options: ['Under 500', '500 – 5,000', '5,000 – 50,000', '50,000+']
            },
            {
                id: 'q21_57_promo_social',
                sectionId: 'sec_4_57',
                type: 'yes_no',
                title: 'Have you ever used social media to promote products, affiliate links, or services?',
                required: true,
                showIf: { questionId: 'q16_57_social_active', operator: 'equals', value: 'Yes' }
            },
            {
                id: 'q22_57_social_purpose',
                sectionId: 'sec_4_57',
                type: 'single_choice',
                title: 'What is your primary purpose for using social media?',
                required: true,
                showIf: { questionId: 'q16_57_social_active', operator: 'equals', value: 'Yes' },
                options: ['Entertainment and connection', 'News and education', 'Business and professional networking', 'Online earning and side gigs', 'Content creation and branding']
            },

            // Section 5: Online Earning Experience (Q23 - Q28)
            {
                id: 'q23_57_prev_earning',
                sectionId: 'sec_5_57',
                type: 'yes_no',
                title: 'Have you previously earned money online through micro-tasks, surveys, or freelance gigs?',
                required: true
            },
            {
                id: 'q24_57_prev_platforms',
                sectionId: 'sec_5_57',
                type: 'multiple_choice',
                title: 'What types of online earning platforms have you used before?',
                required: true,
                showIf: { questionId: 'q23_57_prev_earning', operator: 'equals', value: 'Yes' },
                options: ['Micro-task websites', 'Paid survey panels', 'Offerwalls and gaming apps', 'Freelance platforms', 'PTC / Click sites']
            },
            {
                id: 'q25_57_prev_sat',
                sectionId: 'sec_5_57',
                type: 'rating',
                title: 'How satisfied were you with your previous online earning experiences overall?',
                required: true,
                minRating: 1,
                maxRating: 5,
                showIf: { questionId: 'q23_57_prev_earning', operator: 'equals', value: 'Yes' }
            },
            {
                id: 'q26_57_prev_frustration',
                sectionId: 'sec_5_57',
                type: 'single_choice',
                title: 'What was the biggest frustration or problem you faced on other earning platforms?',
                required: true,
                showIf: { questionId: 'q23_57_prev_earning', operator: 'equals', value: 'Yes' },
                options: ['Low payout rates', 'High minimum withdrawal thresholds', 'Delayed or rejected payouts', 'Account bans without explanation', 'Spammy or low-quality tasks', 'Too many ads']
            },
            {
                id: 'q27_57_annual_earnings',
                sectionId: 'sec_5_57',
                type: 'single_choice',
                title: 'Approximately how much total income have you generated from online side gigs in the past 12 months?',
                required: true,
                options: ['$0', 'Under $50', '$50–$200', '$200–$500', '$500–$1,000', '$1,000+']
            },
            {
                id: 'q28_57_earning_motivation',
                sectionId: 'sec_5_57',
                type: 'single_choice',
                title: 'What motivated you to start exploring online earning opportunities?',
                required: true,
                options: ['Supplement primary income', 'Financial freedom and flexibility', 'Paying for education or bills', 'Learning new digital skills', 'Curiosity and spare time']
            },

            // Section 6: Earning Interests and Task Preferences (Q29 - Q35)
            {
                id: 'q29_57_task_types',
                sectionId: 'sec_6_57',
                type: 'multiple_choice',
                title: 'Which types of online tasks do you enjoy completing the most?',
                required: true,
                options: ['Social media engagement (likes/follows/shares)', 'Website testing and reviews', 'Survey completion and market research', 'Content creation and video watching', 'Data entry and transcription', 'App installation and feedback']
            },
            {
                id: 'q30_57_daily_time',
                sectionId: 'sec_6_57',
                type: 'single_choice',
                title: 'How much time per day are you willing to dedicate to completing earning tasks on SmartExn?',
                required: true,
                options: ['Less than 30 minutes', '30–60 minutes', '1–2 hours', '2–4 hours', '4+ hours']
            },
            {
                id: 'q31_57_pref_schedule',
                sectionId: 'sec_6_57',
                type: 'single_choice',
                title: 'What is your preferred schedule for completing tasks?',
                required: true,
                options: ['Early morning', 'Afternoon / Daytime', 'Evening / Nighttime', 'Flexible throughout the day']
            },
            {
                id: 'q32_57_payout_speed_imp',
                sectionId: 'sec_6_57',
                type: 'rating',
                title: 'How important is task payout speed when deciding which tasks to complete?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q33_57_complex_tasks',
                sectionId: 'sec_6_57',
                type: 'yes_no',
                title: 'Would you be interested in higher-paying complex tasks that require verification or testing?',
                required: true
            },
            {
                id: 'q34_57_notifications',
                sectionId: 'sec_6_57',
                type: 'multiple_choice',
                title: 'How do you prefer to receive notifications about new high-value tasks?',
                required: true,
                options: ['Platform notifications', 'Email alerts', 'WhatsApp notifications', 'Telegram bot', 'Push notifications']
            },
            {
                id: 'q35_57_fair_pay',
                sectionId: 'sec_6_57',
                type: 'single_choice',
                title: 'What level of earnings per task do you consider fair for a 5-minute micro-task?',
                required: true,
                options: ['Under $0.10', '$0.10 – $0.25', '$0.25 – $0.50', '$0.50 – $1.00', '$1.00+']
            },

            // Section 7: Payment Methods and Provider Preferences (Q36 - Q43)
            {
                id: 'q36_57_current_providers',
                sectionId: 'sec_7_57',
                type: 'short_text',
                title: 'A. Which online payment providers does the user currently use? (Please enter up to three provider names)',
                required: true,
                validation: { minLength: 2, maxLength: 100 }
            },
            {
                id: 'q37_57_withdrawal_providers',
                sectionId: 'sec_7_57',
                type: 'short_text',
                title: 'B. Which payment providers would the user prefer for withdrawals from SmartExn? (Please enter up to three provider names)',
                required: true,
                validation: { minLength: 2, maxLength: 100 }
            },
            {
                id: 'q38_57_deposit_providers',
                sectionId: 'sec_7_57',
                type: 'short_text',
                title: 'C. Which payment providers would the user prefer for deposits, if they ever choose to deposit? (Please enter up to three provider names)',
                required: true,
                validation: { minLength: 2, maxLength: 100 }
            },
            {
                id: 'q39_57_currency',
                sectionId: 'sec_7_57',
                type: 'single_choice',
                title: 'What is your preferred currency for receiving earnings?',
                required: true,
                options: ['USD ($)', 'EUR (€)', 'USDT / Crypto', 'Local Currency', 'GBP (£)']
            },
            {
                id: 'q40_57_payout_issues',
                sectionId: 'sec_7_57',
                type: 'yes_no',
                title: 'Have you ever experienced delays or issues receiving payouts on online platforms?',
                required: true
            },
            {
                id: 'q41_57_payment_feature',
                sectionId: 'sec_7_57',
                type: 'single_choice',
                title: 'What payment method feature is most important to you?',
                required: true,
                options: ['Low withdrawal threshold', 'Instant or fast processing', 'Low transaction fees', 'High security and global acceptance', 'Cryptographic or digital wallet support']
            },
            {
                id: 'q42_57_payout_mode',
                sectionId: 'sec_7_57',
                type: 'single_choice',
                title: 'Do you prefer automated payouts or manual admin approval for withdrawals?',
                required: true,
                options: ['Automated instant payouts', 'Manual review within 24 hours', 'No preference']
            },
            {
                id: 'q43_57_payment_sat',
                sectionId: 'sec_7_57',
                type: 'rating',
                title: 'How satisfied are you with the payment options currently available in online gig platforms generally?',
                required: true,
                minRating: 1,
                maxRating: 5
            },

            // Section 8: SmartExn Usage and Experience (Q44 - Q47)
            {
                id: 'q44_57_discovery',
                sectionId: 'sec_8_57',
                type: 'single_choice',
                title: 'How did you first discover SmartExn?',
                required: true,
                options: ['Google Search', 'YouTube Video', 'Social Media (Facebook/TikTok/Instagram)', 'Friend Referral', 'Online Community / Forum', 'Advertisement', 'Direct URL']
            },
            {
                id: 'q45_57_tenure',
                sectionId: 'sec_8_57',
                type: 'single_choice',
                title: 'How long have you been registered as a member on SmartExn?',
                required: true,
                options: ['Less than a week', '1–4 weeks', '1–3 months', '3–6 months', '6+ months']
            },
            {
                id: 'q46_57_login_freq',
                sectionId: 'sec_8_57',
                type: 'single_choice',
                title: 'How frequently do you log in and check SmartExn?',
                required: true,
                options: ['Multiple times per day', 'Once a day', '2–3 times per week', 'Once a week or less', 'First time today']
            },
            {
                id: 'q47_57_ui_rating',
                sectionId: 'sec_8_57',
                type: 'rating',
                title: 'How would you rate the overall user interface and design of SmartExn?',
                required: true,
                minRating: 1,
                maxRating: 5
            },

            // Section 9: Task Experience, Bugs and Technical Problems (Q48 - Q51)
            {
                id: 'q48_57_bugs_encountered',
                sectionId: 'sec_9_57',
                type: 'yes_no',
                title: 'Have you encountered any technical bugs or errors while using SmartExn?',
                required: true
            },
            {
                id: 'q49_57_bug_types',
                sectionId: 'sec_9_57',
                type: 'multiple_choice',
                title: 'If you encountered bugs, what type of problem was it?',
                required: true,
                showIf: { questionId: 'q48_57_bugs_encountered', operator: 'equals', value: 'Yes' },
                options: ['Loading slow or lagging', 'Task submission error', 'Authentication / login issue', 'Payout withdrawal delay or error', 'Mobile display problem', 'None']
            },
            {
                id: 'q50_57_instructions_clarity',
                sectionId: 'sec_9_57',
                type: 'rating',
                title: 'How easy is it to understand instructions for completing tasks on SmartExn?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q51_57_rejection_issue',
                sectionId: 'sec_9_57',
                type: 'yes_no',
                title: 'Have you ever had a task submission rejected incorrectly?',
                required: true
            },

            // Section 10: Trust, Recommendations and Future Preferences (Q52 - Q54)
            {
                id: 'q52_57_trust',
                sectionId: 'sec_10_57',
                type: 'rating',
                title: 'How much do you trust SmartExn with your account data and privacy?',
                required: true,
                minRating: 1,
                maxRating: 5
            },
            {
                id: 'q53_57_nps',
                sectionId: 'sec_10_57',
                type: 'opinion_scale',
                title: 'How likely are you to recommend SmartExn to friends, family, or colleagues? (0 = Not at all likely, 10 = Extremely likely)',
                required: true,
                minRating: 0,
                maxRating: 10
            },
            {
                id: 'q54_57_feature_suggestion',
                sectionId: 'sec_10_57',
                type: 'long_text',
                title: 'What new feature or improvement would you like SmartExn to build next?',
                required: true
            },

            // Section 11: Final Feedback and Suggestions (Q55 - Q57)
            {
                id: 'q55_57_beta_interest',
                sectionId: 'sec_11_57',
                type: 'yes_no',
                title: 'Would you be interested in participating in beta testing for new SmartExn features?',
                required: true
            },
            {
                id: 'q56_57_best_thing',
                sectionId: 'sec_11_57',
                type: 'long_text',
                title: 'What is the single best thing about SmartExn in your opinion?',
                required: true
            },
            {
                id: 'q57_57_final_comments',
                sectionId: 'sec_11_57',
                type: 'long_text',
                title: 'Is there any final feedback, suggestion, or comment you would like to share with the team?',
                required: false
            }
        ]
    }
};
