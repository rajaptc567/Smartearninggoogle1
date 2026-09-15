import React, { useState, useMemo } from 'react';
import {
    X,
    Search,
    BookOpen,
    HelpCircle,
    CheckCircle2,
    Layers,
    GitBranch,
    ShieldCheck,
    AlertTriangle,
    Sparkles,
    Eye,
    Play,
    Clock,
    Filter,
    CheckSquare,
    Hash,
    Star,
    Sliders,
    MessageSquare,
    ListFilter,
    ArrowRight
} from 'lucide-react';

export interface HelpTopic {
    id: string;
    title: string;
    category: 'Getting Started' | 'Question Types' | 'Configuration & Options' | 'Quality & Anti-Fraud' | 'Branch Logic & Flow' | 'Testing & Publishing';
    iconName?: string;
    whatItMeans: string;
    whenToUse: string;
    simpleExample: string;
    whatRespondentSees: string;
}

export const SURVEY_HELP_TOPICS: HelpTopic[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        category: 'Getting Started',
        whatItMeans: 'The core workflow for creating, configuring, and publishing high-integrity survey campaigns on SmartExn with customized questions, branching logic, quality verification checks, and fair worker reward allocation.',
        whenToUse: 'When setting up a new consumer research questionnaire, marketing survey, feedback form, or worker qualification screening.',
        simpleExample: 'Building a 5-question customer feedback study offering $0.50 reward with estimated duration of ~3 minutes.',
        whatRespondentSees: 'A clear task card on the Work & Earn hub displaying reward amount, estimated time badge, and consent disclaimer before launching into interactive questions.'
    },
    {
        id: 'single-choice',
        title: 'Single Choice',
        category: 'Question Types',
        whatItMeans: 'A standard multiple-choice question where the respondent is required to select exactly one option from a predefined list using radio buttons.',
        whenToUse: 'When options are mutually exclusive (e.g., primary employment status, gender, single age bracket, or primary device).',
        simpleExample: '"What is your primary smartphone operating system?" -> Options: [Android, iOS, Other].',
        whatRespondentSees: 'A vertical stack of clickable radio option cards that illuminate with an amber/gold border when selected.'
    },
    {
        id: 'multiple-choice',
        title: 'Multiple Choice',
        category: 'Question Types',
        whatItMeans: 'A checkbox question allowing respondents to select one, multiple, or all applicable choices that apply to them.',
        whenToUse: 'When respondents can possess multiple interests, use multiple products, or subscribe to multiple services.',
        simpleExample: '"Which streaming platforms do you use regularly?" -> Options: [Netflix, YouTube Premium, Prime Video, Disney+, Spotify].',
        whatRespondentSees: 'Interactive checkbox cards with multi-selection highlights, displaying validation error if minimum selections are not met.'
    },
    {
        id: 'top-n-ranking',
        title: 'Top-N / Ranking',
        category: 'Question Types',
        whatItMeans: 'A prioritized preference ranking question where respondents select and rank their top N favorites in order of priority (e.g., Top 3).',
        whenToUse: 'When you need to measure relative preference hierarchy, top feature priorities, or product rankings.',
        simpleExample: '"Select your Top 3 favorite social media apps in order of daily usage."',
        whatRespondentSees: 'Option items that display numbered priority badges (#1, #2, #3) as the respondent taps them in their preferred sequence.'
    },
    {
        id: 'yes-no',
        title: 'Yes / No',
        category: 'Question Types',
        whatItMeans: 'A high-contrast binary decision question providing large, immediate Yes and No selection buttons.',
        whenToUse: 'Fast screening, qualification gates, or simple direct confirmations.',
        simpleExample: '"Have you ever made a cryptocurrency trade in the last 12 months?" -> [Yes / No].',
        whatRespondentSees: 'Two prominent side-by-side action buttons labeled "Yes" and "No" that highlight boldly upon click.'
    },
    {
        id: 'dropdown',
        title: 'Dropdown',
        category: 'Question Types',
        whatItMeans: 'A compact select menu containing a long list of choices, saving vertical screen real estate.',
        whenToUse: 'Long lists of options such as countries of residence, states/provinces, industry sectors, or languages.',
        simpleExample: '"Select your country of residence." -> Dropdown with 100+ countries.',
        whatRespondentSees: 'A clean dropdown box that opens on tap to allow scrolling or searching for a single selection.'
    },
    {
        id: 'short-text',
        title: 'Short Text',
        category: 'Question Types',
        whatItMeans: 'A single-line text input field tailored for brief answers, names, codes, handles, or short keyword answers.',
        whenToUse: 'Collecting respondent username, email, favorite brand name, or brief keyword responses.',
        simpleExample: '"What is the name of your favorite shoe brand?"',
        whatRespondentSees: 'A clean single-line input field with placeholder text and character limits.'
    },
    {
        id: 'long-text',
        title: 'Long Text / Feedback',
        category: 'Question Types',
        whatItMeans: 'A multi-line text area allowing respondents to compose detailed open-ended qualitative feedback and explanations.',
        whenToUse: 'In-depth consumer sentiment, suggestions for product improvement, or detailed descriptions.',
        simpleExample: '"Please describe what you liked most about our user interface and what needs improvement."',
        whatRespondentSees: 'A spacious multi-line textarea with a live character count and min/max length indicators.'
    },
    {
        id: 'number',
        title: 'Number',
        category: 'Question Types',
        whatItMeans: 'A dedicated numeric input field that only accepts numeric digits, with optional min/max validation boundaries.',
        whenToUse: 'Collecting age, weekly hours, purchase amounts, household size, or years of experience.',
        simpleExample: '"How many hours per week do you spend playing mobile video games?" (Min: 0, Max: 168).',
        whatRespondentSees: 'A numeric keyboard/input field with min/max range indicators that prevents invalid letters and symbols.'
    },
    {
        id: 'rating-stars',
        title: 'Rating Stars',
        category: 'Question Types',
        whatItMeans: 'An interactive 1 to 5 (or custom max) star rating component for evaluating satisfaction or performance.',
        whenToUse: 'Measuring customer satisfaction, product rating, service speed, or overall experience.',
        simpleExample: '"How would you rate the responsiveness of our customer support team?" -> [1 to 5 Stars].',
        whatRespondentSees: '5 gold star icons that illuminate on hover/tap with live numeric display (e.g., 4 / 5 Stars).'
    },
    {
        id: 'opinion-scale',
        title: 'Opinion Scale 0–10 / NPS',
        category: 'Question Types',
        whatItMeans: 'A standardized 0 to 10 Net Promoter Score (NPS) scale with customizable left and right anchor labels.',
        whenToUse: 'Measuring customer loyalty, brand advocacy, or likelihood to recommend products/services.',
        simpleExample: '"How likely are you to recommend SmartExn to a friend or colleague?" -> [0 to 10 Scale].',
        whatRespondentSees: 'A sleek horizontal strip of 11 buttons (0 through 10) with "0 - Not at all likely" on left and "10 - Extremely likely" on right.'
    },
    {
        id: 'required-field',
        title: 'Required Field',
        category: 'Configuration & Options',
        whatItMeans: 'A setting that makes answering a question mandatory before the respondent can proceed or submit the survey.',
        whenToUse: 'On all essential research questions where missing data would invalidate the study results.',
        simpleExample: 'Toggling Required on demographic and key feedback questions.',
        whatRespondentSees: 'An amber asterisk (*) next to the question title and an alert badge if attempted to submit without answering.'
    },
    {
        id: 'other-option',
        title: '“Other” option',
        category: 'Configuration & Options',
        whatItMeans: 'Automatically adds an "Other" choice to choice/dropdown questions that opens an inline text box for custom answers.',
        whenToUse: 'When your list of options may not cover every conceivable respondent scenario or edge case.',
        simpleExample: '"Which crypto exchange do you use?" -> [Binance, Coinbase, Kraken, Other (please specify)].',
        whatRespondentSees: 'An "Other" choice item that smoothly unfolds a text box: "Please specify your details...".'
    },
    {
        id: 'sections',
        title: 'Sections',
        category: 'Configuration & Options',
        whatItMeans: 'Grouping related questions into distinct thematic modules or pages (e.g. Demographics, Product Usage, Satisfaction).',
        whenToUse: 'Longer surveys (6+ questions) to organize flow, provide clear pacing, and enable section-level jump logic.',
        simpleExample: 'Section 1: "Participant Background" followed by Section 2: "Deep Dive Experience".',
        whatRespondentSees: 'Distinct section header cards that group questions and give respondents a clear sense of progress.'
    },
    {
        id: 'verification-check',
        title: 'Verification / Check Question',
        category: 'Quality & Anti-Fraud',
        whatItMeans: 'An automated consistency question that re-asks or cross-checks an earlier answer to detect random guessing or dishonest answers.',
        whenToUse: 'In high-reward surveys or studies with 8+ questions to verify respondent authenticity and consistency.',
        simpleExample: 'Question 2 asks "What year were you born?" -> Question 8 verifies "Please re-confirm your birth year." If they differ, trigger flag or retry.',
        whatRespondentSees: 'Appears as a standard question; automated comparison runs in the background to verify consistency without giving away the test.'
    },
    {
        id: 'attention-trap',
        title: 'Attention Trap',
        category: 'Quality & Anti-Fraud',
        whatItMeans: 'A question with a strictly instructed specific answer designed to catch respondents who rush or use automated clickers without reading.',
        whenToUse: 'In surveys where bots, speed-clickers, or distracted respondents must be screened out automatically.',
        simpleExample: '"To demonstrate that you are reading questions carefully, please select \'Strongly Disagree\' below."',
        whatRespondentSees: 'A regular-looking question; selecting any option other than the expected answer triggers a quality flag or immediate screenout.'
    },
    {
        id: 'branch-logic',
        title: 'Branch Logic',
        category: 'Branch Logic & Flow',
        whatItMeans: 'Conditional IF / THEN rules that steer the respondent along different question paths based on their specific answers.',
        whenToUse: 'Showing relevant follow-up questions only to applicable audiences (e.g., asking drivers about car maintenance).',
        simpleExample: 'IF Question 1 ("Do you own a car?") Equals "Yes" THEN Jump to Question 3 ("What brand do you drive?").',
        whatRespondentSees: 'A dynamic, personalized survey experience where irrelevant questions are seamlessly skipped.'
    },
    {
        id: 'branch-value',
        title: 'Branch Value',
        category: 'Branch Logic & Flow',
        whatItMeans: 'The exact answer value or threshold that triggers a conditional branch rule.',
        whenToUse: 'Selecting which option (e.g., "Yes", "Android", rating >= 4) should execute the THEN action.',
        simpleExample: 'Setting Branch Value to "Daily" to route frequent users into an advanced feature feedback path.',
        whatRespondentSees: 'No visible code; their selected answer automatically routes them along the intended path.'
    },
    {
        id: 'jump-to-question',
        title: 'Jump to Question',
        category: 'Branch Logic & Flow',
        whatItMeans: 'A logic rule action that advances the respondent directly to a specified target question number.',
        whenToUse: 'Skipping multiple unneeded questions for a particular segment of participants.',
        simpleExample: 'If respondent selects "No subscription", jump straight from Q3 to Q8.',
        whatRespondentSees: 'The survey immediately presents the target question next.'
    },
    {
        id: 'jump-to-section',
        title: 'Jump to Section',
        category: 'Branch Logic & Flow',
        whatItMeans: 'A logic rule action that navigates the respondent directly to the start of another named section.',
        whenToUse: 'Multi-part surveys with specialized modules for different user cohorts (e.g. Creator vs Worker).',
        simpleExample: 'If respondent role is "Investor", jump directly to "Investment Module Section".',
        whatRespondentSees: 'The first question in the target section is displayed next.'
    },
    {
        id: 'skip-end-disqualify',
        title: 'Skip / End / Disqualify',
        category: 'Branch Logic & Flow',
        whatItMeans: 'Terminal and bypass logic actions: Skip Next Question, End Survey Early (successful completion), or Disqualify (screenout).',
        whenToUse: 'Screening out non-target demographics early without wasting their time or your campaign budget.',
        simpleExample: 'If age is under 18 on a 18+ study, execute "Disqualify Respondent".',
        whatRespondentSees: 'A polite screenout notification or a congratulations completion screen based on the chosen action.'
    },
    {
        id: 'flow-map',
        title: 'Flow Map',
        category: 'Branch Logic & Flow',
        whatItMeans: 'An interactive visual flowchart displaying all questions, branching forks, and end states in a graphical tree.',
        whenToUse: 'Auditing complex survey logic to verify all branching conditions connect to valid endpoints and spotting orphaned paths.',
        simpleExample: 'Switching to the "Flow Map" tab to visually trace the path taken by "Yes" and "No" respondents.',
        whatRespondentSees: 'Creator-only diagnostic map; ensures respondents experience a smooth, bug-free flow.'
    },
    {
        id: 'test-flow-simulator',
        title: 'Test Flow / Simulator',
        category: 'Testing & Publishing',
        whatItMeans: 'An interactive step-by-step debugger that lets you test-drive the survey with real answers and inspect triggered rules in real-time.',
        whenToUse: 'Before publishing to test every possible answer combination and confirm jumps and disqualifications fire properly.',
        simpleExample: 'Answering questions in the simulator and reviewing the live execution log for "Triggered Rule [goto_question]".',
        whatRespondentSees: 'Creator testing sandbox; simulates the exact respondent interface with detailed diagnostic logs.'
    },
    {
        id: 'preview',
        title: 'Preview',
        category: 'Testing & Publishing',
        whatItMeans: 'A pixel-perfect live simulation of how respondents will view and interact with the survey on desktop and mobile.',
        whenToUse: 'Reviewing layout, typography, contrast, spacing, and question appearance.',
        simpleExample: 'Switching to the "Preview" tab to verify button tap sizes and mobile responsive rendering.',
        whatRespondentSees: 'The exact dark-mode high-contrast participant interface with live answer counters.'
    },
    {
        id: 'templates',
        title: 'Templates',
        category: 'Getting Started',
        whatItMeans: 'Pre-configured, battle-tested survey presets (e.g., Customer Satisfaction CSAT, Market Research, App Feedback, Worker Onboarding).',
        whenToUse: 'When you want to build a survey in seconds without typing questions from scratch.',
        simpleExample: 'Clicking "Template" in the header toolbar and choosing "Customer Satisfaction (CSAT)".',
        whatRespondentSees: 'A professionally structured survey with validated question types and logical flow.'
    },
    {
        id: 'estimated-time',
        title: 'Estimated time',
        category: 'Testing & Publishing',
        whatItMeans: 'A dynamically calculated duration in minutes based on question types and count (or custom override) required for completion.',
        whenToUse: 'Setting realistic expectations for respondents and calibrating fair worker compensation rates.',
        simpleExample: 'A 6-question survey automatically estimates ~3 minutes duration.',
        whatRespondentSees: 'A clock badge displaying "~3 mins" on the survey card and consent header.'
    },
    {
        id: 'final-publish-checklist',
        title: 'Final publish checklist',
        category: 'Testing & Publishing',
        whatItMeans: 'A pre-launch validation audit that checks for missing question titles, duplicate options, invalid logic targets, or missing rewards.',
        whenToUse: 'Immediately before launching your campaign live to the SmartExn worker pool.',
        simpleExample: 'Checking the "Validation" tab to verify "0 Errors" and testing all pathways in the Simulator.',
        whatRespondentSees: 'A seamless, professional, and rewarding survey experience.'
    }
];

const CATEGORIES = [
    'All Topics',
    'Getting Started',
    'Question Types',
    'Configuration & Options',
    'Quality & Anti-Fraud',
    'Branch Logic & Flow',
    'Testing & Publishing'
];

interface SurveyHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SurveyHelpModal: React.FC<SurveyHelpModalProps> = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All Topics');
    const [selectedTopicId, setSelectedTopicId] = useState<string>(SURVEY_HELP_TOPICS[0].id);

    const filteredTopics = useMemo(() => {
        return SURVEY_HELP_TOPICS.filter(t => {
            const matchesCategory = selectedCategory === 'All Topics' || t.category === selectedCategory;
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query ||
                t.title.toLowerCase().includes(query) ||
                t.whatItMeans.toLowerCase().includes(query) ||
                t.whenToUse.toLowerCase().includes(query) ||
                t.simpleExample.toLowerCase().includes(query) ||
                t.whatRespondentSees.toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [searchQuery, selectedCategory]);

    const activeTopic = useMemo(() => {
        const found = SURVEY_HELP_TOPICS.find(t => t.id === selectedTopicId);
        if (found) return found;
        return filteredTopics[0] || SURVEY_HELP_TOPICS[0];
    }, [selectedTopicId, filteredTopics]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                How to Build a Survey?
                                <span className="text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                    SmartExn Guide & Reference
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400">
                                Comprehensive explanations, best practices, examples, and respondent experience previews
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                        title="Close Help"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filter & Search Bar */}
                <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search topics (e.g. Branch Logic, NPS, Verification, Number)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 shrink-0">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                                    selectedCategory === cat
                                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Body: Left Index + Right Detail */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                    {/* Left Topics List */}
                    <div className="md:col-span-4 border-r border-slate-800 overflow-y-auto custom-scrollbar p-3 space-y-1 bg-slate-950/40">
                        <div className="px-2 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Topics ({filteredTopics.length})
                        </div>
                        {filteredTopics.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500">
                                No topics match your search.
                            </div>
                        ) : (
                            filteredTopics.map((topic) => {
                                const isSelected = activeTopic?.id === topic.id;
                                return (
                                    <button
                                        key={topic.id}
                                        type="button"
                                        onClick={() => setSelectedTopicId(topic.id)}
                                        className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                                            isSelected
                                                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-sm'
                                                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 opacity-80" />
                                            <span className="truncate">{topic.title}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 shrink-0 font-normal">
                                            {topic.category.split(' ')[0]}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Right Topic Detail Card */}
                    <div className="md:col-span-8 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-5 bg-slate-900">
                        {activeTopic ? (
                            <>
                                <div className="space-y-1 border-b border-slate-800 pb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                            {activeTopic.category}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                            Topic: #{activeTopic.id}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-black text-white">
                                        {activeTopic.title}
                                    </h2>
                                </div>

                                {/* 4 Structured Sections */}
                                <div className="grid grid-cols-1 gap-4">
                                    {/* 1. What it Means */}
                                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                                            <BookOpen className="w-4 h-4" />
                                            <span>What it means</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                            {activeTopic.whatItMeans}
                                        </p>
                                    </div>

                                    {/* 2. When to Use */}
                                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                                            <CheckSquare className="w-4 h-4" />
                                            <span>When to use</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                            {activeTopic.whenToUse}
                                        </p>
                                    </div>

                                    {/* 3. Simple Example */}
                                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                                            <Sparkles className="w-4 h-4" />
                                            <span>Simple example</span>
                                        </div>
                                        <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300">
                                            {activeTopic.simpleExample}
                                        </div>
                                    </div>

                                    {/* 4. What Respondent Sees */}
                                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                                            <Eye className="w-4 h-4" />
                                            <span>What respondent sees</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                            {activeTopic.whatRespondentSees}
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                                Select a topic from the left list to view explanations.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-400">
                        Need quick setup? Use the <strong className="text-amber-400">Template</strong> button in the top toolbar.
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurveyHelpModal;
