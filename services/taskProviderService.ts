/**
 * SmartExn Task Provider Abstraction & Normalization Layer (Phase P12)
 * 
 * Manages task aggregation across:
 * 1. SmartExn Native Marketplace Campaigns
 * 2. External Provider Integrations (TimeWall, CPX Research, Lootably, BitLabs)
 * 
 * STRICT INTEGRATION & TRUTHFULNESS RULES:
 * - Never fabricates fake task counts, fake rewards, or fake completions.
 * - External providers without active production credentials display honest "Pending Configuration" states.
 * - Provider API secrets and keys must never be exposed to the browser.
 * - Zero modification to wallet balances, escrow calculations, or financial ledgers.
 */

export type TaskProviderId = 'smartexn_native' | 'timewall' | 'cpx_research' | 'lootably' | 'bitlabs' | 'partner_offer';

export type TaskCategoryType = 'social' | 'survey' | 'app_testing' | 'website_testing' | 'data_verification' | 'research' | 'general';

export interface NormalizedTask {
  id: string;
  provider: TaskProviderId;
  providerTaskRefId?: string;
  title: string;
  description: string;
  category: TaskCategoryType;
  rewardAmount: number;
  currency: string;
  estimatedTime?: string;
  requirements: string[];
  proofRequired: boolean;
  proofType?: 'screenshot' | 'text' | 'callback_postback' | 'url';
  externalUrl?: string;
  status: 'available' | 'eligible' | 'unavailable' | 'quota_full' | 'reserved' | 'submitted' | 'pending_review' | 'approved' | 'rejected' | 'expired' | 'provider_unavailable';
  quotaRemaining?: number;
  eligibility?: string;
  sourceLabel: string;
  providerMetadata?: Record<string, any>;
}

export interface TaskProviderConfig {
  providerId: TaskProviderId;
  displayName: string;
  description: string;
  category: 'micro_tasks' | 'surveys' | 'offerwall' | 'native';
  status: 'active' | 'pending_integration' | 'disabled';
  documentationUrl?: string;
  requiresPostback: boolean;
  statusMessage: string;
}

/**
 * Official registry of supported task provider adapters
 */
export const SUPPORTED_TASK_PROVIDERS: Record<TaskProviderId, TaskProviderConfig> = {
  smartexn_native: {
    providerId: 'smartexn_native',
    displayName: 'SmartExn Marketplace',
    description: 'Direct crowdsourced campaigns and micro-tasks funded by verified SmartExn advertisers.',
    category: 'native',
    status: 'active',
    requiresPostback: false,
    statusMessage: 'Active: Direct platform escrow & proof verification'
  },
  timewall: {
    providerId: 'timewall',
    displayName: 'TimeWall (Offerwall / Micro-Tasks)',
    description: 'External offerwall provider for micro-tasks, clicks, and partner surveys.',
    category: 'offerwall',
    status: 'pending_integration',
    requiresPostback: true,
    statusMessage: 'Provider integration in development (Awaiting official Publisher ID & Postback Endpoint)'
  },
  cpx_research: {
    providerId: 'cpx_research',
    displayName: 'CPX Research (Market Research Surveys)',
    description: 'Dynamic consumer surveys with demographic profiling and screenout compensation.',
    category: 'surveys',
    status: 'pending_integration',
    requiresPostback: true,
    statusMessage: 'Provider integration in development (Awaiting official App ID & Secure Callback configuration)'
  },
  lootably: {
    providerId: 'lootably',
    displayName: 'Lootably (Offers & App Installs)',
    description: 'Multi-platform offerwall with mobile game challenges and subscription trials.',
    category: 'offerwall',
    status: 'pending_integration',
    requiresPostback: true,
    statusMessage: 'Provider integration in roadmap (Awaiting partner API credentials)'
  },
  bitlabs: {
    providerId: 'bitlabs',
    displayName: 'BitLabs (Global Survey Router)',
    description: 'High-yield global survey inventory with in-app rewards.',
    category: 'surveys',
    status: 'pending_integration',
    requiresPostback: true,
    statusMessage: 'Provider integration in roadmap (Awaiting partner API credentials)'
  },
  partner_offer: {
    providerId: 'partner_offer',
    displayName: 'Partner Marketplace',
    description: 'Special verified affiliate and ecosystem opportunities.',
    category: 'micro_tasks',
    status: 'pending_integration',
    requiresPostback: false,
    statusMessage: 'Partner integration in preparation'
  }
};

/**
 * Normalization helper functions
 */
export const taskProviderService = {
  /**
   * Retrieves all provider statuses
   */
  getProviderStatuses(): TaskProviderConfig[] {
    return Object.values(SUPPORTED_TASK_PROVIDERS);
  },

  /**
   * Returns human-readable label for a task provider
   */
  getTaskSourceLabel(provider: TaskProviderId): string {
    return SUPPORTED_TASK_PROVIDERS[provider]?.displayName || 'Verified Opportunity';
  },

  /**
   * Returns styling classes for task source badges
   */
  getTaskSourceBadgeClass(provider: TaskProviderId): { badgeClass: string; icon: string } {
    switch (provider) {
      case 'smartexn_native':
        return {
          badgeClass: 'bg-sky-950 text-sky-400 border border-sky-800/60',
          icon: '💎 SmartExn Direct'
        };
      case 'cpx_research':
        return {
          badgeClass: 'bg-emerald-950 text-emerald-400 border border-emerald-800/60',
          icon: '📊 CPX Research'
        };
      case 'timewall':
        return {
          badgeClass: 'bg-purple-950 text-purple-400 border border-purple-800/60',
          icon: '⏱️ TimeWall Partner'
        };
      case 'lootably':
        return {
          badgeClass: 'bg-amber-950 text-amber-400 border border-amber-800/60',
          icon: '🎁 Lootably Offers'
        };
      case 'bitlabs':
        return {
          badgeClass: 'bg-blue-950 text-blue-400 border border-blue-800/60',
          icon: '📈 BitLabs Surveys'
        };
      default:
        return {
          badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
          icon: '🤝 Partner Opportunity'
        };
    }
  },

  /**
   * Normalizes raw native user tasks into standard format
   */
  normalizeNativeTask(task: any, currency = 'USD'): NormalizedTask {
    const rawCost = Number(task.costPerSubmission || task.reward || 0);
    const quotaLeft = Math.max(0, Number(task.maxSubmissions || 0) - Number(task.submissionsCount || 0));
    const isQuotaFull = Number(task.maxSubmissions || 0) > 0 && quotaLeft <= 0;
    
    return {
      id: String(task._id || task.id),
      provider: 'smartexn_native',
      title: task.title || 'Micro-Task Opportunity',
      description: task.description || task.instructions || 'Follow campaign requirements and upload valid verification proof.',
      category: (task.category || 'general').toLowerCase() as TaskCategoryType,
      rewardAmount: rawCost,
      currency: currency,
      estimatedTime: `${Number(task.estimatedMinutes || 5)} mins`,
      requirements: Array.isArray(task.steps)
        ? task.steps
        : typeof task.requirements === 'string'
        ? task.requirements.split('\n').filter(Boolean)
        : ['Follow task instructions carefully', 'Submit authentic screenshot proof'],
      proofRequired: true,
      proofType: 'screenshot',
      status: task.status !== 'Active' ? 'unavailable' : isQuotaFull ? 'quota_full' : 'available',
      quotaRemaining: quotaLeft,
      eligibility: 'All verified SmartExn members',
      sourceLabel: 'SmartExn Marketplace'
    };
  },

  /**
   * Normalizes external survey provider payloads into common model
   */
  normalizeProviderSurvey(survey: any, provider: TaskProviderId = 'cpx_research', currency = 'USD'): NormalizedTask {
    return {
      id: String(survey.id || survey.survey_id || `survey-${Date.now()}`),
      provider,
      providerTaskRefId: String(survey.survey_id || survey.id || ''),
      title: survey.title || `${SUPPORTED_TASK_PROVIDERS[provider]?.displayName || 'Survey'} Opportunity`,
      description: survey.description || 'Market research survey. Valid completion rewards credited automatically upon partner callback verification.',
      category: 'survey',
      rewardAmount: Number(survey.payout || survey.reward || 0),
      currency: currency,
      estimatedTime: `${Number(survey.length_of_interview || survey.duration || 10)} mins`,
      requirements: [
        'Complete all demographic and survey questions truthfully.',
        'Do not use VPNs or automated scripts.',
        'Reach the official completion thank-you screen.'
      ],
      proofRequired: false,
      proofType: 'callback_postback',
      externalUrl: survey.link || survey.url || '',
      status: SUPPORTED_TASK_PROVIDERS[provider]?.status === 'active' ? 'available' : 'provider_unavailable',
      eligibility: survey.demographic_target || 'Target demographic match',
      sourceLabel: SUPPORTED_TASK_PROVIDERS[provider]?.displayName || 'Survey Partner',
      providerMetadata: survey
    };
  },

  /**
   * Normalizes external offerwall provider payloads into common model
   */
  normalizeProviderOfferwall(offer: any, provider: TaskProviderId = 'timewall', currency = 'USD'): NormalizedTask {
    return {
      id: String(offer.id || offer.offer_id || `offer-${Date.now()}`),
      provider,
      providerTaskRefId: String(offer.offer_id || offer.id || ''),
      title: offer.title || offer.name || `${SUPPORTED_TASK_PROVIDERS[provider]?.displayName || 'Partner'} Task`,
      description: offer.description || 'Complete external partner assignment. Rewards credited to your Task Wallet after postback validation.',
      category: 'general',
      rewardAmount: Number(offer.reward || offer.payout || 0),
      currency: currency,
      estimatedTime: offer.time || 'Varies',
      requirements: Array.isArray(offer.instructions) ? offer.instructions : ['Follow partner offer terms and guidelines.'],
      proofRequired: Boolean(offer.requires_proof),
      proofType: offer.proof_type || 'callback_postback',
      externalUrl: offer.click_url || offer.url || '',
      status: SUPPORTED_TASK_PROVIDERS[provider]?.status === 'active' ? 'available' : 'provider_unavailable',
      eligibility: 'Subject to partner terms',
      sourceLabel: SUPPORTED_TASK_PROVIDERS[provider]?.displayName || 'Partner Offerwall',
      providerMetadata: offer
    };
  }
};
