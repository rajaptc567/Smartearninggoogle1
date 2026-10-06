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
