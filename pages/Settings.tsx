
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { Settings as SettingsType, TransferFeeTier, Currency, currencySymbols, InvestmentPlan, formatCurrency, FaqItem, HomepagePaymentLogo } from '../types';
import { updateSettings } from '../services/api';
import { AdminModulePagesManager } from '../components/AdminModulePagesManager';
import { compressImageFile } from '../utils/imageCompressor';
import { 
    defaultPrivacyPolicyTitle, 
    defaultPrivacyPolicyUpdated, 
    defaultPrivacyPolicyContent,
    defaultRefundPolicyTitle,
    defaultRefundPolicyUpdated,
    defaultRefundPolicyContent,
    defaultTermsOfUseTitle,
    defaultTermsOfUseUpdated,
    defaultTermsOfUseContent,
    defaultCookiePolicyTitle,
    defaultCookiePolicyUpdated,
    defaultCookiePolicyContent,
    defaultContactUsTitle,
    defaultContactUsUpdated,
    defaultContactUsContent,
    defaultAboutUsTitle,
    defaultAboutUsUpdated,
    defaultAboutUsContent,
    defaultAntiFraudPolicyTitle,
    defaultAntiFraudPolicyUpdated,
    defaultAntiFraudPolicyContent,
    defaultWithdrawalPolicyTitle,
    defaultWithdrawalPolicyUpdated,
    defaultWithdrawalPolicyContent,
    defaultDisclaimerTitle,
    defaultDisclaimerUpdated,
    defaultDisclaimerContent,
    defaultDmcaPolicyTitle,
    defaultDmcaPolicyUpdated,
    defaultDmcaPolicyContent
} from '../data/legalDefaults';

// --- Icons ---
const StarIcon = ({ filled = false, className = "" }) => (
    <svg className={`w-4 h-4 ${filled ? 'text-yellow-500 fill-current' : 'text-gray-400'} ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
    </svg>
);

const Settings: React.FC = () => {
  const { state, dispatch } = useData();
  const { settings, investmentPlans, users = [], paymentMethods = [] } = state;

  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'module_pages' | 'transfers' | 'withdrawals' | 'commissions' | 'exchange_rates' | 'homepage' | 'faqs' | 'legal' | 'automation' | 'signup_form' | 'micro_task_hub'>('general');
  const [tierCurrencyFilter, setTierCurrencyFilter] = useState<Currency | ''>('');
  const [isDirty, setIsDirty] = useState(false);

  // Micro Task Hub Access Control States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'user' | 'admin' | 'finance' | 'support'>('all');

  // Rate Simulator State
  const [simAmount, setSimAmount] = useState<number>(100);
  const [simFrom, setSimFrom] = useState<Currency>('PKR');
  const [simTo, setSimTo] = useState<Currency>('EUR');

  // Fake fetching state for each UX
  const [isFetchingRates, setIsFetchingRates] = useState(false);

  // Logo Management State
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState(''); // Text input for URL
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string>('');
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);

  // Custom Fields Creator State
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'checkbox'>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Custom Work & Earn Subtabs State
  const [newEarnSubTabName, setNewEarnSubTabName] = useState('');
  const [newEarnSubTabProviderKey, setNewEarnSubTabProviderKey] = useState('');
  const [newEarnSubTabBadge, setNewEarnSubTabBadge] = useState('');
  const [newEarnSubTabDesc, setNewEarnSubTabDesc] = useState('');

  // Legal Policies admin state
  const [adminLegalTarget, setAdminLegalTarget] = useState<'global' | 'hub'>('global');
  const [adminLegalSubTab, setAdminLegalSubTab] = useState<string>('privacy');

  useEffect(() => {
    // Merge provided settings with defaults, ensuring nested objects like exchangeRates are fully populated.
    const defaultRates = { USD: 1, EUR: 0.92, PKR: 278.00 };
    const incomingRates = settings.exchangeRates || {};

    const mergedRates = {
        USD: incomingRates.USD || defaultRates.USD,
        EUR: incomingRates.EUR || defaultRates.EUR,
        PKR: incomingRates.PKR || defaultRates.PKR
    };

    setLocalSettings(prev => ({
        ...settings,
        transferConfig: settings.transferConfig || { enabled: settings.isUserTransferEnabled, tiers: [] },
        exchangeRates: mergedRates,
        homepageVideoUrl: settings.homepageVideoUrl || '',
        homepageContent: {
            // Content
            heroTitle: '', heroSubtitle: '', feature1Title: '', feature1Desc: '', 
            feature2Title: '', feature2Desc: '', feature3Title: '', feature3Desc: '', 
            videoTitle: '', videoDesc: '', multiCurrencyTitle: '', multiCurrencyDesc: '', 
            mlmTitle: '', mlmDesc: '', ctaTitle: '', ctaDesc: '',
            paymentMethodsTitle: 'Supported Payment Partners',
            paymentMethodsDesc: 'We support a variety of secure payment gateways.',
            paymentMethodsDisplayType: 'static',
            paymentMethodsColorStyle: 'color',
            // Visibility Defaults (will be overwritten by incoming settings if present)
            showHero: true,
            showFeatures: true,
            showMultiCurrency: true,
            showInvestmentPlans: true,
            showMLM: true,
            showPaymentMethods: true,
            showVideoSection: true,
            showFAQ: true,
            showCTA: true,
            ...settings.homepageContent // Overwrite with actual DB values
        },
        homepagePaymentLogos: settings.homepagePaymentLogos || [],
        featuredPlanIds: settings.featuredPlanIds || [],
        faqs: settings.faqs || [],
        whatsappNumber: settings.whatsappNumber || '',
        whatsappFloatingEnabled: settings.whatsappFloatingEnabled !== false,
        whatsappDepositProofEnabled: settings.whatsappDepositProofEnabled !== false,
        seoTitle: settings.seoTitle || '',
        seoDescription: settings.seoDescription || '',
        seoKeywords: settings.seoKeywords || '',
        privacyPolicyTitle: settings.privacyPolicyTitle || defaultPrivacyPolicyTitle,
        privacyPolicyUpdated: settings.privacyPolicyUpdated || defaultPrivacyPolicyUpdated,
        privacyPolicyContent: settings.privacyPolicyContent || defaultPrivacyPolicyContent,
        refundPolicyTitle: settings.refundPolicyTitle || defaultRefundPolicyTitle,
        refundPolicyUpdated: settings.refundPolicyUpdated || defaultRefundPolicyUpdated,
        refundPolicyContent: settings.refundPolicyContent || defaultRefundPolicyContent,
        termsOfUseTitle: settings.termsOfUseTitle || defaultTermsOfUseTitle,
        termsOfUseUpdated: settings.termsOfUseUpdated || defaultTermsOfUseUpdated,
        termsOfUseContent: settings.termsOfUseContent || defaultTermsOfUseContent,
        cookiePolicyTitle: settings.cookiePolicyTitle || defaultCookiePolicyTitle,
        cookiePolicyUpdated: settings.cookiePolicyUpdated || defaultCookiePolicyUpdated,
        cookiePolicyContent: settings.cookiePolicyContent || defaultCookiePolicyContent,
        contactUsTitle: settings.contactUsTitle || defaultContactUsTitle,
        contactUsUpdated: settings.contactUsUpdated || defaultContactUsUpdated,
        contactUsContent: settings.contactUsContent || defaultContactUsContent,
        enableContactUsBox: settings.enableContactUsBox !== false,
        enableContactViaEmail: settings.enableContactViaEmail !== false,
        enableContactViaWhatsApp: settings.enableContactViaWhatsApp !== false,
        contactUsEmailAddress: settings.contactUsEmailAddress || 'smartexn.com@gmail.com',
        contactUsWhatsAppNumber: settings.contactUsWhatsAppNumber || '+447846775662',
        contactUsBoxTitle: settings.contactUsBoxTitle || 'International Member Support & Contact Desk',
        contactUsBoxSubtitle: settings.contactUsBoxSubtitle || 'Have questions regarding your withdrawal, payout settlement, or account verification?',
        showUkSupportOffice: settings.showUkSupportOffice !== false,
        showUkSupportOfficeInFooter: settings.showUkSupportOfficeInFooter !== false,
        supportOfficeBadge1: settings.supportOfficeBadge1 || 'Official Registered Support Desk',
        supportOfficeBadge2: settings.supportOfficeBadge2 || 'UK Registered Office',
        supportOfficeTitle: settings.supportOfficeTitle || 'Customer Support Office (UK)',
        supportOfficeSubtitle: settings.supportOfficeSubtitle || 'Have questions or need assistance before creating an account? Our dedicated UK headquarters desk provides direct support for workers, campaign creators, and international partners.',
        supportOfficeAddress: settings.supportOfficeAddress || '71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom',
        supportOfficePhone: settings.supportOfficePhone || '+447846775662',
        supportOfficeEmail: settings.supportOfficeEmail || 'smartexn.com@gmail.com',
        supportOfficeHours: settings.supportOfficeHours || '15 – 60 Minutes',
        aboutUsTitle: settings.aboutUsTitle || defaultAboutUsTitle,
        aboutUsUpdated: settings.aboutUsUpdated || defaultAboutUsUpdated,
        aboutUsContent: settings.aboutUsContent || defaultAboutUsContent,
        antiFraudPolicyTitle: settings.antiFraudPolicyTitle || defaultAntiFraudPolicyTitle,
        antiFraudPolicyUpdated: settings.antiFraudPolicyUpdated || defaultAntiFraudPolicyUpdated,
        antiFraudPolicyContent: settings.antiFraudPolicyContent || defaultAntiFraudPolicyContent,
        withdrawalPolicyTitle: settings.withdrawalPolicyTitle || defaultWithdrawalPolicyTitle,
        withdrawalPolicyUpdated: settings.withdrawalPolicyUpdated || defaultWithdrawalPolicyUpdated,
        withdrawalPolicyContent: settings.withdrawalPolicyContent || defaultWithdrawalPolicyContent,
        disclaimerTitle: settings.disclaimerTitle || defaultDisclaimerTitle,
        disclaimerUpdated: settings.disclaimerUpdated || defaultDisclaimerUpdated,
        disclaimerContent: settings.disclaimerContent || defaultDisclaimerContent,
        dmcaPolicyTitle: settings.dmcaPolicyTitle || defaultDmcaPolicyTitle,
        dmcaPolicyUpdated: settings.dmcaPolicyUpdated || defaultDmcaPolicyUpdated,
        dmcaPolicyContent: settings.dmcaPolicyContent || defaultDmcaPolicyContent,
        emailAutomationEnabled: settings.emailAutomationEnabled || false,
        emailSenderAddress: settings.emailSenderAddress || 'smartexn.com@gmail.com',
        emailSenderPassword: settings.emailSenderPassword || '',
        whatsappAutomationEnabled: settings.whatsappAutomationEnabled || false,
        whatsappInstanceId: settings.whatsappInstanceId || 'instance183081',
        whatsappToken: settings.whatsappToken || '',
        signUpConfig: {
            customTitle: settings.signUpConfig?.customTitle || 'Create your Account',
            fullNameRule: settings.signUpConfig?.fullNameRule || 'required',
            usernameRule: settings.signUpConfig?.usernameRule || 'required',
            phoneRule: settings.signUpConfig?.phoneRule || 'required',
            whatsappRule: settings.signUpConfig?.whatsappRule || 'required',
            countryRule: settings.signUpConfig?.countryRule || 'required',
            sponsorRule: settings.signUpConfig?.sponsorRule || 'optional',
            addressRule: settings.signUpConfig?.addressRule || 'hidden',
            cityRule: settings.signUpConfig?.cityRule || 'hidden',
            postalCodeRule: settings.signUpConfig?.postalCodeRule || 'hidden',
            telegramRule: settings.signUpConfig?.telegramRule || 'hidden',
            genderRule: settings.signUpConfig?.genderRule || 'hidden',
            dateOfBirthRule: settings.signUpConfig?.dateOfBirthRule || 'hidden',
            requireCountryCodeInPhone: settings.signUpConfig?.requireCountryCodeInPhone || false,
            requireCountryCodeInWhatsapp: settings.signUpConfig?.requireCountryCodeInWhatsapp || false,
            customFields: settings.signUpConfig?.customFields || []
        },
        userDashboardVersion: settings.userDashboardVersion || 'compact',
        landingPageStyle: settings.landingPageStyle || 'smartexn',
        defaultUserDashboardModule: settings.defaultUserDashboardModule || 'work_and_earn',
        hubEnabled: settings.hubEnabled !== false,
        hubMinDeposit: settings.hubMinDeposit ?? 5,
        hubMaxDeposit: settings.hubMaxDeposit ?? 1000,
        hubMinWithdrawal: settings.hubMinWithdrawal ?? 1,
        hubMaxWithdrawal: settings.hubMaxWithdrawal ?? 1000,
        hubAccessMode: settings.hubAccessMode || 'all',
        hubAllowedUserIds: settings.hubAllowedUserIds || [],
        hubAllowedPlanIds: settings.hubAllowedPlanIds || [],
        hubDepositMethods: settings.hubDepositMethods || [],
        hubFaqs: settings.hubFaqs || [],
        hubPrivacyPolicyTitle: settings.hubPrivacyPolicyTitle || 'Hub Privacy Policy',
        hubPrivacyPolicyUpdated: settings.hubPrivacyPolicyUpdated || 'Last updated: July 21, 2026',
        hubPrivacyPolicyContent: settings.hubPrivacyPolicyContent || "We respect your digital privacy. When you use the Micro Task Hub, we collect standard log data, your completed task proofs, and transaction logs. This information is strictly used to evaluate submission proofs and process withdrawals safely.",
        hubTermsOfUseTitle: settings.hubTermsOfUseTitle || 'Hub Terms of Service',
        hubTermsOfUseUpdated: settings.hubTermsOfUseUpdated || 'Last updated: July 21, 2026',
        hubTermsOfUseContent: settings.hubTermsOfUseContent || "By participating in the Micro Task & Gigs Hub, you agree to: (1) Provide only authentic and unaltered proofs of completed tasks; (2) Refrain from using VPNs, proxies, bot networks, or automated scrapers; (3) Abide by the minimum and maximum deposit/withdrawal thresholds.",
        hubRefundPolicyTitle: settings.hubRefundPolicyTitle || 'Hub Refund Policy',
        hubRefundPolicyUpdated: settings.hubRefundPolicyUpdated || 'Last updated: July 21, 2026',
        hubRefundPolicyContent: settings.hubRefundPolicyContent || "All approved payouts and withdrawals processed through the Micro Task Hub are final and irreversible. If a micro task campaign you launched has uncompleted slots, you can request a refund of the remaining budget to your main wallet.",
        hubCookiePolicyTitle: settings.hubCookiePolicyTitle || 'Hub Cookie Policy',
        hubCookiePolicyUpdated: settings.hubCookiePolicyUpdated || 'Last updated: July 21, 2026',
        hubCookiePolicyContent: settings.hubCookiePolicyContent || "We use essential cookies and local storage tokens to keep you securely authenticated in the Micro Task Hub, remember your dashboard view preferences, and protect our forms.",
        hubContactUsTitle: settings.hubContactUsTitle || 'Hub Contact Us',
        hubContactUsUpdated: settings.hubContactUsUpdated || 'Last updated: July 21, 2026',
        hubContactUsContent: settings.hubContactUsContent || "If you have questions, disputes, or issues regarding task completion or withdrawal processing inside the Hub, you can contact us directly by opening a support ticket.",
        hubAboutUsTitle: settings.hubAboutUsTitle || 'Hub About Us',
        hubAboutUsUpdated: settings.hubAboutUsUpdated || 'Last updated: July 21, 2026',
        hubAboutUsContent: settings.hubAboutUsContent || "The Work & Earn Micro Task Hub is a specialized division designed to bridge independent digital gig workers with platform campaigns. We facilitate frictionless nano-campaign verification.",
        hubAntiFraudPolicyTitle: settings.hubAntiFraudPolicyTitle || 'Hub Anti-Fraud Policy',
        hubAntiFraudPolicyUpdated: settings.hubAntiFraudPolicyUpdated || 'Last updated: July 21, 2026',
        hubAntiFraudPolicyContent: settings.hubAntiFraudPolicyContent || "We enforce a zero-tolerance policy against fraudulent activities. This includes submitting fabricated screenshots, multiple accounts registration, mock API completions, or bot scripts.",
        hubWithdrawalPolicyTitle: settings.hubWithdrawalPolicyTitle || 'Hub Withdrawal Policy',
        hubWithdrawalPolicyUpdated: settings.hubWithdrawalPolicyUpdated || 'Last updated: July 21, 2026',
        hubWithdrawalPolicyContent: settings.hubWithdrawalPolicyContent || "Withdrawals from the Micro Task Hub are processed directly to your approved payout methods. All payout requests must respect the minimum and maximum limit guidelines.",
        hubDisclaimerTitle: settings.hubDisclaimerTitle || 'Hub Disclaimer',
        hubDisclaimerUpdated: settings.hubDisclaimerUpdated || 'Last updated: July 21, 2026',
        hubDisclaimerContent: settings.hubDisclaimerContent || "The Micro Task Hub does not guarantee a minimum hourly wage or continuous task availability. Earnings fluctuate based on active advertiser budgets and proof validation.",
        hubDmcaPolicyTitle: settings.hubDmcaPolicyTitle || 'Hub DMCA & Copyright Policy',
        hubDmcaPolicyUpdated: settings.hubDmcaPolicyUpdated || 'Last updated: July 21, 2026',
        hubDmcaPolicyContent: settings.hubDmcaPolicyContent || "We respect the intellectual property of creators. If you find any tasks, campaigns, social profiles, or images hosted in our hub that infringe upon your copyrighted material, please send a DMCA notice.",
    }));
    setIsDirty(false);
  }, [settings]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('homepageContent.smartexnContent.')) {
        const field = name.split('.')[2];
        setLocalSettings(prev => ({
            ...prev,
            homepageContent: {
                ...prev.homepageContent,
                smartexnContent: {
                    ...(prev.homepageContent?.smartexnContent || {}),
                    [field]: value
                }
            } as any
        }));
    } else if (name.startsWith('homepageContent.')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({ ...prev, homepageContent: { ...prev.homepageContent, [field]: value } as any}));
    } else {
        setLocalSettings(prev => ({...prev, [name]: value }));
    }
    setIsDirty(true);
  }

  const handleSmartexnImageUpload = (field: 'dashboardPreviewImage' | 'mobilePreviewImage', file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setLocalSettings(prev => ({
        ...prev,
        homepageContent: {
          ...prev.homepageContent,
          smartexnContent: {
            ...(prev.homepageContent?.smartexnContent || {}),
            [field]: base64
          }
        } as any
      }));
      setIsDirty(true);
    };
    reader.readAsDataURL(file);
  };
  
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      if (name.startsWith('homepageContent.')) {
          const field = name.split('.')[1];
          setLocalSettings(prev => ({ ...prev, homepageContent: { ...prev.homepageContent, [field]: value } as any}));
      } else {
          setLocalSettings(prev => ({...prev, [name]: value }));
      }
      setIsDirty(true);
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name.startsWith('withdrawalFrequency.')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({
            ...prev,
            withdrawalFrequency: { ...prev.withdrawalFrequency, [field]: checked }
        }));
    } else if (name === 'transferConfig.enabled' || name === 'isUserTransferEnabled') {
        setLocalSettings(prev => ({
            ...prev,
            transferConfig: {
                ...(prev.transferConfig || { tiers: [] }),
                enabled: checked
            },
            isUserTransferEnabled: checked // Sync legacy field
        }));
    } else if (name === 'transferConfig.allowCrossCurrency') {
        setLocalSettings(prev => ({
            ...prev,
            transferConfig: {
                ...(prev.transferConfig || { tiers: [] }),
                allowCrossCurrency: checked
            }
        }));
    } else if (name.startsWith('transferConfig.')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({
            ...prev,
            transferConfig: {
                ...(prev.transferConfig || { tiers: [] }),
                [field]: checked
            }
        }));
    } else if (name === 'showUkSupportOffice' || name === 'homepageContent.showUkSupportOffice') {
        setLocalSettings(prev => ({ 
            ...prev, 
            showUkSupportOffice: checked,
            homepageContent: { ...prev.homepageContent, showUkSupportOffice: checked } as any 
        }));
    } else if (name === 'showUkSupportOfficeInFooter' || name === 'homepageContent.showUkSupportOfficeInFooter') {
        setLocalSettings(prev => ({ 
            ...prev, 
            showUkSupportOfficeInFooter: checked,
            homepageContent: { ...prev.homepageContent, showUkSupportOfficeInFooter: checked } as any 
        }));
    } else if (name.startsWith('homepageContent.show')) {
        const field = name.split('.')[1];
        setLocalSettings(prev => ({ 
            ...prev, 
            homepageContent: { ...prev.homepageContent, [field]: checked } as any 
        }));
    } else if (name.includes('.')) {
        const parts = name.split('.');
        if (parts.length === 2) {
            const [parent, child] = parts;
            setLocalSettings(prev => ({
                ...prev,
                [parent]: {
                    ...((prev as any)[parent] || {}),
                    [child]: checked
                }
            }));
        }
    } else {
        setLocalSettings(prev => ({ ...prev, [name]: checked }));
    }
    setIsDirty(true);
  };
  
  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      const field = name.split('.')[1];
      setLocalSettings(prev => ({
          ...prev,
          withdrawalFrequency: { 
              ...prev.withdrawalFrequency, 
              [field]: field === 'value' ? parseFloat(value) : value 
          }
      }));
      setIsDirty(true);
  }

    const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const currency = name.split('.')[1] as keyof SettingsType['exchangeRates'];
        setLocalSettings(prev => ({
            ...prev,
            exchangeRates: {
                ...prev.exchangeRates,
                [currency]: parseFloat(value) || 0
            }
        }));
        setIsDirty(true);
    };

    const handleFeaturedPlanChange = (planId: string) => {
        const currentIds = localSettings.featuredPlanIds || [];
        let newIds;
        if (currentIds.includes(planId)) {
            newIds = currentIds.filter(id => id !== planId);
        } else {
            newIds = [...currentIds, planId];
        }
        setLocalSettings(prev => ({ ...prev, featuredPlanIds: newIds }));
        setIsDirty(true);
    };

    // --- Logo Management Handlers ---
    const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewLogoFile(file);
            setNewLogoUrl('');
            setIsProcessingLogo(true);
            try {
                const compressed = await compressImageFile(file, { maxWidth: 320, maxHeight: 160, quality: 0.9 });
                setPreviewLogoUrl(compressed);
            } catch (err) {
                console.error("Image compression error:", err);
                const reader = new FileReader();
                reader.onload = (ev) => setPreviewLogoUrl(ev.target?.result as string);
                reader.readAsDataURL(file);
            } finally {
                setIsProcessingLogo(false);
            }
        }
    };

    const handleAddLogo = async () => {
        if (!newLogoName.trim()) return alert("Please enter a name for the payment method.");
        
        let logoData = newLogoUrl.trim();

        if (newLogoFile) {
            setIsProcessingLogo(true);
            try {
                logoData = previewLogoUrl || await compressImageFile(newLogoFile, { maxWidth: 320, maxHeight: 160, quality: 0.9 });
            } catch {
                logoData = previewLogoUrl;
            } finally {
                setIsProcessingLogo(false);
            }
        }

        if (!logoData) return alert("Please provide an image URL or upload a file / screenshot.");

        setLocalSettings(prev => ({
            ...prev,
            homepagePaymentLogos: [...(prev.homepagePaymentLogos || []), { name: newLogoName.trim(), logoUrl: logoData }]
        }));
        
        // Reset inputs
        setNewLogoName('');
        setNewLogoUrl('');
        setNewLogoFile(null);
        setPreviewLogoUrl('');
        setIsDirty(true);
    };

    const handleRemoveLogo = (index: number) => {
        const newLogos = [...(localSettings.homepagePaymentLogos || [])];
        newLogos.splice(index, 1);
        setLocalSettings(prev => ({ ...prev, homepagePaymentLogos: newLogos }));
        setIsDirty(true);
    };

    const handleQuickAddPreset = (name: string, fallbackUrl: string) => {
        setNewLogoName(name);
        setNewLogoUrl(fallbackUrl);
        setNewLogoFile(null);
        setPreviewLogoUrl(fallbackUrl);
    };

    // --- FAQ Handlers ---
    const handleFaqChange = (index: number, field: keyof FaqItem, value: any) => {
        setLocalSettings(prev => {
            const updatedFaqs = [...(prev.faqs || [])];
            updatedFaqs[index] = { ...updatedFaqs[index], [field]: value };
            return { ...prev, faqs: updatedFaqs };
        });
        setIsDirty(true);
    };

    const handleAddFaq = () => {
        const newFaqs = [...(localSettings.faqs || []), { question: 'New Question', answer: 'Answer here...', showOnHomepage: false }];
        setLocalSettings(prev => ({ ...prev, faqs: newFaqs }));
        setIsDirty(true);
    };

    const handleRemoveFaq = (index: number) => {
        const newFaqs = (localSettings.faqs || []).filter((_, i) => i !== index);
        setLocalSettings(prev => ({ ...prev, faqs: newFaqs }));
        setIsDirty(true);
    };

    // --- Hub FAQ Handlers ---
    const handleHubFaqChange = (index: number, field: keyof FaqItem, value: any) => {
        setLocalSettings(prev => {
            const updatedFaqs = [...(prev.hubFaqs || [])];
            updatedFaqs[index] = { ...updatedFaqs[index], [field]: value };
            return { ...prev, hubFaqs: updatedFaqs };
        });
        setIsDirty(true);
    };

    const handleAddHubFaq = () => {
        const newFaqs = [...(localSettings.hubFaqs || []), { question: 'New Question', answer: 'Answer here...', showOnHomepage: false }];
        setLocalSettings(prev => ({ ...prev, hubFaqs: newFaqs }));
        setIsDirty(true);
    };

    const handleRemoveHubFaq = (index: number) => {
        const newFaqs = (localSettings.hubFaqs || []).filter((_, i) => i !== index);
        setLocalSettings(prev => ({ ...prev, hubFaqs: newFaqs }));
        setIsDirty(true);
    };

    const handleFetchLiveRates = () => {
        setIsFetchingRates(true);
        // Simulate API call to Forex service
        setTimeout(() => {
            setLocalSettings(prev => ({
                ...prev,
                exchangeRates: {
                    USD: 1,
                    PKR: 278.50,
                    EUR: 0.92
                }
            }));
            setIsFetchingRates(false);
            setIsDirty(true);
            alert("Live rates fetched successfully (Simulated)");
        }, 1000);
    };

  // --- Transfer Tier Handlers ---
  const handleAddTier = () => {
      if (!tierCurrencyFilter) return; // Should not happen if button is disabled
      setLocalSettings(prev => ({
          ...prev,
          transferConfig: {
              ...prev.transferConfig,
              tiers: [...prev.transferConfig.tiers, { minAmount: 0, maxAmount: 0, feeType: 'fixed', feeValue: 0, currency: tierCurrencyFilter, enabled: true }]
          }
      }));
      setIsDirty(true);
  };

  const handleRemoveTier = (index: number) => {
      setLocalSettings(prev => ({
          ...prev,
          transferConfig: {
              ...prev.transferConfig,
              tiers: prev.transferConfig.tiers.filter((_, i) => i !== index)
          }
      }));
      setIsDirty(true);
  };

  const handleTierChange = (index: number, field: keyof TransferFeeTier, value: string | boolean) => {
      setLocalSettings(prev => {
          const newTiers = [...prev.transferConfig.tiers];
          const updatedTier = { ...newTiers[index] };

          if (field === 'enabled') {
              updatedTier.enabled = value as boolean;
          } else if (field === 'feeType') {
              updatedTier.feeType = value as 'percentage' | 'fixed';
          } else if (field === 'minAmount' || field === 'maxAmount' || field === 'feeValue') {
              (updatedTier as any)[field] = parseFloat(value as string) || 0;
          }

          newTiers[index] = updatedTier;
          
          return {
              ...prev,
              transferConfig: { ...prev.transferConfig, tiers: newTiers }
          };
      });
      setIsDirty(true);
  };
  
  const handleSignUpConfigChange = (field: string, value: string | boolean) => {
      setLocalSettings(prev => ({
          ...prev,
          signUpConfig: {
              ...(prev.signUpConfig || {}),
              [field]: value
          }
      }));
      setIsDirty(true);
  };

  const handleAddCustomField = () => {
      if (!newFieldLabel.trim()) return;
      const newField = {
          id: 'field_' + Math.random().toString(36).substr(2, 9),
          label: newFieldLabel.trim(),
          type: newFieldType,
          required: newFieldRequired,
          options: newFieldType === 'select' ? newFieldOptions : ''
      };
      
      setLocalSettings(prev => {
          const currentConfig = prev.signUpConfig || {};
          const currentFields = currentConfig.customFields || [];
          return {
              ...prev,
              signUpConfig: {
                  ...currentConfig,
                  customFields: [...currentFields, newField]
              }
          };
      });
      
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldRequired(false);
      setNewFieldOptions('');
      setIsDirty(true);
  };

  const handleRemoveCustomField = (id: string) => {
      setLocalSettings(prev => {
          const currentConfig = prev.signUpConfig || {};
          const currentFields = currentConfig.customFields || [];
          return {
              ...prev,
              signUpConfig: {
                  ...currentConfig,
                  customFields: currentFields.filter(f => f.id !== id)
              }
          };
      });
      setIsDirty(true);
  };

  const handleAddEarnSubTab = () => {
      if (!newEarnSubTabName.trim()) return;
      const newSub = {
          id: 'sub_' + Math.random().toString(36).substr(2, 7),
          name: newEarnSubTabName.trim(),
          providerKey: newEarnSubTabProviderKey.trim() || newEarnSubTabName.trim().toLowerCase(),
          badge: newEarnSubTabBadge.trim() || 'New',
          description: newEarnSubTabDesc.trim() || 'Partner integration task'
      };

      setLocalSettings(prev => {
          const currentTabs = prev.customEarnTabs || [
              {
                  id: 'other_tasks',
                  title: 'Other Tasks',
                  enabled: true,
                  subTabs: [
                      { id: 'cpalead', name: 'CP lead', providerKey: 'cpalead', badge: 'CP Lead' },
                      { id: '2row', name: '2row', providerKey: '2row', badge: '2row' },
                      { id: 'x', name: 'X', providerKey: 'x', badge: 'X (Twitter)' },
                      { id: 'pollfish', name: 'Pollfish', providerKey: 'pollfish', badge: 'Polls' },
                      { id: 'adgate', name: 'AdGate Media', providerKey: 'adgate', badge: 'Offerwall' }
                  ]
              }
          ];

          const otherTabIdx = currentTabs.findIndex(t => t.id === 'other_tasks' || t.title.toLowerCase().includes('other'));
          let updatedTabs = [...currentTabs];

          if (otherTabIdx >= 0) {
              const targetTab = updatedTabs[otherTabIdx];
              updatedTabs[otherTabIdx] = {
                  ...targetTab,
                  subTabs: [...(targetTab.subTabs || []), newSub]
              };
          } else {
              updatedTabs.push({
                  id: 'other_tasks',
                  title: 'Other Tasks',
                  enabled: true,
                  subTabs: [newSub]
              });
          }

          return {
              ...prev,
              customEarnTabs: updatedTabs
          };
      });

      setNewEarnSubTabName('');
      setNewEarnSubTabProviderKey('');
      setNewEarnSubTabBadge('');
      setNewEarnSubTabDesc('');
      setIsDirty(true);
  };

  const handleRemoveEarnSubTab = (subId: string) => {
      setLocalSettings(prev => {
          if (!prev.customEarnTabs) return prev;
          const updatedTabs = prev.customEarnTabs.map(t => {
              if (t.id === 'other_tasks' || t.title.toLowerCase().includes('other')) {
                  return {
                      ...t,
                      subTabs: (t.subTabs || []).filter(st => st.id !== subId)
                  };
              }
              return t;
          });
          return { ...prev, customEarnTabs: updatedTabs };
      });
      setIsDirty(true);
  };

  const toggleUserAllowed = (userId: string) => {
      const allowedIds = localSettings.hubAllowedUserIds || [];
      let newIds;
      if (allowedIds.includes(userId)) {
          newIds = allowedIds.filter(id => id !== userId);
      } else {
          newIds = [...allowedIds, userId];
      }
      setLocalSettings(prev => ({ ...prev, hubAllowedUserIds: newIds }));
      setIsDirty(true);
  };

  const togglePlanAllowed = (planId: string) => {
      const allowedIds = localSettings.hubAllowedPlanIds || [];
      let newIds;
      if (allowedIds.includes(planId)) {
          newIds = allowedIds.filter(id => id !== planId);
      } else {
          newIds = [...allowedIds, planId];
      }
      setLocalSettings(prev => ({ ...prev, hubAllowedPlanIds: newIds }));
      setIsDirty(true);
  };

  const toggleDepositMethodAllowed = (methodId: string) => {
      const allowedMethods = localSettings.hubDepositMethods || [];
      let newMethods;
      if (allowedMethods.includes(methodId)) {
          newMethods = allowedMethods.filter(m => m !== methodId);
      } else {
          newMethods = [...allowedMethods, methodId];
      }
      setLocalSettings(prev => ({ ...prev, hubDepositMethods: newMethods }));
      setIsDirty(true);
  };

  const filteredUsersForHub = React.useMemo(() => {
      return (users || []).filter(u => {
          const matchesSearch = !userSearchQuery || 
              (u.username && u.username.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
              (u.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
              (u.fullName && u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()));
          
          const hasActivePlan = u.activePlans && u.activePlans.length > 0;
          const matchesStatus = userStatusFilter === 'all' ||
              (userStatusFilter === 'active' && hasActivePlan) ||
              (userStatusFilter === 'inactive' && !hasActivePlan);
          
          const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
          
          return matchesSearch && matchesStatus && matchesRole;
      });
  }, [users, userSearchQuery, userStatusFilter, userRoleFilter]);

  const handleBulkEnableFiltered = () => {
      const currentAllowed = localSettings.hubAllowedUserIds || [];
      const filteredIds = filteredUsersForHub.map(u => u._id);
      const newAllowed = Array.from(new Set([...currentAllowed, ...filteredIds]));
      setLocalSettings(prev => ({ ...prev, hubAllowedUserIds: newAllowed }));
      setIsDirty(true);
  };

  const handleBulkDisableFiltered = () => {
      const currentAllowed = localSettings.hubAllowedUserIds || [];
      const filteredIds = filteredUsersForHub.map(u => u._id);
      const newAllowed = currentAllowed.filter(id => !filteredIds.includes(id));
      setLocalSettings(prev => ({ ...prev, hubAllowedUserIds: newAllowed }));
      setIsDirty(true);
  };
  
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          const sanitizedPayload = {
              ...localSettings,
              homepagePaymentLogos: (localSettings.homepagePaymentLogos || [])
                  .filter(l => l && (l.name || l.logoUrl))
                  .map(l => ({ name: String(l.name || '').trim(), logoUrl: String(l.logoUrl || '').trim() }))
          };
          const updatedSettings = await updateSettings(sanitizedPayload);
          dispatch({ type: 'UPDATE_SETTINGS', payload: updatedSettings });
          alert('Settings saved successfully!');
          setIsDirty(false);
      } catch (error) {
          console.error("Failed to save settings:", error);
          alert(`Error: ${error instanceof Error ? error.message : 'Could not save settings.'}`);
      } finally {
          setIsSaving(false);
      }
  };

  const calculateConversion = (amount: number, from: Currency, to: Currency, rates: any) => {
      if (from === to) return amount;
      
      const safeRates = { ...rates };
      // Logic relies on rates relative to a common base (e.g. Rate[Currency] units per 1 BaseUnit)
      
      const rateFrom = safeRates[from] || 1;
      const rateTo = safeRates[to] || 1;
      
      // Convert 'From' to Base: Amount / RateFrom
      const inBase = amount / rateFrom;
      
      // Convert Base to 'To': inBase * RateTo
      return inBase * rateTo;
  };

  const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon?: React.ReactNode }) => (
      <button
          type="button"
          onClick={() => setActiveTab(id)}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
              activeTab === id 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
      >
          {icon && <span className="mr-2">{icon}</span>}
          {label}
      </button>
  );

  const ToggleSection = ({ name, label, checked, onChange }: { name: string, label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <label htmlFor={name} className="block text-sm font-medium text-gray-900 dark:text-gray-200">{label}</label>
          <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out">
                <input 
                    id={name}
                    name={name}
                    type="checkbox" 
                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-500"
                    checked={checked}
                    onChange={onChange}
                />
                <label htmlFor={name} className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
            </div>
      </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">System Settings</h2>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto no-scrollbar">
          <TabButton id="general" label="General" />
          <TabButton id="module_pages" label="🛡️ Page & Module Controls" />
          <TabButton id="homepage" label="Homepage" />
          <TabButton id="legal" label="📜 Legal & Contact Us" />
          <TabButton id="faqs" label="FAQs" />
          <TabButton id="transfers" label="Transfers & Fees" />
          <TabButton id="withdrawals" label="Withdrawals" />
          <TabButton id="commissions" label="Commissions" />
          <TabButton id="exchange_rates" label="Exchange Rates" />
          <TabButton id="automation" label="📬 Auto Messaging" />
          <TabButton id="signup_form" label="📋 Sign Up Form" />
          <TabButton id="micro_task_hub" label="💼 Micro Task Hub" />
      </div>

      {activeTab === 'module_pages' ? (
          <div className="animate-fade-in py-2">
              <AdminModulePagesManager />
          </div>
      ) : (
      <form onSubmit={handleSave} className="space-y-6 min-h-[400px]">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h4 className="text-md font-bold text-gray-800 dark:text-white mb-4">Feature Toggles</h4>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="transferConfig.enabled" className="block text-sm font-medium text-gray-900 dark:text-gray-200">User-to-User Transfers</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Allow members to transfer wallet funds to other members.</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                <input 
                                    id="transferConfig.enabled"
                                    name="transferConfig.enabled"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                    checked={localSettings.transferConfig?.enabled ?? true}
                                    onChange={handleCheckboxChange}
                                />
                                <label htmlFor="transferConfig.enabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.transferConfig?.enabled ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>

                        {localSettings.transferConfig?.enabled && (
                            <div className="pl-8 space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                    <div>
                                        <label htmlFor="transferConfig.allowManualRecipientEntry" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Allow Manual Recipient Entry (Transfer to Any Member)</label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">When enabled, members can transfer funds to any registered member on the platform by typing their username or email. When disabled, members can only transfer to their own Active Referral Network members.</p>
                                    </div>
                                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                        <input
                                            id="transferConfig.allowManualRecipientEntry"
                                            name="transferConfig.allowManualRecipientEntry"
                                            type="checkbox"
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                            checked={localSettings.transferConfig?.allowManualRecipientEntry ?? true}
                                            onChange={() => {
                                                setLocalSettings(prev => ({
                                                    ...prev,
                                                    transferConfig: { ...prev.transferConfig, allowManualRecipientEntry: !(prev.transferConfig?.allowManualRecipientEntry ?? true) }
                                                }));
                                                setIsDirty(true);
                                            }}
                                        />
                                        <label htmlFor="transferConfig.allowManualRecipientEntry" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${(localSettings.transferConfig?.allowManualRecipientEntry ?? true) ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                    <div>
                                        <label htmlFor="transferConfig.allowCrossCurrency" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Allow Cross-Currency Transfers</label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, users can send funds to members with a different account currency (e.g., PKR to EUR). Exchange rates will apply.</p>
                                    </div>
                                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                        <input
                                            id="transferConfig.allowCrossCurrency"
                                            name="transferConfig.allowCrossCurrency"
                                            type="checkbox"
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                            checked={localSettings.transferConfig?.allowCrossCurrency ?? false}
                                            onChange={() => {
                                                setLocalSettings(prev => ({
                                                    ...prev,
                                                    transferConfig: { ...prev.transferConfig, allowCrossCurrency: !prev.transferConfig?.allowCrossCurrency }
                                                }));
                                                setIsDirty(true);
                                            }}
                                        />
                                        <label htmlFor="transferConfig.allowCrossCurrency" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.transferConfig?.allowCrossCurrency ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="isTasksEnabled" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Enable Tasks Feature</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Control visibility of "My Tasks" menu for all members.</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                <input 
                                    id="isTasksEnabled"
                                    name="isTasksEnabled"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                    checked={localSettings.isTasksEnabled ?? true}
                                    onChange={handleCheckboxChange}
                                />
                                <label htmlFor="isTasksEnabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.isTasksEnabled ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="userDashboardVersion" className="block text-sm font-medium text-gray-900 dark:text-gray-200">User Dashboard Layout Style</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select between the standard full dashboard layout and the new centered, compact, mobile-perfect version.</p>
                            </div>
                            <div>
                                <select 
                                    id="userDashboardVersion"
                                    name="userDashboardVersion"
                                    value={localSettings.userDashboardVersion || 'compact'}
                                    onChange={handleSelectChange}
                                    className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white text-sm py-1.5 px-3"
                                >
                                    <option value="old">Standard (Old Version)</option>
                                    <option value="compact">Compact (New Version)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-purple-50/60 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div>
                                <label htmlFor="defaultUserDashboardModule" className="block text-sm font-bold text-purple-950 dark:text-purple-200">Default Post-Login Landing Module (پوسٹ لاگ ان ڈیفالٹ ماڈیول)</label>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Select which module members are directed to immediately upon logging in (Work & Earn vs Investment).</p>
                            </div>
                            <div>
                                <select 
                                    id="defaultUserDashboardModule"
                                    name="defaultUserDashboardModule"
                                    value={localSettings.defaultUserDashboardModule || 'work_and_earn'}
                                    onChange={handleSelectChange}
                                    className="rounded-md border-purple-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500 text-gray-900 dark:text-white text-sm py-1.5 px-3 font-semibold shadow-sm"
                                >
                                    <option value="work_and_earn">💼 Work & Earn Module (مائیکرو ٹاسک و ورکر ڈیش بورڈ)</option>
                                    <option value="investment">📈 Investment Module (انویسٹمنٹ و ڈپازٹ ڈیش بورڈ)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-blue-50/60 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div>
                                <label htmlFor="landingPageStyle" className="block text-sm font-bold text-blue-950 dark:text-blue-200">Landing Page Layout Style</label>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Select the main landing page theme (SmartExn Global Work & Tasks or Standard Classic).</p>
                            </div>
                            <div>
                                <select 
                                    id="landingPageStyle"
                                    name="landingPageStyle"
                                    value={localSettings.landingPageStyle || 'smartexn'}
                                    onChange={handleSelectChange}
                                    className="rounded-md border-blue-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white text-sm py-1.5 px-3 font-semibold shadow-sm"
                                >
                                    <option value="smartexn">SmartExn Global Tasks & Earn (New Version)</option>
                                    <option value="standard">Standard Classic (Multi-Section)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="restrictDepositAmount" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Plan-Based Deposit Limits</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, users can only deposit amounts that match the price of currently active investment plans.</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                <input 
                                    id="restrictDepositAmount"
                                    name="restrictDepositAmount"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-400"
                                    checked={localSettings.restrictDepositAmount ?? false}
                                    onChange={handleCheckboxChange}
                                />
                                <label htmlFor="restrictDepositAmount" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.restrictDepositAmount ? 'bg-blue-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="isInitialPageLoaderEnabled" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Enable Brand Full-Page Loading Sequence</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, a colorful circular spinner and status bar with greetings, tagline, and domain name is displayed on first load.</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                <input 
                                    id="isInitialPageLoaderEnabled"
                                    name="isInitialPageLoaderEnabled"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                    checked={localSettings.isInitialPageLoaderEnabled ?? true}
                                    onChange={handleCheckboxChange}
                                />
                                <label htmlFor="isInitialPageLoaderEnabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.isInitialPageLoaderEnabled ?? true ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t dark:border-gray-700">
                        <h4 className="text-md font-bold text-gray-800 dark:text-white mb-4">Account Security (Verification Controls)</h4>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                <div>
                                    <label htmlFor="emailVerificationRequired" className="block text-sm font-medium text-gray-900 dark:text-gray-200">Email Verification</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, new users must verify their email with an automated verification code to complete activation.</p>
                                </div>
                                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                    <input 
                                        id="emailVerificationRequired"
                                        name="emailVerificationRequired"
                                        type="checkbox" 
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                        checked={localSettings.emailVerificationRequired ?? false}
                                        onChange={handleCheckboxChange}
                                    />
                                    <label htmlFor="emailVerificationRequired" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.emailVerificationRequired ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                <div>
                                    <label htmlFor="whatsappVerificationRequired" className="block text-sm font-medium text-gray-900 dark:text-gray-200">WhatsApp Verification</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If enabled, new users must verify their phone number via WhatsApp with an automated verification code.</p>
                                </div>
                                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                    <input 
                                        id="whatsappVerificationRequired"
                                        name="whatsappVerificationRequired"
                                        type="checkbox" 
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                        checked={localSettings.whatsappVerificationRequired ?? false}
                                        onChange={handleCheckboxChange}
                                    />
                                    <label htmlFor="whatsappVerificationRequired" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.whatsappVerificationRequired ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-md font-bold text-gray-800 dark:text-white mb-4">WhatsApp Integration</h4>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                        <div>
                            <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-900 dark:text-gray-200">WhatsApp Support Number</label>
                            <input 
                                id="whatsappNumber"
                                name="whatsappNumber"
                                type="text"
                                placeholder="e.g. 923001234567"
                                value={localSettings.whatsappNumber || ''}
                                onChange={handleTextChange}
                                className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Provide the WhatsApp number including country code (without spaces, leading zeros, or '+') where customers can submit deposit screenshots for fast approval.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <ToggleSection 
                                name="whatsappFloatingEnabled" 
                                label="Enable Floating WhatsApp Icon" 
                                checked={localSettings.whatsappFloatingEnabled !== false} 
                                onChange={handleCheckboxChange} 
                            />
                            <ToggleSection 
                                name="whatsappDepositProofEnabled" 
                                label="Enable WhatsApp Deposit Proof Pop-up" 
                                checked={localSettings.whatsappDepositProofEnabled !== false} 
                                onChange={handleCheckboxChange} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* HOMEPAGE TAB */}
        {activeTab === 'homepage' && (
            <div className="space-y-6 animate-fade-in">
               
               {/* Landing Page Theme Selector */}
               <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <div>
                       <h4 className="font-bold text-blue-900 dark:text-blue-200 text-base">Active Landing Page Layout Style</h4>
                       <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">Choose which landing page layout is served to public visitors on your homepage.</p>
                   </div>
                   <select 
                       id="landingPageStyle"
                       name="landingPageStyle"
                       value={localSettings.landingPageStyle || 'smartexn'}
                       onChange={handleSelectChange}
                       className="rounded-lg border-blue-300 dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white text-sm font-bold py-2 px-3 shadow-md focus:ring-2 focus:ring-blue-500"
                   >
                       <option value="smartexn">SmartExn Global Tasks & Earn (New Version)</option>
                       <option value="standard">Standard Classic (Multi-Section)</option>
                   </select>
               </div>

               {/* SmartExn Landing Page Full Editor */}
               <div className="p-5 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 rounded-2xl border border-sky-500/30 text-white space-y-6 shadow-xl">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-800/60 pb-4">
                       <div>
                           <h3 className="text-lg font-extrabold text-sky-300 flex items-center gap-2">
                               ⚡ SmartExn Landing Page Full Editor
                           </h3>
                           <p className="text-xs text-sky-200/80 mt-1">
                               Customize all titles, text descriptions, action buttons, and preview graphics rendered on the SmartExn landing page.
                           </p>
                       </div>
                       <span className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-mono font-bold border border-sky-400/30 self-start sm:self-auto">
                           Full Customization
                       </span>
                   </div>

                   {/* 1. Landing Page Pictures (Dashboard & Mobile) */}
                   <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-4">
                       <h4 className="font-bold text-sky-300 text-sm flex items-center gap-2">
                           🖼️ Landing Page Showcase Pictures (Dashboard & Mobile)
                       </h4>
                       <p className="text-xs text-slate-300">
                           Upload or provide image URLs to showcase your custom user dashboard layout and mobile app version on the hero right section.
                       </p>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* Dashboard Picture */}
                           <div className="space-y-2 p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                               <label className="text-xs font-bold text-sky-200 block">
                                   Dashboard Layout Image (Desktop)
                               </label>
                               <input 
                                   type="text"
                                   name="homepageContent.smartexnContent.dashboardPreviewImage"
                                   value={localSettings.homepageContent?.smartexnContent?.dashboardPreviewImage || ''}
                                   onChange={handleTextChange}
                                   placeholder="https://example.com/dashboard-preview.png"
                                   className="w-full text-xs p-2 rounded bg-slate-800 border border-slate-600 text-white"
                               />
                               <div className="flex items-center gap-2 pt-1">
                                   <input 
                                       type="file" 
                                       accept="image/*"
                                       onChange={(e) => handleSmartexnImageUpload('dashboardPreviewImage', e.target.files?.[0] || null)}
                                       className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500"
                                   />
                               </div>
                               {localSettings.homepageContent?.smartexnContent?.dashboardPreviewImage && (
                                   <div className="mt-2 rounded overflow-hidden max-h-28 border border-sky-500/30">
                                       <img src={localSettings.homepageContent.smartexnContent.dashboardPreviewImage} alt="Dashboard Preview" className="w-full object-cover" />
                                   </div>
                               )}
                           </div>

                           {/* Mobile Picture */}
                           <div className="space-y-2 p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                               <label className="text-xs font-bold text-amber-200 block">
                                   Mobile Version Image (Phone)
                               </label>
                               <input 
                                   type="text"
                                   name="homepageContent.smartexnContent.mobilePreviewImage"
                                   value={localSettings.homepageContent?.smartexnContent?.mobilePreviewImage || ''}
                                   onChange={handleTextChange}
                                   placeholder="https://example.com/mobile-preview.png"
                                   className="w-full text-xs p-2 rounded bg-slate-800 border border-slate-600 text-white"
                               />
                               <div className="flex items-center gap-2 pt-1">
                                   <input 
                                       type="file" 
                                       accept="image/*"
                                       onChange={(e) => handleSmartexnImageUpload('mobilePreviewImage', e.target.files?.[0] || null)}
                                       className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500"
                                   />
                               </div>
                               {localSettings.homepageContent?.smartexnContent?.mobilePreviewImage && (
                                   <div className="mt-2 rounded overflow-hidden max-h-28 border border-amber-500/30">
                                       <img src={localSettings.homepageContent.smartexnContent.mobilePreviewImage} alt="Mobile Preview" className="w-full object-cover" />
                                   </div>
                               )}
                           </div>
                       </div>
                   </div>

                   {/* 2. Hero Section Settings */}
                   <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-3">
                       <h4 className="font-bold text-sky-300 text-sm">Hero Section Text & Buttons</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           <div className="md:col-span-2">
                               <label className="text-xs text-slate-300 font-semibold">Hero Title</label>
                               <input 
                                   name="homepageContent.smartexnContent.heroTitle"
                                   value={localSettings.homepageContent?.smartexnContent?.heroTitle || ''}
                                   onChange={handleTextChange}
                                   placeholder="Unlock Your Earning Potential with SmartExn.com..."
                                   className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                               />
                           </div>
                           <div className="md:col-span-2">
                               <label className="text-xs text-slate-300 font-semibold">Hero Subtitle</label>
                               <textarea 
                                   name="homepageContent.smartexnContent.heroSubtitle"
                                   value={localSettings.homepageContent?.smartexnContent?.heroSubtitle || ''}
                                   onChange={handleTextChange}
                                   rows={2}
                                   placeholder="Join thousands of global earners or leverage our vast workforce..."
                                   className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                               />
                           </div>
                           <div>
                               <label className="text-xs text-slate-300 font-semibold">Primary Button Text</label>
                               <input 
                                   name="homepageContent.smartexnContent.heroStartBtn"
                                   value={localSettings.homepageContent?.smartexnContent?.heroStartBtn || ''}
                                   onChange={handleTextChange}
                                   placeholder="Start Earning Now"
                                   className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                               />
                           </div>
                           <div>
                               <label className="text-xs text-slate-300 font-semibold">Secondary Button Text</label>
                               <input 
                                   name="homepageContent.smartexnContent.heroPublishBtn"
                                   value={localSettings.homepageContent?.smartexnContent?.heroPublishBtn || ''}
                                   onChange={handleTextChange}
                                   placeholder="Publish Your Own Project"
                                   className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                               />
                           </div>
                       </div>
                   </div>

                   {/* 3. How It Works Steps */}
                   <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-3">
                       <h4 className="font-bold text-sky-300 text-sm">How It Works Steps</h4>
                       <div>
                           <label className="text-xs text-slate-300 font-semibold">Section Header Title</label>
                           <input 
                               name="homepageContent.smartexnContent.howItWorksTitle"
                               value={localSettings.homepageContent?.smartexnContent?.howItWorksTitle || ''}
                               onChange={handleTextChange}
                               placeholder="How It Works"
                               className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                           />
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Step 1</span>
                               <input name="homepageContent.smartexnContent.step1Title" value={localSettings.homepageContent?.smartexnContent?.step1Title || ''} onChange={handleTextChange} placeholder="Sign Up" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.step1Desc" value={localSettings.homepageContent?.smartexnContent?.step1Desc || ''} onChange={handleTextChange} placeholder="Create your free account" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Step 2</span>
                               <input name="homepageContent.smartexnContent.step2Title" value={localSettings.homepageContent?.smartexnContent?.step2Title || ''} onChange={handleTextChange} placeholder="Choose Projects" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.step2Desc" value={localSettings.homepageContent?.smartexnContent?.step2Desc || ''} onChange={handleTextChange} placeholder="Surveys, data entry..." className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Step 3</span>
                               <input name="homepageContent.smartexnContent.step3Title" value={localSettings.homepageContent?.smartexnContent?.step3Title || ''} onChange={handleTextChange} placeholder="Complete Tasks" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.step3Desc" value={localSettings.homepageContent?.smartexnContent?.step3Desc || ''} onChange={handleTextChange} placeholder="Follow simple instructions" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Step 4</span>
                               <input name="homepageContent.smartexnContent.step4Title" value={localSettings.homepageContent?.smartexnContent?.step4Title || ''} onChange={handleTextChange} placeholder="Get Paid" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.step4Desc" value={localSettings.homepageContent?.smartexnContent?.step4Desc || ''} onChange={handleTextChange} placeholder="Receive fast payouts" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                       </div>
                   </div>

                   {/* 4. Featured Earning Opportunities */}
                   <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-3">
                       <h4 className="font-bold text-sky-300 text-sm">Featured Earning Opportunities</h4>
                       <div>
                           <label className="text-xs text-slate-300 font-semibold">Section Header Title</label>
                           <input 
                               name="homepageContent.smartexnContent.oppsTitle"
                               value={localSettings.homepageContent?.smartexnContent?.oppsTitle || ''}
                               onChange={handleTextChange}
                               placeholder="Featured Earning Opportunities"
                               className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                           />
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-emerald-400">Opportunity 1</span>
                               <input name="homepageContent.smartexnContent.opp1Title" value={localSettings.homepageContent?.smartexnContent?.opp1Title || ''} onChange={handleTextChange} placeholder="Paid Surveys & Feedback" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.opp1Desc" value={localSettings.homepageContent?.smartexnContent?.opp1Desc || ''} onChange={handleTextChange} placeholder="In-depth surveys" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-amber-400">Opportunity 2</span>
                               <input name="homepageContent.smartexnContent.opp2Title" value={localSettings.homepageContent?.smartexnContent?.opp2Title || ''} onChange={handleTextChange} placeholder="Micro-Jobs & Data" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.opp2Desc" value={localSettings.homepageContent?.smartexnContent?.opp2Desc || ''} onChange={handleTextChange} placeholder="Data entry, tagging..." className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Opportunity 3</span>
                               <input name="homepageContent.smartexnContent.opp3Title" value={localSettings.homepageContent?.smartexnContent?.opp3Title || ''} onChange={handleTextChange} placeholder="Play Games & Test Apps" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.opp3Desc" value={localSettings.homepageContent?.smartexnContent?.opp3Desc || ''} onChange={handleTextChange} placeholder="Fun game testing..." className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-purple-400">Opportunity 4</span>
                               <input name="homepageContent.smartexnContent.opp4Title" value={localSettings.homepageContent?.smartexnContent?.opp4Title || ''} onChange={handleTextChange} placeholder="Creative & Freelance" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.opp4Desc" value={localSettings.homepageContent?.smartexnContent?.opp4Desc || ''} onChange={handleTextChange} placeholder="Writing, design..." className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                       </div>
                   </div>

                   {/* 5. Business & Advertisers */}
                   <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-3">
                       <h4 className="font-bold text-sky-300 text-sm">Business & Advertisers Points</h4>
                       <div>
                           <label className="text-xs text-slate-300 font-semibold">Section Header Title</label>
                           <input 
                               name="homepageContent.smartexnContent.bizTitle"
                               value={localSettings.homepageContent?.smartexnContent?.bizTitle || ''}
                               onChange={handleTextChange}
                               placeholder="Business & Advertisers"
                               className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                           />
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Point 1</span>
                               <input name="homepageContent.smartexnContent.bizPoint1Title" value={localSettings.homepageContent?.smartexnContent?.bizPoint1Title || ''} onChange={handleTextChange} placeholder="Access a Vast Global Workforce" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.bizPoint1Desc" value={localSettings.homepageContent?.smartexnContent?.bizPoint1Desc || ''} onChange={handleTextChange} placeholder="Access thousands of workers" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Point 2</span>
                               <input name="homepageContent.smartexnContent.bizPoint2Title" value={localSettings.homepageContent?.smartexnContent?.bizPoint2Title || ''} onChange={handleTextChange} placeholder="Fast Quality Results" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.bizPoint2Desc" value={localSettings.homepageContent?.smartexnContent?.bizPoint2Desc || ''} onChange={handleTextChange} placeholder="Verified worker output" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Point 3</span>
                               <input name="homepageContent.smartexnContent.bizPoint3Title" value={localSettings.homepageContent?.smartexnContent?.bizPoint3Title || ''} onChange={handleTextChange} placeholder="Easy Project Management" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.bizPoint3Desc" value={localSettings.homepageContent?.smartexnContent?.bizPoint3Desc || ''} onChange={handleTextChange} placeholder="Dashboard tools for tracking" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                           <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                               <span className="text-[10px] font-bold text-sky-400">Point 4</span>
                               <input name="homepageContent.smartexnContent.bizPoint4Title" value={localSettings.homepageContent?.smartexnContent?.bizPoint4Title || ''} onChange={handleTextChange} placeholder="Flexible Budgeting" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                               <input name="homepageContent.smartexnContent.bizPoint4Desc" value={localSettings.homepageContent?.smartexnContent?.bizPoint4Desc || ''} onChange={handleTextChange} placeholder="Options for any size project" className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white" />
                           </div>
                       </div>
                   </div>

                   {/* 6. Footer Copyright */}
                   <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-2">
                       <h4 className="font-bold text-sky-300 text-sm">Footer Copyright Text</h4>
                       <input 
                           name="homepageContent.smartexnContent.footerCopyright"
                           value={localSettings.homepageContent?.smartexnContent?.footerCopyright || ''}
                           onChange={handleTextChange}
                           placeholder="© 2023 SmartExn.com. All rights reserved."
                            className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                        />
                    </div>

                    {/* Payment Partners Section Options */}
                    <div className="p-4 bg-slate-800/80 rounded-xl border border-sky-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sky-300 text-sm flex items-center gap-2">
                                💳 Payment Partners Display Options (SmartExn Landing Page)
                            </h4>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    name="homepageContent.showPaymentMethods" 
                                    checked={localSettings.homepageContent?.showPaymentMethods !== false} 
                                    onChange={handleCheckboxChange} 
                                    className="sr-only peer" 
                                />
                                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                                <span className="ml-2 text-xs font-bold text-sky-200">
                                    {localSettings.homepageContent?.showPaymentMethods !== false ? 'Enabled' : 'Disabled'}
                                </span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-300 font-semibold">Section Header Title</label>
                                <input 
                                    name="homepageContent.paymentMethodsTitle"
                                    value={localSettings.homepageContent?.paymentMethodsTitle || ''}
                                    onChange={handleTextChange}
                                    placeholder="Global Payment & Withdrawal Partners"
                                    className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-slate-300 font-semibold">Section Description</label>
                                <textarea 
                                    name="homepageContent.paymentMethodsDesc"
                                    value={localSettings.homepageContent?.paymentMethodsDesc || ''}
                                    onChange={handleTextChange}
                                    rows={2}
                                    placeholder="Fast, secure deposits and instant withdrawals supported through top networks..."
                                    className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-300 font-semibold">Display / Animation Style</label>
                                <select 
                                    name="homepageContent.paymentMethodsDisplayType"
                                    value={(localSettings.homepageContent as any)?.paymentMethodsDisplayType || 'static'}
                                    onChange={handleSelectChange}
                                    className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                                >
                                    <option value="static">Static (Still Grid)</option>
                                    <option value="sliding">Sliding (Marquee)</option>
                                    <option value="pulsing">Pulsing (Blink Glow)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-300 font-semibold">Color Mode</label>
                                <select 
                                    name="homepageContent.paymentMethodsColorStyle"
                                    value={(localSettings.homepageContent as any)?.paymentMethodsColorStyle || 'color'}
                                    onChange={handleSelectChange}
                                    className="w-full mt-1 text-xs p-2 rounded bg-slate-900 border border-slate-700 text-white"
                                >
                                    <option value="color">Full Original Color</option>
                                    <option value="grayscale">Grayscale (Color on Hover)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
               
               {/* Visibility Controls */}
               <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                   <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 text-sm uppercase tracking-wide">Section Visibility Control</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                       <ToggleSection name="homepageContent.showHero" label="Hero Banner" checked={localSettings.homepageContent?.showHero !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showFeatures" label="Features Grid" checked={localSettings.homepageContent?.showFeatures !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showMultiCurrency" label="Global Currencies" checked={localSettings.homepageContent?.showMultiCurrency !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showInvestmentPlans" label="Investment Plans" checked={localSettings.homepageContent?.showInvestmentPlans !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showMLM" label="MLM Explanation" checked={localSettings.homepageContent?.showMLM !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showPaymentMethods" label="Payment Partners (SmartExn & Global)" checked={localSettings.homepageContent?.showPaymentMethods !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showVideoSection" label="Video Showcase" checked={localSettings.homepageContent?.showVideoSection !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showFAQ" label="FAQ Section" checked={localSettings.homepageContent?.showFAQ !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="homepageContent.showCTA" label="Bottom CTA" checked={localSettings.homepageContent?.showCTA !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="showUkSupportOffice" label="🇬🇧 UK Support Office (Showcase Section)" checked={localSettings.showUkSupportOffice !== false} onChange={handleCheckboxChange} />
                       <ToggleSection name="showUkSupportOfficeInFooter" label="🇬🇧 UK Support Office in Footers" checked={localSettings.showUkSupportOfficeInFooter !== false} onChange={handleCheckboxChange} />
                   </div>
               </div>

               {/* UK Customer Support Office Settings Card */}
               <div className="p-5 bg-gradient-to-br from-slate-900 via-[#0a1e36] to-[#07192d] rounded-2xl border border-sky-500/30 text-white space-y-4 shadow-xl">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-900/60">
                       <div className="flex items-center gap-2.5">
                           <span className="text-2xl filter drop-shadow">🇬🇧</span>
                           <div>
                               <h4 className="font-extrabold text-sky-300 text-sm tracking-tight flex items-center gap-2">
                                   UK Customer Support Office Settings & Visibility
                               </h4>
                               <p className="text-[11px] text-slate-300">
                                   Configure registered UK headquarters desk details, homepage showcase banner, and footer contact cards.
                               </p>
                           </div>
                       </div>
                       <div className="flex items-center gap-2">
                           <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                               localSettings.showUkSupportOffice !== false
                               ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                               : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                           }`}>
                               Showcase: {localSettings.showUkSupportOffice !== false ? 'Active' : 'Disabled'}
                           </span>
                           <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                               localSettings.showUkSupportOfficeInFooter !== false
                               ? 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                               : 'bg-slate-700 text-slate-400 border-slate-600'
                           }`}>
                               Footer: {localSettings.showUkSupportOfficeInFooter !== false ? 'Active' : 'Disabled'}
                           </span>
                       </div>
                   </div>

                   {/* Quick Toggles */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       <label className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                           localSettings.showUkSupportOffice !== false
                           ? 'bg-sky-950/70 border-sky-500 text-white shadow-md shadow-sky-950/50'
                           : 'bg-slate-900/60 border-slate-700 text-slate-400'
                       }`}>
                           <div className="text-xs font-bold">
                               <span className="block text-sky-200">Showcase Section (Homepage)</span>
                               <span className="text-[10px] text-slate-400 font-normal">Display large official support office banner on homepage</span>
                           </div>
                           <input 
                               type="checkbox"
                               name="showUkSupportOffice"
                               checked={localSettings.showUkSupportOffice !== false}
                               onChange={handleCheckboxChange}
                               className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400 cursor-pointer"
                           />
                       </label>

                       <label className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                           localSettings.showUkSupportOfficeInFooter !== false
                           ? 'bg-sky-950/70 border-sky-500 text-white shadow-md shadow-sky-950/50'
                           : 'bg-slate-900/60 border-slate-700 text-slate-400'
                       }`}>
                           <div className="text-xs font-bold">
                               <span className="block text-sky-200">Footer Support Card</span>
                               <span className="text-[10px] text-slate-400 font-normal">Display compact UK office card in landing & dashboard footers</span>
                           </div>
                           <input 
                               type="checkbox"
                               name="showUkSupportOfficeInFooter"
                               checked={localSettings.showUkSupportOfficeInFooter !== false}
                               onChange={handleCheckboxChange}
                               className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400 cursor-pointer"
                           />
                       </label>
                   </div>

                   {/* Support Desk Customization Inputs */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                       <div>
                           <label className="text-xs font-bold text-emerald-300">Badge 1 (Primary Verification Badge)</label>
                           <input 
                               name="supportOfficeBadge1"
                               value={localSettings.supportOfficeBadge1 || ''}
                               onChange={handleTextChange}
                               placeholder="Official Registered Support Desk"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                           />
                       </div>

                       <div>
                           <label className="text-xs font-bold text-sky-300">Badge 2 (Secondary Badge)</label>
                           <input 
                               name="supportOfficeBadge2"
                               value={localSettings.supportOfficeBadge2 || ''}
                               onChange={handleTextChange}
                               placeholder="UK Registered Office"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                           />
                       </div>

                       <div>
                           <label className="text-xs font-bold text-sky-200">Support Desk Title</label>
                           <input 
                               name="supportOfficeTitle"
                               value={localSettings.supportOfficeTitle || ''}
                               onChange={handleTextChange}
                               placeholder="Customer Support Office (UK)"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-bold"
                           />
                       </div>

                       <div>
                           <label className="text-xs font-bold text-sky-200">Average Response Time</label>
                           <input 
                               name="supportOfficeHours"
                               value={localSettings.supportOfficeHours || ''}
                               onChange={handleTextChange}
                               placeholder="15 – 60 Minutes"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                           />
                       </div>

                       <div className="md:col-span-2">
                           <label className="text-xs font-bold text-sky-200">Support Desk Subtitle / Description</label>
                           <textarea 
                               name="supportOfficeSubtitle"
                               rows={2}
                               value={localSettings.supportOfficeSubtitle || ''}
                               onChange={handleTextChange}
                               placeholder="Have questions or need assistance before creating an account? Our dedicated UK headquarters desk provides direct support for workers, campaign creators, and international partners."
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 leading-relaxed"
                           />
                       </div>

                       <div className="md:col-span-2">
                           <label className="text-xs font-bold text-sky-200">Official Registered Office Address</label>
                           <input 
                               name="supportOfficeAddress"
                               value={localSettings.supportOfficeAddress || ''}
                               onChange={handleTextChange}
                               placeholder="71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                           />
                       </div>

                       <div>
                           <label className="text-xs font-bold text-emerald-300">Direct Phone / WhatsApp Live Desk</label>
                           <input 
                               name="supportOfficePhone"
                               value={localSettings.supportOfficePhone || ''}
                               onChange={handleTextChange}
                               placeholder="+447846775662"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-mono"
                           />
                       </div>

                       <div>
                           <label className="text-xs font-bold text-sky-300">Official Support Email Desk</label>
                           <input 
                               name="supportOfficeEmail"
                               value={localSettings.supportOfficeEmail || ''}
                               onChange={handleTextChange}
                               placeholder="smartexn.com@gmail.com"
                               className="w-full mt-1 text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-mono"
                           />
                       </div>
                   </div>
               </div>

               {/* Hero Section */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Hero Section</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Hero Title</label>
                            <input name="homepageContent.heroTitle" value={localSettings.homepageContent?.heroTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Hero Subtitle</label>
                            <textarea name="homepageContent.heroSubtitle" value={localSettings.homepageContent?.heroSubtitle || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>
                </div>

               {/* Featured Plans */}
               <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Featured Investment Plans</h4>
                    <p className="text-xs text-gray-500">Select plans to display on the homepage. The current design shows a maximum of 3.</p>
                    
                    <div className="space-y-4">
                        {(['USD', 'PKR', 'EUR'] as const).map(currency => {
                            const plansForCurrency = investmentPlans.filter(p => p.currency === currency && p.status === 'Active');
                            return (
                                <div key={currency}>
                                    <h5 className="font-bold text-sm text-gray-600 dark:text-gray-400">{currency} Plans</h5>
                                    {plansForCurrency.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic mt-1">No active plans found for this currency.</p>
                                    ) : (
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {plansForCurrency.map(plan => (
                                                <label key={plan._id} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800/50 rounded-md border dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded text-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                                                        checked={(localSettings.featuredPlanIds || []).includes(plan._id)}
                                                        onChange={() => handleFeaturedPlanChange(plan._id)}
                                                    />
                                                    <span className="text-sm">{plan.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Video Section */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-gray-800 dark:text-white">Video Showcase</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Video Embed URL</label>
                            <input 
                                name="homepageVideoUrl" 
                                value={localSettings.homepageVideoUrl || ''} 
                                onChange={handleTextChange} 
                                placeholder="e.g. https://www.youtube.com/embed/VIDEO_ID" 
                                className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" 
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Youtube: Use <code>https://www.youtube.com/embed/ID</code>
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Video Title</label>
                            <input name="homepageContent.videoTitle" value={localSettings.homepageContent?.videoTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Video Description</label>
                            <textarea name="homepageContent.videoDesc" value={localSettings.homepageContent?.videoDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>
                </div>

                {/* Payment Methods Section */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Payment Partners Display</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Section Title</label>
                            <input name="homepageContent.paymentMethodsTitle" value={localSettings.homepageContent?.paymentMethodsTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Section Description</label>
                            <textarea name="homepageContent.paymentMethodsDesc" value={localSettings.homepageContent?.paymentMethodsDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium">Animation Style</label>
                            <select 
                                name="homepageContent.paymentMethodsDisplayType" 
                                value={(localSettings.homepageContent as any)?.paymentMethodsDisplayType || 'static'} 
                                onChange={handleSelectChange} 
                                className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="static">Static (Grid)</option>
                                <option value="sliding">Slide (Marquee)</option>
                                <option value="pulsing">Blink (Pulse)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium">Color Style</label>
                            <select 
                                name="homepageContent.paymentMethodsColorStyle" 
                                value={(localSettings.homepageContent as any)?.paymentMethodsColorStyle || 'color'} 
                                onChange={handleSelectChange} 
                                className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="color">Full Color</option>
                                <option value="grayscale">Grayscale (Color on Hover)</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t dark:border-gray-600">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div>
                                <h5 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Display Logos Management</h5>
                                <p className="text-xs text-gray-500">Upload payment gateway screenshots, app logos, or paste image URLs for the homepage.</p>
                            </div>
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                                {(localSettings.homepagePaymentLogos || []).length} Active Logos
                            </span>
                        </div>

                        {/* Quick Presets */}
                        <div className="mb-4 bg-gray-100 dark:bg-gray-800/80 p-3 rounded-lg border dark:border-gray-700">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">⚡ Quick Presets (Click to autofill):</span>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { name: 'EasyPaisa', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Easypaisa_logo.png/320px-Easypaisa_logo.png' },
                                    { name: 'JazzCash', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Jazzcash_logo.png/320px-Jazzcash_logo.png' },
                                    { name: 'USDT (TRC20)', url: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
                                    { name: 'Bank Transfer', url: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png' },
                                    { name: 'Binance Pay', url: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png' },
                                    { name: 'Visa / MasterCard', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg' },
                                    { name: 'PayPal', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg' },
                                    { name: 'Perfect Money', url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Perfect_Money_logo.png' },
                                    { name: 'Payeer', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Payeer_logo.png' }
                                ].map((preset) => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => handleQuickAddPreset(preset.name, preset.url)}
                                        className="text-[11px] font-medium bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1 rounded-md border dark:border-gray-600 transition-colors shadow-xs"
                                    >
                                        + {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Existing Logos Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                            {(localSettings.homepagePaymentLogos || []).map((logo, index) => (
                                <div key={index} className="relative p-2.5 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 flex flex-col items-center justify-between group shadow-sm hover:border-blue-400 transition-all">
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveLogo(index)}
                                        className="absolute top-1 right-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-full p-1 transition-colors"
                                        title="Remove Logo"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                    <div className="w-full h-12 flex items-center justify-center mb-1.5 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                        {logo.logoUrl ? (
                                            <img 
                                                src={logo.logoUrl} 
                                                alt={logo.name} 
                                                referrerPolicy="no-referrer"
                                                className="max-h-10 max-w-full object-contain" 
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-400 font-mono">No Image</span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 text-center truncate w-full">{logo.name}</span>
                                </div>
                            ))}
                            {(localSettings.homepagePaymentLogos || []).length === 0 && (
                                <div className="col-span-full text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/30">
                                    <p className="text-xs text-gray-400 italic">No custom payment logos uploaded yet. The landing page is currently displaying standard default gateway icons. Upload custom screenshots/logos or pick quick presets above to customize.</p>
                                </div>
                            )}
                        </div>

                        {/* Add Logo Box */}
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 space-y-3">
                            <h6 className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">Add New Payment Logo or Screenshot</h6>
                            
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-4">
                                    <label className="text-xs font-bold text-gray-500">Method Name *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. EasyPaisa, JazzCash" 
                                        value={newLogoName} 
                                        onChange={(e) => setNewLogoName(e.target.value)} 
                                        className="w-full text-sm rounded-lg dark:bg-gray-700 dark:border-gray-600 border-gray-300 p-2 mt-1"
                                    />
                                </div>
                                
                                <div className="md:col-span-5">
                                    <label className="text-xs font-bold text-gray-500">Upload Screenshot / Photo OR Paste URL *</label>
                                    <div className="flex flex-col gap-1.5 mt-1">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleLogoFileChange} 
                                            className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="OR Paste Image URL (https://...)" 
                                            value={newLogoUrl} 
                                            onChange={(e) => { 
                                                setNewLogoUrl(e.target.value); 
                                                setNewLogoFile(null); 
                                                setPreviewLogoUrl(e.target.value);
                                            }} 
                                            className="w-full text-xs rounded-lg dark:bg-gray-700 dark:border-gray-600 border-gray-300 p-1.5"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-3 flex items-center gap-2">
                                    {(previewLogoUrl || isProcessingLogo) && (
                                        <div className="w-14 h-14 bg-white dark:bg-gray-900 border rounded-lg p-1 flex items-center justify-center shrink-0">
                                            {isProcessingLogo ? (
                                                <span className="text-[9px] text-blue-500 animate-pulse">Resizing...</span>
                                            ) : (
                                                <img src={previewLogoUrl} alt="Preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                                            )}
                                        </div>
                                    )}
                                    <Button 
                                        type="button" 
                                        onClick={handleAddLogo} 
                                        disabled={!newLogoName.trim() || (!newLogoUrl.trim() && !newLogoFile) || isProcessingLogo}
                                        className="w-full"
                                    >
                                        {isProcessingLogo ? 'Optimizing...' : '+ Add to List'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Features</h4>
                    {[1, 2, 3].map(num => (
                        <div key={num} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b dark:border-gray-600 pb-4 last:border-0 last:pb-0">
                            <div>
                                <label className="text-sm font-medium">Feature {num} Title</label>
                                <input name={`homepageContent.feature${num}Title`} value={(localSettings.homepageContent as any)?.[`feature${num}Title`] || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Feature {num} Description</label>
                                <textarea name={`homepageContent.feature${num}Desc`} value={(localSettings.homepageContent as any)?.[`feature${num}Desc`] || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white">Content Sections</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b dark:border-gray-600 pb-4">
                        <div>
                            <label className="text-sm font-medium">Multi-Currency Title</label>
                            <input name="homepageContent.multiCurrencyTitle" value={localSettings.homepageContent?.multiCurrencyTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Multi-Currency Description</label>
                            <textarea name="homepageContent.multiCurrencyDesc" value={localSettings.homepageContent?.multiCurrencyDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b dark:border-gray-600 pb-4">
                        <div>
                            <label className="text-sm font-medium">MLM Section Title</label>
                            <input name="homepageContent.mlmTitle" value={localSettings.homepageContent?.mlmTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">MLM Section Description</label>
                            <textarea name="homepageContent.mlmDesc" value={localSettings.homepageContent?.mlmDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">CTA Title</label>
                            <input name="homepageContent.ctaTitle" value={localSettings.homepageContent?.ctaTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">CTA Description</label>
                            <textarea name="homepageContent.ctaDesc" value={localSettings.homepageContent?.ctaDesc || ''} onChange={handleTextChange} rows={2} className="w-full mt-1 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>
                </div>

                {/* Homepage SEO Metadata */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-white uppercase tracking-tight text-sm">Homepage SEO Metadata Settings</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure search engine titles and descriptors specifically for smartexn.com.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">SEO Title Tag (e.g. Meta Title)</label>
                            <input name="seoTitle" value={localSettings.seoTitle || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="SmartEarning - Invest & Grow Your Network" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">SEO Description Tag (e.g. Meta Description)</label>
                            <textarea name="seoDescription" value={localSettings.seoDescription || ''} onChange={handleTextChange} rows={3} className="w-full mt-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="SmartEarning is a premier Multi-Level Marketing and passive investment ecosystem designed to help you secure stable growth." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">SEO Keywords Tag (Comma-separated)</label>
                            <input name="seoKeywords" value={localSettings.seoKeywords || ''} onChange={handleTextChange} className="w-full mt-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="SmartEarning, investment, MLM, multi-level marketing, passive income" />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* LEGAL PAGES TAB */}
        {activeTab === 'legal' && (() => {
            const getFieldName = (key: string, type: 'title' | 'updated' | 'content') => {
                const isHub = adminLegalTarget === 'hub';
                if (isHub) {
                    const prefix = 'hub';
                    let middle = '';
                    if (key === 'privacy') middle = 'PrivacyPolicy';
                    else if (key === 'terms') middle = 'TermsOfUse';
                    else if (key === 'cookie') middle = 'CookiePolicy';
                    else if (key === 'contact') middle = 'ContactUs';
                    else if (key === 'about') middle = 'AboutUs';
                    else if (key === 'antifraud') middle = 'AntiFraudPolicy';
                    else if (key === 'withdrawal') middle = 'WithdrawalPolicy';
                    else if (key === 'refund') middle = 'RefundPolicy';
                    else if (key === 'disclaimer') middle = 'Disclaimer';
                    else if (key === 'dmca') middle = 'DmcaPolicy';
                    
                    if (type === 'title') return `${prefix}${middle}Title`;
                    if (type === 'updated') return `${prefix}${middle}Updated`;
                    return `${prefix}${middle}Content`;
                } else {
                    let middle = '';
                    if (key === 'privacy') middle = 'privacyPolicy';
                    else if (key === 'terms') middle = 'termsOfUse';
                    else if (key === 'cookie') middle = 'cookiePolicy';
                    else if (key === 'contact') middle = 'contactUs';
                    else if (key === 'about') middle = 'aboutUs';
                    else if (key === 'antifraud') middle = 'antiFraudPolicy';
                    else if (key === 'withdrawal') middle = 'withdrawalPolicy';
                    else if (key === 'refund') middle = 'refundPolicy';
                    else if (key === 'disclaimer') middle = 'disclaimer';
                    else if (key === 'dmca') middle = 'dmcaPolicy';
                    
                    if (type === 'title') return `${middle}Title`;
                    if (type === 'updated') return `${middle}Updated`;
                    return `${middle}Content`;
                }
            };

            const titleField = getFieldName(adminLegalSubTab, 'title');
            const updatedField = getFieldName(adminLegalSubTab, 'updated');
            const contentField = getFieldName(adminLegalSubTab, 'content');

            const currentTitle = (localSettings as any)[titleField] || '';
            const currentUpdated = (localSettings as any)[updatedField] || '';
            const currentContent = (localSettings as any)[contentField] || '';

            const legalSubTabs = [
                { key: 'privacy', label: 'Privacy Policy', emoji: '🔒' },
                { key: 'terms', label: 'Terms of Service', emoji: '⚖️' },
                { key: 'cookie', label: 'Cookie Policy', emoji: '🍪' },
                { key: 'contact', label: 'Contact Us', emoji: '📞' },
                { key: 'about', label: 'About Us', emoji: 'ℹ️' },
                { key: 'antifraud', label: 'Anti-Fraud Policy', emoji: '🚫' },
                { key: 'withdrawal', label: 'Withdrawal Policy', emoji: '💳' },
                { key: 'refund', label: 'Refund Policy', emoji: '💸' },
                { key: 'disclaimer', label: 'Disclaimer', emoji: '⚠️' },
                { key: 'dmca', label: 'DMCA & Copyright', emoji: '📝' }
            ];

            return (
                <div className="space-y-6 animate-fade-in text-left">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                        <h4 className="font-bold text-gray-800 dark:text-white uppercase tracking-tight text-base mb-2">Legal Policy & Compliance Center</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure legal terms and agreements for both the core website (smartexn.com) and the Gigs Hub (Work & Earn).
                        </p>
                    </div>

                    {/* Scope Selector */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700/40 rounded-xl max-w-md">
                        <button
                            type="button"
                            onClick={() => setAdminLegalTarget('global')}
                            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                adminLegalTarget === 'global'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            Global smartexn.com
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdminLegalTarget('hub')}
                            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                adminLegalTarget === 'hub'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            Work & Earn Gigs Hub
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Tab Selector */}
                        <div className="lg:col-span-1 space-y-1">
                            {legalSubTabs.map(subTab => {
                                const isSubActive = adminLegalSubTab === subTab.key;
                                return (
                                    <button
                                        key={subTab.key}
                                        type="button"
                                        onClick={() => setAdminLegalSubTab(subTab.key)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left ${
                                            isSubActive
                                                ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900 shadow-md'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/30'
                                        }`}
                                    >
                                        <span>{subTab.emoji}</span>
                                        <span className="truncate">{subTab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Editor Fields */}
                        <div className="lg:col-span-3 p-6 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-md space-y-4">
                            <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
                                <h5 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-tight text-sm">
                                    Editing: {legalSubTabs.find(t => t.key === adminLegalSubTab)?.label}
                                </h5>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                    adminLegalTarget === 'global' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40'
                                }`}>
                                    {adminLegalTarget === 'global' ? 'Global Platform' : 'Work & Earn Hub'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Page Header Title</label>
                                    <input
                                        name={titleField}
                                        value={currentTitle}
                                        onChange={handleTextChange}
                                        className="w-full mt-1.5 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                                        placeholder="Enter title..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Last Updated Descriptor</label>
                                    <input
                                        name={updatedField}
                                        value={currentUpdated}
                                        onChange={handleTextChange}
                                        className="w-full mt-1.5 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                                        placeholder="Last updated: July 21, 2026"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Detailed Page Content (Markdown / Text supported)</label>
                                <textarea
                                    name={contentField}
                                    value={currentContent}
                                    onChange={handleTextChange}
                                    rows={10}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm font-mono leading-relaxed p-3 focus:ring-2 focus:ring-blue-500"
                                    placeholder="Write policies clause by clause..."
                                />
                            </div>

                            {/* INTERACTIVE CONTACT US BOX CUSTOMIZATION (VISIBLE WHEN EDITING CONTACT US) */}
                            {adminLegalSubTab === 'contact' && (
                                <div className="mt-6 pt-6 border-t dark:border-gray-700 space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b dark:border-gray-700">
                                        <div>
                                            <h6 className="font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-tight text-xs flex items-center gap-2">
                                                <span>🌐</span> Interactive Contact Us Box Customization & Controls
                                            </h6>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                Enable or disable the Contact Us Box component on the user Legal & Support page, manage Email/WhatsApp channels, and set support destinations.
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                                            localSettings.enableContactUsBox !== false 
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                                            : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                        }`}>
                                            {localSettings.enableContactUsBox !== false ? 'Box Active' : 'Box Hidden'}
                                        </span>
                                    </div>

                                    {/* Main Toggles */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                            localSettings.enableContactUsBox !== false
                                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-950 dark:text-teal-200'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                                        }`}>
                                            <div className="text-xs font-bold">
                                                <span className="block font-black">Contact Us Box</span>
                                                <span className="text-[10px] text-gray-500 font-normal">Show on user support page</span>
                                            </div>
                                            <input 
                                                type="checkbox"
                                                name="enableContactUsBox"
                                                checked={localSettings.enableContactUsBox !== false}
                                                onChange={handleCheckboxChange}
                                                className="w-4 h-4 rounded text-teal-600"
                                            />
                                        </label>

                                        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                            localSettings.enableContactViaEmail !== false
                                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-indigo-200'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                                        }`}>
                                            <div className="text-xs font-bold">
                                                <span className="block font-black">Email Channel 📧</span>
                                                <span className="text-[10px] text-gray-500 font-normal">Allow contact via Email</span>
                                            </div>
                                            <input 
                                                type="checkbox"
                                                name="enableContactViaEmail"
                                                checked={localSettings.enableContactViaEmail !== false}
                                                onChange={handleCheckboxChange}
                                                className="w-4 h-4 rounded text-indigo-600"
                                            />
                                        </label>

                                        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                            localSettings.enableContactViaWhatsApp !== false
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                                        }`}>
                                            <div className="text-xs font-bold">
                                                <span className="block font-black">WhatsApp Channel 💬</span>
                                                <span className="text-[10px] text-gray-500 font-normal">Allow WhatsApp chat</span>
                                            </div>
                                            <input 
                                                type="checkbox"
                                                name="enableContactViaWhatsApp"
                                                checked={localSettings.enableContactViaWhatsApp !== false}
                                                onChange={handleCheckboxChange}
                                                className="w-4 h-4 rounded text-emerald-600"
                                            />
                                        </label>
                                    </div>

                                    {/* Destination Input Fields */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Support Email Destination Address
                                            </label>
                                            <input 
                                                type="email"
                                                name="contactUsEmailAddress"
                                                value={localSettings.contactUsEmailAddress || ''}
                                                onChange={handleTextChange}
                                                placeholder="smartexn.com@gmail.com"
                                                className="w-full text-xs p-2.5 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Support WhatsApp Number (With International Prefix)
                                            </label>
                                            <input 
                                                type="text"
                                                name="contactUsWhatsAppNumber"
                                                value={localSettings.contactUsWhatsAppNumber || ''}
                                                onChange={handleTextChange}
                                                placeholder="+447846775662"
                                                className="w-full text-xs p-2.5 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Contact Box Custom Header Title
                                            </label>
                                            <input 
                                                type="text"
                                                name="contactUsBoxTitle"
                                                value={localSettings.contactUsBoxTitle || ''}
                                                onChange={handleTextChange}
                                                placeholder="International Member Support & Contact Desk"
                                                className="w-full text-xs p-2.5 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Contact Box Custom Subtitle Description
                                            </label>
                                            <input 
                                                type="text"
                                                name="contactUsBoxSubtitle"
                                                value={localSettings.contactUsBoxSubtitle || ''}
                                                onChange={handleTextChange}
                                                placeholder="Have questions regarding your withdrawal, payout settlement, or account verification?"
                                                className="w-full text-xs p-2.5 rounded-xl border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    {/* UK CUSTOMER SUPPORT OFFICE CONTROLS IN LEGAL TAB */}
                                    <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h6 className="font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-tight text-xs flex items-center gap-2">
                                                <span>🇬🇧</span> UK Customer Support Office Card Visibility & Details
                                            </h6>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                                    localSettings.showUkSupportOffice !== false 
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                                                    : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                                }`}>
                                                    Showcase: {localSettings.showUkSupportOffice !== false ? 'Active' : 'Hidden'}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                                    localSettings.showUkSupportOfficeInFooter !== false 
                                                    ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300' 
                                                    : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                    Footer: {localSettings.showUkSupportOfficeInFooter !== false ? 'Active' : 'Hidden'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer border dark:border-gray-700">
                                                <input 
                                                    type="checkbox" 
                                                    name="showUkSupportOffice" 
                                                    checked={localSettings.showUkSupportOffice !== false} 
                                                    onChange={handleCheckboxChange} 
                                                    className="w-4 h-4 text-sky-600 rounded" 
                                                />
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Show Homepage Showcase Banner</span>
                                            </label>

                                            <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer border dark:border-gray-700">
                                                <input 
                                                    type="checkbox" 
                                                    name="showUkSupportOfficeInFooter" 
                                                    checked={localSettings.showUkSupportOfficeInFooter !== false} 
                                                    onChange={handleCheckboxChange} 
                                                    className="w-4 h-4 text-sky-600 rounded" 
                                                />
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Show UK Card in Footers</span>
                                            </label>
                                        </div>

                                        {/* UK Office Detailed Configuration */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Badge 1 (Primary)
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficeBadge1"
                                                    value={localSettings.supportOfficeBadge1 || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="Official Registered Support Desk"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Badge 2 (Secondary)
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficeBadge2"
                                                    value={localSettings.supportOfficeBadge2 || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="UK Registered Office"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Support Desk Title
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficeTitle"
                                                    value={localSettings.supportOfficeTitle || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="Customer Support Office (UK)"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white font-bold"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Average Response Time
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficeHours"
                                                    value={localSettings.supportOfficeHours || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="15 – 60 Minutes"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                                />
                                            </div>

                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Subtitle / Intro Description
                                                </label>
                                                <textarea 
                                                    name="supportOfficeSubtitle"
                                                    rows={2}
                                                    value={localSettings.supportOfficeSubtitle || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="Have questions or need assistance before creating an account? Our dedicated UK headquarters desk provides direct support for workers, campaign creators, and international partners."
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white leading-relaxed"
                                                />
                                            </div>

                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Registered Office Address
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficeAddress"
                                                    value={localSettings.supportOfficeAddress || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    WhatsApp Live Support Number
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficePhone"
                                                    value={localSettings.supportOfficePhone || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="+447846775662"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                    Official Support Email
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="supportOfficeEmail"
                                                    value={localSettings.supportOfficeEmail || ''}
                                                    onChange={handleTextChange}
                                                    placeholder="smartexn.com@gmail.com"
                                                    className="w-full text-xs p-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })()}

        {/* FAQS TAB */}
        {activeTab === 'faqs' && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-white">Knowledge Base & Featured Queries</h4>
                        <p className="text-sm text-gray-500">Manage all FAQs. Use the star icon to toggle which items appear on the homepage.</p>
                    </div>
                    <Button onClick={handleAddFaq}>+ Add New FAQ</Button>
                </div>
                
                <div className="space-y-4">
                    {(localSettings.faqs || []).map((faq, index) => (
                        <div key={index} className={`p-5 rounded-3xl border-2 transition-all group ${faq.showOnHomepage ? 'bg-blue-50/30 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/50' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-600'}`}>
                            <div className="flex gap-4 items-start">
                                <div className="flex-grow space-y-3">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => handleFaqChange(index, 'showOnHomepage', !faq.showOnHomepage)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all shadow-sm ${faq.showOnHomepage ? 'bg-yellow-400 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-600'}`}
                                            title={faq.showOnHomepage ? "Featured on Homepage" : "Mark as Featured"}
                                        >
                                            <StarIcon filled={faq.showOnHomepage} className={faq.showOnHomepage ? "text-white" : ""} />
                                            {faq.showOnHomepage ? 'Featured' : 'Not Featured'}
                                        </button>
                                        <input 
                                            className="flex-grow font-bold text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none p-1" 
                                            placeholder="The question text..." 
                                            value={faq.question}
                                            onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                                        />
                                    </div>
                                    <textarea 
                                        className="w-full text-sm text-gray-600 dark:text-gray-300 bg-transparent border-0 focus:ring-0 p-1 resize-y min-h-[80px]" 
                                        placeholder="The detailed answer text..."
                                        rows={3}
                                        value={faq.answer}
                                        onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveFaq(index)} 
                                        className="text-gray-300 hover:text-red-500 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-full transition-all"
                                        title="Delete FAQ"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(localSettings.faqs || []).length === 0 && (
                        <div className="text-center p-12 text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed dark:border-gray-700">
                            No FAQs created. Start by adding one above.
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* EXCHANGE RATES TAB */}
        {activeTab === 'exchange_rates' && (
            <div className="space-y-8 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                     <div className="mb-3 sm:mb-0">
                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Currency Rates</h4>
                        <div className="text-sm text-blue-700 dark:text-blue-200 mt-1 max-w-2xl">
                           Define the value of each currency relative to the system's internal base unit. 
                           <br/>Example: If USD = 1 and PKR = 278, then 1 USD = 278 PKR. 
                           <br/>You can adjust all values freely.
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                         <div className="flex justify-between items-end">
                            <h4 className="font-semibold text-gray-800 dark:text-white text-lg">Active Rates</h4>
                             <Button 
                                type="button" 
                                size="sm" 
                                variant="secondary" 
                                onClick={handleFetchLiveRates}
                                disabled={isFetchingRates}
                             >
                                {isFetchingRates ? 'Fetching...' : 'Simulate Fetch Live Rates'}
                            </Button>
                        </div>
                        
                        {(['USD', 'EUR', 'PKR'] as const).map(currency => (
                            <div key={currency} className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                                            currency === 'USD' ? 'bg-green-100 dark:bg-green-900' :
                                            currency === 'EUR' ? 'bg-indigo-100 dark:bg-indigo-900' :
                                            'bg-teal-100 dark:bg-teal-900'
                                        }`}>
                                            {currency === 'USD' ? '🇺🇸' : currency === 'EUR' ? '🇪🇺' : '🇵🇰'}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-gray-900 dark:text-white">{currency}</h5>
                                            <p className="text-xs text-gray-500">
                                                {currency === 'USD' ? 'US Dollar' : currency === 'EUR' ? 'Euro' : 'Pakistani Rupee'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400 uppercase">Current</div>
                                        <div className="font-mono font-bold">{localSettings.exchangeRates?.[currency]}</div>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exchange Rate (vs Base)</label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                            <span className="text-gray-500 sm:text-sm font-bold">1 Base = </span>
                                        </div>
                                        <input
                                            name={`exchangeRates.${currency}`}
                                            type="number"
                                            step="0.0001"
                                            value={localSettings.exchangeRates?.[currency] || ''}
                                            onChange={handleExchangeRateChange}
                                            className="block w-full rounded-md border-gray-300 pl-20 focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 py-3 font-mono text-lg"
                                            placeholder="1.00"
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center">
                                            <span className="text-gray-500 sm:text-sm">{currency}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="space-y-6">
                        <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg border border-gray-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-green-500 rounded-full opacity-20 blur-xl"></div>
                            <h4 className="font-bold text-lg mb-4 flex items-center relative z-10">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                Conversion Check
                            </h4>
                            
                            <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Amount</label>
                                    <input type="number" value={simAmount} onChange={e => setSimAmount(parseFloat(e.target.value) || 0)} className="w-full mt-1 bg-gray-800 border-gray-600 rounded-md text-white px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">From</label>
                                        <select value={simFrom} onChange={e => setSimFrom(e.target.value as Currency)} className="w-full mt-1 bg-gray-800 border-gray-600 rounded-md text-white px-2 py-2">
                                            <option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">To</label>
                                        <select value={simTo} onChange={e => setSimTo(e.target.value as Currency)} className="w-full mt-1 bg-gray-800 border-gray-600 rounded-md text-white px-2 py-2">
                                            <option value="PKR">PKR</option><option value="EUR">EUR</option><option value="USD">USD</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4 mt-2 border-t border-gray-700">
                                    <div className="text-xs text-gray-400 mb-1">Result (based on inputs above)</div>
                                    <div className="text-2xl font-mono font-bold text-green-400">
                                        {formatCurrency(calculateConversion(simAmount, simFrom, simTo, localSettings.exchangeRates), simTo)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wide">Cross-Rate Reference</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                    <span className="text-gray-600 dark:text-gray-400">1 USD =</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                        {localSettings.exchangeRates?.USD && localSettings.exchangeRates?.PKR 
                                            ? (localSettings.exchangeRates.PKR / localSettings.exchangeRates.USD).toFixed(2) 
                                            : 'N/A'
                                        } PKR
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                    <span className="text-gray-600 dark:text-gray-400">1 EUR =</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                        {localSettings.exchangeRates?.EUR && localSettings.exchangeRates?.PKR
                                            ? (localSettings.exchangeRates.PKR / localSettings.exchangeRates.EUR).toFixed(2)
                                            : 'N/A'
                                        } PKR
                                    </span>
                                </div>
                            </div>
                             <p className="mt-3 text-xs text-gray-500 italic">
                                * Calculated automatically based on the rates provided.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TRANSFERS TAB */}
        {activeTab === 'transfers' && (
            <div className="space-y-6 animate-fade-in">
                {/* Master Transfer Controls */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Master Transfer Controls</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="transferConfig_enabled_tab" className="block text-sm font-semibold text-gray-900 dark:text-gray-200">User-to-User Transfers</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enable or disable wallet transfers between members.</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out shrink-0 ml-2">
                                <input 
                                    id="transferConfig_enabled_tab"
                                    name="transferConfig.enabled"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                    checked={localSettings.transferConfig?.enabled ?? true}
                                    onChange={handleCheckboxChange}
                                />
                                <label htmlFor="transferConfig_enabled_tab" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.transferConfig?.enabled ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="transferConfig_manual_tab" className="block text-sm font-semibold text-gray-900 dark:text-gray-200">Manual Recipient Entry</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Allow sending to any registered member by typing username/email.</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out shrink-0 ml-2">
                                <input
                                    id="transferConfig_manual_tab"
                                    name="transferConfig.allowManualRecipientEntry"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                    checked={localSettings.transferConfig?.allowManualRecipientEntry ?? true}
                                    onChange={() => {
                                        setLocalSettings(prev => ({
                                            ...prev,
                                            transferConfig: { ...prev.transferConfig, allowManualRecipientEntry: !(prev.transferConfig?.allowManualRecipientEntry ?? true) }
                                        }));
                                        setIsDirty(true);
                                    }}
                                />
                                <label htmlFor="transferConfig_manual_tab" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${(localSettings.transferConfig?.allowManualRecipientEntry ?? true) ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            <div>
                                <label htmlFor="transferConfig_cross_tab" className="block text-sm font-semibold text-gray-900 dark:text-gray-200">Cross-Currency Transfers</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Allow sending between different currencies (e.g. PKR to EUR).</p>
                            </div>
                            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out shrink-0 ml-2">
                                <input
                                    id="transferConfig_cross_tab"
                                    name="transferConfig.allowCrossCurrency"
                                    type="checkbox" 
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                    checked={localSettings.transferConfig?.allowCrossCurrency ?? false}
                                    onChange={() => {
                                        setLocalSettings(prev => ({
                                            ...prev,
                                            transferConfig: { ...prev.transferConfig, allowCrossCurrency: !prev.transferConfig?.allowCrossCurrency }
                                        }));
                                        setIsDirty(true);
                                    }}
                                />
                                <label htmlFor="transferConfig_cross_tab" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.transferConfig?.allowCrossCurrency ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                            </div>
                        </div>
                    </div>
                </div>

                 <div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transfer Fee Structure</h3>
                        <select
                            value={tierCurrencyFilter}
                            onChange={(e) => setTierCurrencyFilter(e.target.value as Currency | '')}
                            className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">Show All</option>
                            <option value="EUR">EUR</option>
                            <option value="PKR">PKR</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                     <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase items-center mb-2 px-1">
                                <div className="col-span-1">Currency</div>
                                <div className="col-span-2">Min Amount</div>
                                <div className="col-span-2">Max Amount</div>
                                <div className="col-span-2">Type</div>
                                <div className="col-span-2">Value</div>
                                <div className="col-span-1 text-center">Active</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {localSettings.transferConfig.tiers.map((tier, index) => {
                                if (tierCurrencyFilter && tier.currency !== tierCurrencyFilter) return null;
                                return (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-800 p-2 rounded shadow-sm">
                                    <div className="col-span-1">
                                        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 dark:bg-gray-900">{tier.currency}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={tier.minAmount} 
                                            onChange={(e) => handleTierChange(index, 'minAmount', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={tier.maxAmount} 
                                            onChange={(e) => handleTierChange(index, 'maxAmount', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                            placeholder="100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <select 
                                            value={tier.feeType} 
                                            onChange={(e) => handleTierChange(index, 'feeType', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                        >
                                            <option value="fixed">Fixed ({currencySymbols[tier.currency]})</option>
                                            <option value="percentage">Percent (%)</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={tier.feeValue} 
                                            onChange={(e) => handleTierChange(index, 'feeValue', e.target.value)}
                                            className="w-full text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 py-1"
                                            placeholder="Fee"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center items-center">
                                        <label className="inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={tier.enabled !== false}
                                                onChange={(e) => handleTierChange(index, 'enabled', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <Button type="button" size="sm" variant="danger" onClick={() => handleRemoveTier(index)} className="py-1 px-2">X</Button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                        <div className="mt-4">
                            <Button type="button" size="sm" variant="secondary" onClick={handleAddTier} disabled={!tierCurrencyFilter}>
                               {tierCurrencyFilter ? `+ Add Fee Tier for ${tierCurrencyFilter}` : 'Select a Currency to Add Tier'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* WITHDRAWALS TAB */}
        {activeTab === 'withdrawals' && (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Withdrawal Restrictions</h3>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white">Plan-Based Amount Limits</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                If enabled, users can <strong>only</strong> withdraw amounts that match the price of their currently active investment plans.
                            </p>
                        </div>
                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                            <input 
                                id="restrictWithdrawalAmount"
                                name="restrictWithdrawalAmount"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-400"
                                checked={localSettings.restrictWithdrawalAmount}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="restrictWithdrawalAmount" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.restrictWithdrawalAmount ? 'bg-blue-400' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white">Withdrawal Frequency Limit</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Limit how often a user can submit a withdrawal request.
                            </p>
                        </div>
                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                            <input 
                                id="withdrawalFrequency.enabled"
                                name="withdrawalFrequency.enabled"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-400"
                                checked={localSettings.withdrawalFrequency?.enabled}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="withdrawalFrequency.enabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.withdrawalFrequency?.enabled ? 'bg-blue-400' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>

                    {localSettings.withdrawalFrequency?.enabled && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md border dark:border-gray-600 animate-fade-in">
                            <span className="text-sm font-medium">Allow 1 withdrawal every:</span>
                            <input 
                                type="number" 
                                min="1"
                                name="withdrawalFrequency.value"
                                value={localSettings.withdrawalFrequency.value}
                                onChange={handleFrequencyChange}
                                className="w-20 rounded-md dark:bg-gray-700 dark:border-gray-600 text-center"
                            />
                            <select 
                                name="withdrawalFrequency.unit"
                                value={localSettings.withdrawalFrequency.unit}
                                onChange={handleFrequencyChange}
                                className="rounded-md dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="weeks">Weeks</option>
                                <option value="months">Months</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* AUTOMATION TAB */}
        {activeTab === 'automation' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Free Automated Messaging & Dispatch</h3>
                        <p className="text-xs text-gray-500">Configure free automation setups for Gmail and WhatsApp API (UltraMsg) to handle client onboarding and security alerts automatically.</p>
                    </div>
                </div>

                {/* EMAIL CONFIGURATION (GMAIL) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📧</span>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">Gmail Free SMTP Automation</h4>
                                <p className="text-[10px] text-gray-400">Uses Gmail Secure App Password credentials for automated mailing</p>
                            </div>
                        </div>
                        <div className="relative inline-block w-10 h-5">
                            <input 
                                id="emailAutomationEnabled"
                                name="emailAutomationEnabled"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-500"
                                checked={localSettings.emailAutomationEnabled || false}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="emailAutomationEnabled" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${localSettings.emailAutomationEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>

                    {localSettings.emailAutomationEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">Sender Gmail Address</label>
                                <input 
                                    type="email"
                                    name="emailSenderAddress"
                                    value={localSettings.emailSenderAddress || ''}
                                    onChange={handleTextChange}
                                    className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                                    placeholder="your-email@gmail.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">Gmail App Password (16-char)</label>
                                <input 
                                    type="text"
                                    name="emailSenderPassword"
                                    value={localSettings.emailSenderPassword || ''}
                                    onChange={handleTextChange}
                                    className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0 font-mono"
                                    placeholder="xxxx xxxx xxxx xxxx"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* WHATSAPP CONFIGURATION (ULTRAMSG) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💬</span>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">WhatsApp Free Automation (UltraMsg)</h4>
                                <p className="text-[10px] text-gray-400">Uses Ultramsg testing instances for free API message dispatches</p>
                            </div>
                        </div>
                        <div className="relative inline-block w-10 h-5">
                            <input 
                                id="whatsappAutomationEnabled"
                                name="whatsappAutomationEnabled"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-500"
                                checked={localSettings.whatsappAutomationEnabled || false}
                                onChange={handleCheckboxChange}
                            />
                            <label htmlFor="whatsappAutomationEnabled" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${localSettings.whatsappAutomationEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>

                    {localSettings.whatsappAutomationEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">UltraMsg Instance ID</label>
                                <input 
                                    type="text"
                                    name="whatsappInstanceId"
                                    value={localSettings.whatsappInstanceId || ''}
                                    onChange={handleTextChange}
                                    className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0 font-mono"
                                    placeholder="instancexxxx"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">UltraMsg Token</label>
                                <input 
                                    type="text"
                                    name="whatsappToken"
                                    value={localSettings.whatsappToken || ''}
                                    onChange={handleTextChange}
                                    className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0 font-mono"
                                    placeholder="your_token"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* COMMISSIONS TAB */}
        {activeTab === 'commissions' && (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Referral Commission Rules</h3>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-bold mb-1">Important:</p>
                    These settings strictly control when a sponsor receives a commission. If conditions are not met, commissions will be <strong>HELD (Pending)</strong> until the user qualifies.
                </div>
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-start space-x-3">
                        <input 
                            id="requireActivePlanForCommission"
                            name="requireActivePlanForCommission"
                            type="checkbox" 
                            className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={localSettings.requireActivePlanForCommission}
                            onChange={handleCheckboxChange}
                        />
                        <div>
                            <label htmlFor="requireActivePlanForCommission" className="block font-semibold text-gray-900 dark:text-white">Require Any Active Plan</label>
                            <p className="text-sm text-gray-500 mt-1">
                                If checked, a sponsor must have <strong>at least one</strong> active investment plan to receive commissions. Free users will have commissions held.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-start space-x-3">
                        <input 
                            id="requirePlanMatchForCommission"
                            name="requirePlanMatchForCommission"
                            type="checkbox" 
                            className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={localSettings.requirePlanMatchForCommission}
                            onChange={handleCheckboxChange}
                        />
                        <div>
                            <label htmlFor="requirePlanMatchForCommission" className="block font-semibold text-gray-900 dark:text-white">Strict Plan Matching (High Security)</label>
                            <p className="text-sm text-gray-500 mt-1">
                                If checked, the sponsor must own the <strong>EXACT SAME PLAN</strong> that the referral purchased.
                                <br/>
                                <em>Example: If Referral buys Plan A, Sponsor gets paid only if they also have Plan A active.</em>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* SIGN UP FORM CUSTOMIZATION TAB */}
        {activeTab === 'signup_form' && (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">📋 Sign Up Form Settings</h3>
                    <p className="text-xs text-gray-500">Configure visible fields, set validation rules (such as country code requirements), and make any options optional, required, or hidden.</p>
                </div>

                {/* Form Title Customization */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Form Title Customization</h4>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Registration Form Title</label>
                        <input 
                            type="text" 
                            value={localSettings.signUpConfig?.customTitle || 'Create your Account'}
                            onChange={(e) => handleSignUpConfigChange('customTitle', e.target.value)}
                            className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0 focus:border-blue-500"
                            placeholder="e.g. Create your Account"
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-6">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Field Rules & Requirements</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* FULL NAME */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Full Name Field</label>
                            <select 
                                value={localSettings.signUpConfig?.fullNameRule || 'required'}
                                onChange={(e) => handleSignUpConfigChange('fullNameRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* USERNAME */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Username Field</label>
                            <select 
                                value={localSettings.signUpConfig?.usernameRule || 'required'}
                                onChange={(e) => handleSignUpConfigChange('usernameRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* PHONE NUMBER */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Mobile Number Field</label>
                            <select 
                                value={localSettings.signUpConfig?.phoneRule || 'required'}
                                onChange={(e) => handleSignUpConfigChange('phoneRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* WHATSAPP NUMBER */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">WhatsApp Number Field</label>
                            <select 
                                value={localSettings.signUpConfig?.whatsappRule || 'required'}
                                onChange={(e) => handleSignUpConfigChange('whatsappRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* COUNTRY */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Country Field</label>
                            <select 
                                value={localSettings.signUpConfig?.countryRule || 'required'}
                                onChange={(e) => handleSignUpConfigChange('countryRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* SPONSOR */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Sponsor Username Field</label>
                            <select 
                                value={localSettings.signUpConfig?.sponsorRule || 'optional'}
                                onChange={(e) => handleSignUpConfigChange('sponsorRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* ADDRESS */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Residential Address Field</label>
                            <select 
                                value={localSettings.signUpConfig?.addressRule || 'hidden'}
                                onChange={(e) => handleSignUpConfigChange('addressRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* CITY */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">City Field</label>
                            <select 
                                value={localSettings.signUpConfig?.cityRule || 'hidden'}
                                onChange={(e) => handleSignUpConfigChange('cityRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* POSTAL CODE */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Postal/Zip Code Field</label>
                            <select 
                                value={localSettings.signUpConfig?.postalCodeRule || 'hidden'}
                                onChange={(e) => handleSignUpConfigChange('postalCodeRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* TELEGRAM */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Telegram Username Field</label>
                            <select 
                                value={localSettings.signUpConfig?.telegramRule || 'hidden'}
                                onChange={(e) => handleSignUpConfigChange('telegramRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* GENDER */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Gender Selection Field</label>
                            <select 
                                value={localSettings.signUpConfig?.genderRule || 'hidden'}
                                onChange={(e) => handleSignUpConfigChange('genderRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>

                        {/* DATE OF BIRTH */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Date of Birth Field</label>
                            <select 
                                value={localSettings.signUpConfig?.dateOfBirthRule || 'hidden'}
                                onChange={(e) => handleSignUpConfigChange('dateOfBirthRule', e.target.value)}
                                className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                            >
                                <option value="required">Required / Must</option>
                                <option value="optional">Optional</option>
                                <option value="hidden">Hidden / Disabled</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Phone & WhatsApp Validation Rules</h4>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Require Country Code in Mobile Number</p>
                            <p className="text-xs text-gray-500 mt-1">If enabled, the customer must add a country code (e.g. starting with "+" or starting with a country prefix like "92", "33" without local zeroes).</p>
                        </div>
                        <div className="relative inline-block w-10 h-5">
                            <input 
                                id="requireCountryCodeInPhone"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-500"
                                checked={localSettings.signUpConfig?.requireCountryCodeInPhone || false}
                                onChange={(e) => handleSignUpConfigChange('requireCountryCodeInPhone', e.target.checked)}
                            />
                            <label htmlFor="requireCountryCodeInPhone" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${localSettings.signUpConfig?.requireCountryCodeInPhone ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Require Country Code in WhatsApp Number</p>
                            <p className="text-xs text-gray-500 mt-1">If enabled, the customer must add a country code to their WhatsApp number (e.g. starting with "+" or starting with a country prefix like "92", "33" without local zeroes).</p>
                        </div>
                        <div className="relative inline-block w-10 h-5">
                            <input 
                                id="requireCountryCodeInWhatsapp"
                                type="checkbox" 
                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-blue-500"
                                checked={localSettings.signUpConfig?.requireCountryCodeInWhatsapp || false}
                                onChange={(e) => handleSignUpConfigChange('requireCountryCodeInWhatsapp', e.target.checked)}
                            />
                            <label htmlFor="requireCountryCodeInWhatsapp" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${localSettings.signUpConfig?.requireCountryCodeInWhatsapp ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>
                </div>

                {/* Dynamic Custom Fields Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-6">
                    <div className="border-b dark:border-gray-700 pb-2 flex justify-between items-center">
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">➕ Dynamic Custom Fields</h4>
                        <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                            {(localSettings.signUpConfig?.customFields || []).length} Active Fields
                        </span>
                    </div>

                    {/* Add Custom Field Form */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">Create New Custom Field</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs text-gray-500 font-medium">Field Label / Name</label>
                                <input 
                                    type="text"
                                    value={newFieldLabel}
                                    onChange={(e) => setNewFieldLabel(e.target.value)}
                                    className="w-full text-sm p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-0"
                                    placeholder="e.g. National ID Number"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs text-gray-500 font-medium">Field Type</label>
                                <select
                                    value={newFieldType}
                                    onChange={(e) => setNewFieldType(e.target.value as any)}
                                    className="w-full text-sm p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-0"
                                >
                                    <option value="text">Text Box</option>
                                    <option value="number">Numeric Input</option>
                                    <option value="select">Dropdown Menu (Select)</option>
                                    <option value="checkbox">Checkbox (Yes/No)</option>
                                </select>
                            </div>
                        </div>

                        {newFieldType === 'select' && (
                            <div className="space-y-1">
                                <label className="block text-xs text-gray-500 font-medium">Options (Comma separated)</label>
                                <input 
                                    type="text"
                                    value={newFieldOptions}
                                    onChange={(e) => setNewFieldOptions(e.target.value)}
                                    className="w-full text-sm p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-0"
                                    placeholder="e.g. Option A, Option B, Option C"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={newFieldRequired}
                                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                                    className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                                />
                                Make Field Required (Mandatory)
                            </label>

                            <button
                                type="button"
                                onClick={handleAddCustomField}
                                disabled={!newFieldLabel.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-50"
                            >
                                Add Field to Form
                            </button>
                        </div>
                    </div>

                    {/* Existing Custom Fields List */}
                    <div className="space-y-3">
                        <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">Active Custom Fields</h5>
                        {(localSettings.signUpConfig?.customFields || []).length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No custom fields have been added yet. Form will only show default fields.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {(localSettings.signUpConfig?.customFields || []).map((field) => (
                                    <div key={field.id} className="p-4 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl flex items-center justify-between shadow-sm">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-gray-900 dark:text-white">{field.label}</span>
                                                <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${field.required ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                                                    {field.required ? 'Required' : 'Optional'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Type: <span className="font-mono text-gray-700 dark:text-gray-300">{field.type}</span>
                                                {field.type === 'select' && ` • Options: [ ${field.options} ]`}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCustomField(field.id)}
                                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* MICRO TASK HUB SETTINGS TAB */}
        {activeTab === 'micro_task_hub' && (
            <div className="space-y-6 animate-fade-in text-left">
                <div className="border-b dark:border-gray-700 pb-3">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">💼 Micro Task Hub Configurations</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Configure payment boundaries, withdrawal rules, deposit methods, and user access filters for the separate Micro Task Hub.
                    </p>
                </div>

                {/* Global Toggle Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">Global Activation Switch</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Enable or disable the Micro Task Hub entirely. When disabled, users will only see the investment dashboard and all task menus will be hidden.
                        </p>
                    </div>
                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out shrink-0">
                        <input 
                            id="hubEnabled"
                            name="hubEnabled"
                            type="checkbox" 
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                            checked={localSettings.hubEnabled ?? true}
                            onChange={(e) => {
                                setLocalSettings(prev => ({ ...prev, hubEnabled: e.target.checked }));
                                setIsDirty(true);
                            }}
                        />
                        <label htmlFor="hubEnabled" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.hubEnabled ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                    </div>
                </div>

                {/* Default Post-Login Module */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">Default Post-Login Landing Module (پوسٹ لاگ ان ڈیفالٹ ماڈیول)</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Choose which primary module members see immediately after logging in. When Work & Earn is selected, members land on Micro Tasks; when Investment is selected, members land on Investment Plans.
                        </p>
                    </div>
                    <div className="shrink-0">
                        <select 
                            id="hub_defaultUserDashboardModule"
                            name="defaultUserDashboardModule"
                            value={localSettings.defaultUserDashboardModule || 'work_and_earn'}
                            onChange={handleSelectChange}
                            className="w-full sm:w-auto text-xs font-bold p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                        >
                            <option value="work_and_earn">💼 Work & Earn (Micro Tasks & Gigs)</option>
                            <option value="investment">📈 Investment Dashboard (Plans & Deposits)</option>
                        </select>
                    </div>
                </div>

                {/* User Access Controls */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">🛡️ Target Audience Eligibility Filters</h4>
                    
                    <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Access Eligibility Mode</label>
                        <select
                            value={localSettings.hubAccessMode || 'all'}
                            onChange={(e) => {
                                setLocalSettings(prev => ({ ...prev, hubAccessMode: e.target.value as any }));
                                setIsDirty(true);
                            }}
                            className="w-full text-sm p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-0"
                        >
                            <option value="all">Unrestricted - Enabled for All Users</option>
                            <option value="plan">Active Investment Plan Requirement (Category & Brand-wise)</option>
                            <option value="manual">Manual Selection - White-listed Users (One-by-one / Bulk Filter)</option>
                        </select>
                    </div>

                    {/* Access Mode: Plan Selection */}
                    {localSettings.hubAccessMode === 'plan' && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-3 animate-fade-in">
                            <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Qualifying Investment Plans</h5>
                            <p className="text-xs text-gray-500">Only users owning at least one of the checked investment plans will have access to the Micro Task Hub.</p>
                            {investmentPlans.length === 0 ? (
                                <p className="text-xs text-red-500 italic">No investment plans found. Please define plans first.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {investmentPlans.map((plan) => {
                                        const isChecked = (localSettings.hubAllowedPlanIds || []).includes(plan._id);
                                        return (
                                            <label key={plan._id} className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-all">
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => togglePlanAllowed(plan._id)}
                                                    className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 font-extrabold"
                                                />
                                                <div className="truncate">
                                                    <span className="font-bold block truncate">{plan.name}</span>
                                                    <span className="text-gray-400 text-[10px]">{formatCurrency(plan.price, plan.currency as any)}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Access Mode: Manual/Individual/Filter Selection */}
                    {localSettings.hubAccessMode === 'manual' && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4 animate-fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">Whitelist Members manually</h5>
                                <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    {(localSettings.hubAllowedUserIds || []).length} Whitelisted Users
                                </span>
                            </div>

                            {/* Filters row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Search query */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-400">Search Username/Email</label>
                                    <input 
                                        type="text"
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
                                        placeholder="Type to search..."
                                    />
                                </div>

                                {/* Plan Activation status */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-400">Plan Activation status</label>
                                    <select
                                        value={userStatusFilter}
                                        onChange={(e) => setUserStatusFilter(e.target.value as any)}
                                        className="w-full text-xs p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-0"
                                    >
                                        <option value="all">All (Active & Inactive)</option>
                                        <option value="active">Active (Has Active Plan)</option>
                                        <option value="inactive">Inactive (No Active Plan)</option>
                                    </select>
                                </div>

                                {/* Role category */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-400">Role Filter</label>
                                    <select
                                        value={userRoleFilter}
                                        onChange={(e) => setUserRoleFilter(e.target.value as any)}
                                        className="w-full text-xs p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 focus:ring-0"
                                    >
                                        <option value="all">All Roles</option>
                                        <option value="user">Regular Users</option>
                                        <option value="admin">Administrators</option>
                                        <option value="finance">Finance Staff</option>
                                        <option value="support">Support Staff</option>
                                    </select>
                                </div>
                            </div>

                            {/* Bulk Operations */}
                            <div className="flex gap-2 justify-end py-1 border-t border-b dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={handleBulkEnableFiltered}
                                    className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded transition"
                                >
                                    Whitelist All Filtered ({filteredUsersForHub.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkDisableFiltered}
                                    className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded transition"
                                >
                                    Blacklist All Filtered ({filteredUsersForHub.length})
                                </button>
                            </div>

                            {/* List block */}
                            <div className="border dark:border-gray-800 rounded-lg max-h-60 overflow-y-auto bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">
                                {filteredUsersForHub.length === 0 ? (
                                    <p className="text-xs text-center p-6 text-gray-400 italic">No users found matching current filter rules.</p>
                                ) : (
                                    filteredUsersForHub.map((u: any) => {
                                        const isChecked = (localSettings.hubAllowedUserIds || []).includes(u._id);
                                        const isActive = u.activePlans && u.activePlans.length > 0;
                                        return (
                                            <div key={u._id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all text-xs">
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleUserAllowed(u._id)}
                                                        className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 font-extrabold cursor-pointer"
                                                    />
                                                    <div>
                                                        <span className="font-bold text-gray-900 dark:text-white block">{u.fullName || u.username}</span>
                                                        <span className="text-gray-400 text-[10px]">{u.email} ({u.username})</span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                                                        {isActive ? 'Active Plan' : 'No Plan'}
                                                    </span>
                                                    <span className="text-gray-400 text-[10px] font-mono">{u.role}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* WORK AND EARN MODULE CUSTOM TABS & SUB-TABS MANAGER */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-6">
                    <div className="border-b dark:border-gray-700 pb-3">
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 uppercase tracking-wide flex items-center gap-2">
                            <span>🗂️ Work & Earn Dashboard Custom Tabs & Sub-Tabs</span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Configure the dynamic sub-tabs under "Other Tasks" (e.g. CP lead, 2row, X, etc.) or add new integration tabs for user earnings.
                        </p>
                    </div>

                    {/* Current Subtabs List */}
                    <div className="space-y-3">
                        <h5 className="font-bold text-xs uppercase text-gray-400 tracking-wider">Active Sub-Tabs under "Other Tasks"</h5>
                        
                        {(() => {
                            const currentSubTabs = (localSettings.customEarnTabs?.find(t => t.id === 'other_tasks' || t.title.toLowerCase().includes('other'))?.subTabs) || [
                                { id: 'cpalead', name: 'CP lead', providerKey: 'cpalead', badge: 'CP Lead' },
                                { id: '2row', name: '2row', providerKey: '2row', badge: '2row' },
                                { id: 'x', name: 'X', providerKey: 'x', badge: 'X (Twitter)' },
                                { id: 'pollfish', name: 'Pollfish', providerKey: 'pollfish', badge: 'Polls' },
                                { id: 'adgate', name: 'AdGate Media', providerKey: 'adgate', badge: 'Offerwall' }
                            ];

                            return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {currentSubTabs.map(st => (
                                        <div key={st.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 flex items-center justify-between text-xs">
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                    <span>{st.name}</span>
                                                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                                                        {st.badge || 'Active'}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono">Key: {st.providerKey || st.id}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEarnSubTab(st.id)}
                                                className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded text-[11px]"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Add New Sub-Tab Form */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-700 space-y-4">
                        <h5 className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300">➕ Add New Sub-Tab to "Other Tasks"</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Sub-Tab Display Name *</label>
                                <input
                                    type="text"
                                    value={newEarnSubTabName}
                                    onChange={(e) => setNewEarnSubTabName(e.target.value)}
                                    placeholder="e.g. CP lead, 2row, X, BitLabs..."
                                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Badge / Tag (Optional)</label>
                                <input
                                    type="text"
                                    value={newEarnSubTabBadge}
                                    onChange={(e) => setNewEarnSubTabBadge(e.target.value)}
                                    placeholder="e.g. Instant Approval, Hot..."
                                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Provider Key (Optional)</label>
                                <input
                                    type="text"
                                    value={newEarnSubTabProviderKey}
                                    onChange={(e) => setNewEarnSubTabProviderKey(e.target.value)}
                                    placeholder="e.g. cpalead, bitlabs, x..."
                                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={handleAddEarnSubTab}
                                disabled={!newEarnSubTabName.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition"
                            >
                                Add Sub-Tab
                            </button>
                        </div>
                    </div>
                </div>

                {/* HUB LEGAL PAGES CUSTOMIZER */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-6">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">⚖️ Hub Legal Pages Content</h4>
                    <p className="text-xs text-gray-500">
                        Customize independent legal and compliance text specifically for the Micro Task & Gigs Hub module.
                    </p>

                    {/* Privacy Policy */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-tight text-xs">1. Hub Privacy Policy Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubPrivacyPolicyTitle" value={localSettings.hubPrivacyPolicyTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Privacy Policy" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubPrivacyPolicyUpdated" value={localSettings.hubPrivacyPolicyUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubPrivacyPolicyContent" value={localSettings.hubPrivacyPolicyContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Privacy policy content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Terms of Use */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-tight text-xs">2. Hub Terms of Use Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubTermsOfUseTitle" value={localSettings.hubTermsOfUseTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Terms of Use" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubTermsOfUseUpdated" value={localSettings.hubTermsOfUseUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubTermsOfUseContent" value={localSettings.hubTermsOfUseContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Terms of use content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Refund Policy */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-red-600 dark:text-red-400 uppercase tracking-tight text-xs">3. Hub Refund Policy Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubRefundPolicyTitle" value={localSettings.hubRefundPolicyTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Refund Policy" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubRefundPolicyUpdated" value={localSettings.hubRefundPolicyUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubRefundPolicyContent" value={localSettings.hubRefundPolicyContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Refund policy content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Cookie Policy */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight text-xs">4. Hub Cookie Policy Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubCookiePolicyTitle" value={localSettings.hubCookiePolicyTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Cookie Policy" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubCookiePolicyUpdated" value={localSettings.hubCookiePolicyUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubCookiePolicyContent" value={localSettings.hubCookiePolicyContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Cookie policy content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Contact Us */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-tight text-xs">5. Hub Contact Us Customizer & Interactive Contact Box</h5>
                        
                        {/* TOGGLE CONTROLS FOR CONTACT US BOX */}
                        <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 space-y-3">
                            <h6 className="font-bold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">🌐 Contact Us Box Component Controls</h6>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer border dark:border-gray-700">
                                    <input 
                                        type="checkbox" 
                                        name="enableContactUsBox" 
                                        checked={localSettings.enableContactUsBox !== false} 
                                        onChange={handleCheckboxChange} 
                                        className="w-4 h-4 text-teal-600 rounded" 
                                    />
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Show Contact Us Box</span>
                                </label>

                                <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer border dark:border-gray-700">
                                    <input 
                                        type="checkbox" 
                                        name="enableContactViaEmail" 
                                        checked={localSettings.enableContactViaEmail !== false} 
                                        onChange={handleCheckboxChange} 
                                        className="w-4 h-4 text-teal-600 rounded" 
                                    />
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Enable Email Option 📧</span>
                                </label>

                                <label className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer border dark:border-gray-700">
                                    <input 
                                        type="checkbox" 
                                        name="enableContactViaWhatsApp" 
                                        checked={localSettings.enableContactViaWhatsApp !== false} 
                                        onChange={handleCheckboxChange} 
                                        className="w-4 h-4 text-teal-600 rounded" 
                                    />
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Enable WhatsApp Option 💬</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">Support Email Address</label>
                                    <input 
                                        type="email" 
                                        name="contactUsEmailAddress" 
                                        value={localSettings.contactUsEmailAddress || ''} 
                                        onChange={handleTextChange} 
                                        className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                                        placeholder="smartexn.com@gmail.com" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">Support WhatsApp Number (International format)</label>
                                    <input 
                                        type="text" 
                                        name="contactUsWhatsAppNumber" 
                                        value={localSettings.contactUsWhatsAppNumber || ''} 
                                        onChange={handleTextChange} 
                                        className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono" 
                                        placeholder="+447846775662" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">Contact Box Custom Title</label>
                                    <input 
                                        type="text" 
                                        name="contactUsBoxTitle" 
                                        value={localSettings.contactUsBoxTitle || ''} 
                                        onChange={handleTextChange} 
                                        className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                                        placeholder="International Member Support & Contact Desk" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">Contact Box Custom Subtitle</label>
                                    <input 
                                        type="text" 
                                        name="contactUsBoxSubtitle" 
                                        value={localSettings.contactUsBoxSubtitle || ''} 
                                        onChange={handleTextChange} 
                                        className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                                        placeholder="Have questions regarding your withdrawal, payout settlement, or account verification?" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubContactUsTitle" value={localSettings.hubContactUsTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Contact Us" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubContactUsUpdated" value={localSettings.hubContactUsUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubContactUsContent" value={localSettings.hubContactUsContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Contact us content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* About Us */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-tight text-xs">6. Hub About Us Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubAboutUsTitle" value={localSettings.hubAboutUsTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub About Us" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubAboutUsUpdated" value={localSettings.hubAboutUsUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubAboutUsContent" value={localSettings.hubAboutUsContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="About us content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Anti-Fraud Policy */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-tight text-xs">7. Hub Anti-Fraud Policy Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubAntiFraudPolicyTitle" value={localSettings.hubAntiFraudPolicyTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Anti-Fraud Policy" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubAntiFraudPolicyUpdated" value={localSettings.hubAntiFraudPolicyUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubAntiFraudPolicyContent" value={localSettings.hubAntiFraudPolicyContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Anti-fraud policy content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Withdrawal Policy */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight text-xs">8. Hub Withdrawal Policy Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubWithdrawalPolicyTitle" value={localSettings.hubWithdrawalPolicyTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Withdrawal Policy" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubWithdrawalPolicyUpdated" value={localSettings.hubWithdrawalPolicyUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubWithdrawalPolicyContent" value={localSettings.hubWithdrawalPolicyContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Withdrawal policy content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-tight text-xs">9. Hub Disclaimer Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubDisclaimerTitle" value={localSettings.hubDisclaimerTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub Disclaimer" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubDisclaimerUpdated" value={localSettings.hubDisclaimerUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubDisclaimerContent" value={localSettings.hubDisclaimerContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="Disclaimer content specific to tasks hub..." />
                        </div>
                    </div>

                    {/* DMCA Policy */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
                        <h5 className="font-extrabold text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-tight text-xs">10. Hub DMCA Policy Customizer</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Page Header Title</label>
                                <input name="hubDmcaPolicyTitle" value={localSettings.hubDmcaPolicyTitle || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Hub DMCA & Copyright Policy" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500">Last Updated Descriptor</label>
                                <input name="hubDmcaPolicyUpdated" value={localSettings.hubDmcaPolicyUpdated || ''} onChange={handleTextChange} className="w-full mt-1 text-xs p-2.5 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Last updated: July 21, 2026" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Content (Markdown / Text)</label>
                            <textarea name="hubDmcaPolicyContent" value={localSettings.hubDmcaPolicyContent || ''} onChange={handleTextChange} rows={6} className="w-full rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono p-2.5" placeholder="DMCA policy content specific to tasks hub..." />
                        </div>
                    </div>
                </div>

                {/* HUB FAQS CUSTOMIZER */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">❓ Hub FAQs</h4>
                        <button
                            type="button"
                            onClick={handleAddHubFaq}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition animate-fade-in"
                        >
                            + Add New Hub FAQ
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Add, remove, and configure Frequently Asked Questions that will display within the Work & Earn Hub module.
                    </p>

                    {(localSettings.hubFaqs || []).length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-4 text-center">No Hub FAQs defined. Click the button above to add one.</p>
                    ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                            {(localSettings.hubFaqs || []).map((faq, index) => (
                                <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-3 relative border dark:border-gray-800 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] uppercase font-bold text-gray-400">FAQ Item #{index + 1}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveHubFaq(index)}
                                            className="text-red-500 hover:text-red-700 text-xs font-bold transition"
                                        >
                                            Remove Item
                                        </button>
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-500 uppercase">Question</label>
                                            <input
                                                type="text"
                                                value={faq.question}
                                                onChange={(e) => handleHubFaqChange(index, 'question', e.target.value)}
                                                className="w-full mt-1 text-xs p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                                placeholder="e.g., How can I earn through the tasks hub?"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-500 uppercase">Answer</label>
                                            <textarea
                                                value={faq.answer}
                                                onChange={(e) => handleHubFaqChange(index, 'answer', e.target.value)}
                                                rows={3}
                                                className="w-full mt-1 text-xs p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                                placeholder="e.g., You can start earning by completing short social gigs like watching videos, following accounts, etc."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
       
        <div className="pt-6 border-t dark:border-gray-700 flex justify-end">
           <Button type="submit" disabled={isSaving || !isDirty} size="lg" className="px-8">
               {isSaving ? 'Saving Settings...' : 'Save All Changes'}
           </Button>
        </div>
      </form>
      )}
    </div>
  );
};

export default Settings;
