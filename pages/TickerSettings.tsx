
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../hooks/useData';
import { Settings, DemoProfile, DemoActivityTemplate, Currency, countries, formatCurrency, InvestmentPlan, Notice, Deposit, Withdrawal, User, Transaction, Transfer } from '../types';
import { updateSettings } from '../services/api';
import Button from '../components/ui/Button';
import ActivityTicker, { Activity } from '../components/ui/ActivityTicker';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

// --- Icons ---
const GeneralIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const RealIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const ProfileIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const TemplateIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
const NoticeIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.433 9.168-6M10 15V5a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h4a2 2 0 002-2z" /></svg>;
const SaveIcon = () => <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const PlusIcon = () => <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const DepositIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const WithdrawalIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>;
const UsersIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const EarningsIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg>;
const TransferIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>;
const PlanIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
const ShieldCheckIcon = () => <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a11.955 11.955 0 019-2.606a11.955 11.955 0 019 2.606c-.311-5.863-3.69-10.964-8.618-13.04z" /></svg>;
const FilterIcon = () => <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;
const ChevronDownIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronUpIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const SearchIcon = () => <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const EyeIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const EyeOffIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>;

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; }> = ({ checked, onChange }) => (
    <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
);

const PRESETS = {
    deposits: [
        '<strong class="font-semibold">{name}</strong> deposited <strong>{currency} {amount}</strong>',
        'New deposit of <strong>{currency} {amount}</strong> from <strong class="font-semibold">{name}</strong>',
        '<strong class="font-semibold">{name}</strong> ({country}) just added <strong>{currency} {amount}</strong>',
        'Funds received! <strong class="font-semibold">{name}</strong>: <strong>{currency} {amount}</strong>',
        '<strong>{amount} {currency}</strong> deposit confirmed for <strong class="font-semibold">{name}</strong>'
    ],
    withdrawals: [
        '<strong class="font-semibold">{name}</strong> withdrew <strong>{currency} {amount}</strong>',
        'Payout of <strong>{currency} {amount}</strong> sent to <strong class="font-semibold">{name}</strong>',
        '<strong class="font-semibold">{name}</strong> just cashed out <strong>{currency} {amount}</strong>',
        'Withdrawal processed: <strong class="font-semibold">{name}</strong> (<strong>{currency} {amount}</strong>)',
        'Congratulations <strong class="font-semibold">{name}</strong> on your withdrawal of <strong>{currency} {amount}</strong>'
    ],
    registrations: [
        '<strong class="font-semibold">{name}</strong> from {country} just joined!',
        'Welcome <strong class="font-semibold">{name}</strong> from {country} to the community',
        'New member alert: <strong class="font-semibold">{name}</strong> ({country})',
        '<strong class="font-semibold">{name}</strong> has registered from {country}',
        'Our community is growing! Welcome <strong class="font-semibold">{name}</strong>'
    ],
    commissions: [
        '<strong class="font-semibold">{name}</strong> earned <strong>{currency} {amount}</strong> commission ({source})',
        '<strong>{currency} {amount}</strong> commission for <strong class="font-semibold">{name}</strong> ({source})',
        '<strong class="font-semibold">{name}</strong> just made <strong>{currency} {amount}</strong> from referral',
        'Referral bonus! <strong class="font-semibold">{name}</strong> earned <strong>{currency} {amount}</strong>',
        '<strong>{currency} {amount}</strong> added to <strong class="font-semibold">{name}</strong>\'s wallet ({source})'
    ],
    transfers: [
        '<strong class="font-semibold">{name}</strong> transferred <strong>{currency} {amount}</strong> to {recipient}',
        'Fund transfer: <strong class="font-semibold">{name}</strong> sent <strong>{currency} {amount}</strong>',
        '<strong class="font-semibold">{name}</strong> sent <strong>{currency} {amount}</strong> to a friend',
        '<strong>{currency} {amount}</strong> transferred by <strong class="font-semibold">{name}</strong>',
        'Internal transfer of <strong>{currency} {amount}</strong> completed by <strong class="font-semibold">{name}</strong>'
    ],
    planPurchases: [
        '<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong> ({currency} {amount})',
        '<strong class="font-semibold">{name}</strong> upgraded to <strong>{plan}</strong>',
        'New <strong>{plan}</strong> activation by <strong class="font-semibold">{name}</strong>',
        '<strong class="font-semibold">{name}</strong> started earning with <strong>{plan}</strong>',
        'Investment made: <strong class="font-semibold">{name}</strong> bought <strong>{plan}</strong>'
    ]
};

const TemplateEditor: React.FC<{
    typeKey: keyof typeof PRESETS;
    activeTemplates: string[];
    onUpdate: (newTemplates: string[]) => void;
    availableVariables: string[];
}> = ({ typeKey, activeTemplates, onUpdate, availableVariables }) => {
    const [newTemplate, setNewTemplate] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleAdd = () => {
        if (newTemplate.trim()) {
            onUpdate([...activeTemplates, newTemplate.trim()]);
            setNewTemplate('');
        }
    };

    const handleRemove = (index: number) => {
        onUpdate(activeTemplates.filter((_, i) => i !== index));
    };

    const handleInsertVariable = (variable: string) => {
        if (inputRef.current) {
            const start = inputRef.current.selectionStart;
            const end = inputRef.current.selectionEnd;
            const text = newTemplate;
            const before = text.substring(0, start);
            const after = text.substring(end, text.length);
            const newValue = before + variable + after;
            setNewTemplate(newValue);
            
            // Restore focus and cursor position after React re-render
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(start + variable.length, start + variable.length);
                }
            }, 0);
        } else {
            setNewTemplate(prev => prev + variable);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex flex-wrap gap-2 mb-2">
                    {availableVariables.map(v => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => handleInsertVariable(v)}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                            {v}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        className="flex-grow text-sm rounded-lg border-gray-300 dark:bg-gray-800 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                        placeholder="Type message template here..."
                        value={newTemplate}
                        onChange={e => setNewTemplate(e.target.value)}
                        onKeyPress={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAdd();
                            }
                        }}
                    />
                    <Button onClick={handleAdd} disabled={!newTemplate.trim()} className="self-end">Add</Button>
                </div>
                <p className="text-xs text-gray-500">HTML allowed (e.g., &lt;strong&gt;bold&lt;/strong&gt;). Click variables above to insert.</p>
            </div>

            <div className="space-y-2">
                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Templates ({activeTemplates.length})</h5>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {activeTemplates.map((t, i) => (
                        <div key={i} className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 group hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-sm">
                            <span className="text-sm text-gray-700 dark:text-gray-300 mr-2 break-words" dangerouslySetInnerHTML={{__html: t}} />
                            <button 
                                onClick={() => handleRemove(i)} 
                                className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove Template"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                    {activeTemplates.length === 0 && (
                        <div className="text-center p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-sm text-gray-500">No templates defined. This event type will be skipped.</p>
                            <button 
                                onClick={() => onUpdate([PRESETS[typeKey][0]])} 
                                className="text-blue-600 hover:underline text-xs mt-1"
                            >
                                Restore Default
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RealActivityCard: React.FC<{
    item: { id: string; label: string; icon: React.ReactNode };
    isActive: boolean;
    templates: string[];
    onToggle: (id: any) => void;
    onUpdateTemplates: (id: any, templates: string[]) => void;
    variables: string[];
}> = ({ item, isActive, templates, onToggle, onUpdateTemplates, variables }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={`border dark:border-gray-700 rounded-xl transition-all duration-200 ${isActive ? 'bg-white dark:bg-gray-800 shadow-sm' : 'bg-gray-50 dark:bg-gray-800/50 opacity-75'}`}>
            <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg ${isActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {item.icon}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{item.label}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {templates.length} Active Template{templates.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                    <ToggleSwitch checked={isActive} onChange={() => onToggle(item.id)} />
                    <button className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} onClick={() => setIsExpanded(!isExpanded)}>
                        <ChevronDownIcon />
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t dark:border-gray-700 animate-fade-in bg-gray-50/50 dark:bg-gray-900/20">
                    <div className="pt-4">
                        <TemplateEditor 
                            typeKey={item.id as any}
                            activeTemplates={templates}
                            onUpdate={(newT) => onUpdateTemplates(item.id, newT)}
                            availableVariables={variables}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

const TickerSettings: React.FC = () => {
    const { state, dispatch } = useData();
    const { investmentPlans, users, deposits, withdrawals, transactions, transfers } = state;
    const [localSettings, setLocalSettings] = useState<Partial<Settings>>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'real' | 'profiles' | 'templates' | 'notices'>('general');

    // Filter States for Real Activity Debug
    const [debugEventType, setDebugEventType] = useState('all');
    const [debugSearch, setDebugSearch] = useState('');
    const [selectedDebugIds, setSelectedDebugIds] = useState<string[]>([]);

    // Filter States for Templates Tab
    const [templateSearch, setTemplateSearch] = useState('');
    const [templateTypeFilter, setTemplateTypeFilter] = useState('all');

    // Selection State
    const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

    // Modal States
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isBulkProfileModalOpen, setIsBulkProfileModalOpen] = useState(false);
    const [bulkProfileText, setBulkProfileText] = useState('');
    const [currentProfile, setCurrentProfile] = useState<Partial<DemoProfile> | null>(null);
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isBulkTemplateModalOpen, setIsBulkTemplateModalOpen] = useState(false);
    const [bulkTemplateText, setBulkTemplateText] = useState('');
    const [currentTemplate, setCurrentTemplate] = useState<Partial<DemoActivityTemplate> | null>(null);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);

    // Template Builder State
    const [builderProfileId, setBuilderProfileId] = useState('');
    const [isManualProfile, setIsManualProfile] = useState(false);
    const [manualProfileName, setManualProfileName] = useState('');
    const [manualProfileCountry, setManualProfileCountry] = useState(countries[0]);
    const [manualProfileCurrency, setManualProfileCurrency] = useState<Currency>('USD');

    const [builderAction, setBuilderAction] = useState('joined');
    const [builderPlanId, setBuilderPlanId] = useState('');
    const [builderTransferAmount, setBuilderTransferAmount] = useState('');
    const [builderRecipientId, setBuilderRecipientId] = useState('');
    
    // Commission Specific Builder State
    const [builderCommissionType, setBuilderCommissionType] = useState<'direct' | 'indirect'>('direct');
    const [builderIndirectLevel, setBuilderIndirectLevel] = useState<string>('0'); 

    // Custom Text Builder State
    const [builderCustomText, setBuilderCustomText] = useState('');
    const [builderCustomStyle, setBuilderCustomStyle] = useState<'none' | 'success' | 'danger' | 'info'>('none');

    // Notice Management State
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [currentNotice, setCurrentNotice] = useState<Partial<Notice> | null>(null);
    const [manualUserSearch, setManualUserSearch] = useState('');

    // Bulk Edit Modals
    const [isBulkEditProfilesModalOpen, setIsBulkEditProfilesModalOpen] = useState(false);
    const [bulkEditProfileData, setBulkEditProfileData] = useState<{ country?: string, currency?: Currency }>({});
    
    const [isBulkEditTemplatesModalOpen, setIsBulkEditTemplatesModalOpen] = useState(false);
    const [bulkEditTemplateData, setBulkEditTemplateData] = useState<{ type?: string, enabled?: string }>({}); 
    
    // Pagination State
    const [profilesCurrentPage, setProfilesCurrentPage] = useState(1);
    const [profilesPerPage] = useState(10);
    const [templatesCurrentPage, setTemplatesCurrentPage] = useState(1);
    const [templatesPerPage] = useState(10);

    // Ref for template textarea to insert variables
    const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Ensure nested objects exist and handle potential legacy string vs array data
        const safeRealTemplates: any = state.settings?.tickerRealActivityTemplates || {};
        const safeRealConfig = state.settings?.tickerRealActivityConfig || { minAmount: 0, privacyMode: false, excludedCurrencies: [] };
        
        // Helper to ensure array
        const ensureArray = (val: any, defaultArr: string[]) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') return [val];
            return defaultArr;
        };

        const normalizedTemplates = {
            deposits: ensureArray(safeRealTemplates.deposits, PRESETS.deposits.slice(0,1)),
            withdrawals: ensureArray(safeRealTemplates.withdrawals, PRESETS.withdrawals.slice(0,1)),
            registrations: ensureArray(safeRealTemplates.registrations, PRESETS.registrations.slice(0,1)),
            commissions: ensureArray(safeRealTemplates.commissions, PRESETS.commissions.slice(0,1)),
            transfers: ensureArray(safeRealTemplates.transfers, PRESETS.transfers.slice(0,1)),
            planPurchases: ensureArray(safeRealTemplates.planPurchases, PRESETS.planPurchases.slice(0,1))
        };

        setLocalSettings({
            tickerEnabled: true,
            tickerSpeed: 6,
            tickerPauseOnHover: false,
            tickerStyle: { backgroundColor: '', textColor: '', accentColor: '' },
            tickerContentSource: 'hybrid',
            tickerRealActivities: { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true },
            tickerRealActivityConfig: safeRealConfig,
            tickerHiddenEventIds: state.settings.tickerHiddenEventIds || [],
            tickerDemoAmountRanges: {
                EUR: { min: 50, max: 500 },
                PKR: { min: 5000, max: 50000 },
                USD: { min: 50, max: 500 },
            },
            demoProfiles: [],
            demoActivityTemplates: [],
            notices: [],
            ...state.settings,
            tickerRealActivityTemplates: normalizedTemplates // Override spread to ensure array format
        });
    }, [state.settings]);

    // Handlers
    const handleGenericChange = (field: keyof Settings, value: any) => {
        setLocalSettings(prev => ({...prev, [field]: value}));
        setIsDirty(true);
    };

    const handleStyleChange = (field: 'backgroundColor' | 'textColor' | 'accentColor', value: string) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerStyle: {
                ...prev.tickerStyle,
                [field]: value
            }
        }));
        setIsDirty(true);
    };
    
    const handleAmountRangeChange = (currency: Currency, field: 'min' | 'max', value: string) => {
        const val = parseInt(value) || 0;
        setLocalSettings(prev => ({
            ...prev,
            tickerDemoAmountRanges: {
                ...prev.tickerDemoAmountRanges!,
                [currency]: {
                    ...prev.tickerDemoAmountRanges![currency],
                    [field]: val
                }
            }
        }));
        setIsDirty(true);
    };

    const handleAutoFillRanges = () => {
        if (!window.confirm("This will overwrite current min/max values based on the cheapest and most expensive plans for each currency. Continue?")) return;

        const newRanges = { ...localSettings.tickerDemoAmountRanges };
        let updated = false;

        (['USD', 'EUR', 'PKR'] as Currency[]).forEach(currency => {
            const plans = investmentPlans.filter(p => p.currency === currency && p.status === 'Active');
            if (plans.length > 0) {
                const prices = plans.map(p => p.price);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                newRanges[currency] = { min, max };
                updated = true;
            }
        });

        if (updated) {
            setLocalSettings(prev => ({ ...prev, tickerDemoAmountRanges: newRanges as any }));
            setIsDirty(true);
        } else {
            alert("No active plans found to calculate ranges from.");
        }
    };

    const handleRealActivityChange = (activity: keyof NonNullable<Settings['tickerRealActivities']>) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerRealActivities: {
                ...(prev.tickerRealActivities ?? { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true }),
                [activity]: !(prev.tickerRealActivities?.[activity] ?? false)
            }
        }));
        setIsDirty(true);
    };

    const handleRealConfigChange = (field: keyof NonNullable<Settings['tickerRealActivityConfig']>, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerRealActivityConfig: {
                ...(prev.tickerRealActivityConfig || { minAmount: 0, privacyMode: false, excludedCurrencies: [] }),
                [field]: value
            }
        }));
        setIsDirty(true);
    };

    // New handler for array-based templates
    const handleRealTemplateUpdate = (activityKey: keyof typeof PRESETS, newTemplates: string[]) => {
        setLocalSettings(prev => ({
            ...prev,
            tickerRealActivityTemplates: {
                ...(prev.tickerRealActivityTemplates as any),
                [activityKey]: newTemplates
            }
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await updateSettings(localSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: updated });
            alert('Settings saved successfully!');
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    // Debug View Handlers
    const handleToggleHideEvent = (id: string) => {
        setLocalSettings(prev => {
            const currentHidden = prev.tickerHiddenEventIds || [];
            const newHidden = currentHidden.includes(id) 
                ? currentHidden.filter(hid => hid !== id) 
                : [...currentHidden, id];
            return { ...prev, tickerHiddenEventIds: newHidden };
        });
        setIsDirty(true);
    };

    const handleToggleSelectDebug = (id: string) => {
        setSelectedDebugIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    const handleBulkHide = () => {
        setLocalSettings(prev => {
            const currentHidden = prev.tickerHiddenEventIds || [];
            // Add all selected IDs to hidden list if not already there
            const newHidden = Array.from(new Set([...currentHidden, ...selectedDebugIds]));
            return { ...prev, tickerHiddenEventIds: newHidden };
        });
        setIsDirty(true);
        setSelectedDebugIds([]);
    };

    const handleBulkShow = () => {
        setLocalSettings(prev => {
            const currentHidden = prev.tickerHiddenEventIds || [];
            // Remove all selected IDs from hidden list
            const newHidden = currentHidden.filter(id => !selectedDebugIds.includes(id));
            return { ...prev, tickerHiddenEventIds: newHidden };
        });
        setIsDirty(true);
        setSelectedDebugIds([]);
    };

    const handleOpenProfileModal = (profile: DemoProfile | null) => { setCurrentProfile(profile ? { ...profile } : { name: '', country: countries[0], currency: 'PKR' }); setIsProfileModalOpen(true); };
    const handleSaveProfile = () => { if (!currentProfile?.name) return; const profileToSave: DemoProfile = { _id: currentProfile._id || String(Date.now()), name: currentProfile.name, country: currentProfile.country || 'USA', currency: currentProfile.currency || 'USD' }; setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.some(p => p._id === profileToSave._id) ? prev.demoProfiles.map(p => p._id === profileToSave._id ? profileToSave : p) : [profileToSave, ...(prev.demoProfiles || [])] })); setIsProfileModalOpen(false); setIsDirty(true); };
    const handleDeleteProfile = (id: string) => { if(window.confirm('Delete?')) { setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.filter(p => p._id !== id) })); setIsDirty(true); } };
    const handleBulkDeleteProfiles = () => { if(window.confirm(`Delete ${selectedProfileIds.length}?`)) { setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.filter(p => !selectedProfileIds.includes(p._id)) })); setIsDirty(true); setSelectedProfileIds([]); } };
    const handleBulkEditProfilesSave = () => { setLocalSettings(prev => ({ ...prev, demoProfiles: prev.demoProfiles?.map(p => selectedProfileIds.includes(p._id) ? { ...p, ...bulkEditProfileData } : p) })); setIsDirty(true); setIsBulkEditProfilesModalOpen(false); setSelectedProfileIds([]); setBulkEditProfileData({}); };
    const handleBulkSaveProfiles = () => { const lines = bulkProfileText.split('\n').filter(l=>l.trim()); const newP = lines.map(l => { const [name, country, currency] = l.split(',').map(s=>s.trim()); return { _id: `${Date.now()}-${Math.random()}`, name, country, currency: (currency as Currency)||'USD' }; }).filter(p=>p.name); if(newP.length) { setLocalSettings(prev => ({ ...prev, demoProfiles: [...newP, ...(prev.demoProfiles||[])] })); setIsDirty(true); } setIsBulkProfileModalOpen(false); setBulkProfileText(''); };
    const handleToggleSelectProfile = (id: string) => setSelectedProfileIds(prev => prev.includes(id) ? prev.filter(i => i!==id) : [...prev, id]);
    const handleSelectAllProfiles = (page: DemoProfile[]) => { const ids = page.map(p=>p._id); const all = ids.every(i=>selectedProfileIds.includes(i)); setSelectedProfileIds(prev => all ? prev.filter(i=>!ids.includes(i)) : [...prev, ...ids]); };

    const handleOpenTemplateModal = (t: DemoActivityTemplate | null) => { setBuilderProfileId(''); setIsManualProfile(false); setBuilderAction('joined'); setCurrentTemplate(t ? {...t} : { template: '{name} from {country} just joined!', type: 'joined', enabled: true }); setIsEditingTemplate(!!t); setIsTemplateModalOpen(true); };
    const handleBuilderApply = () => { 
        let newText = '';
        if (builderAction === 'custom') {
             let formatted = builderCustomText;
             if(builderCustomStyle==='success') formatted=`<span class="text-green-600 font-bold">${builderCustomText}</span>`;
             if(builderCustomStyle==='danger') formatted=`<span class="text-red-600 font-bold">${builderCustomText}</span>`;
             if(builderCustomStyle==='info') formatted=`<span class="text-blue-600 font-bold">${builderCustomText}</span>`;
             newText = formatted;
        } else {
             if(builderAction==='joined') newText = `<strong class="font-semibold">{name}</strong> from {country} just joined!`;
             if(builderAction==='deposit') newText = `<strong class="font-semibold">{name}</strong> deposited <strong>{currency} {amount}</strong>`;
             if(builderAction==='withdrawal') newText = `<strong class="font-semibold">{name}</strong> withdrew <strong>{currency} {amount}</strong>`;
             if(builderAction==='plan') newText = `<strong class="font-semibold">{name}</strong> purchased <strong>{plan}</strong>`;
             if(builderAction==='commission') newText = `<strong class="font-semibold">{name}</strong> earned <strong>{currency} {amount}</strong>`;
             if(builderAction==='transfer') newText = `<strong class="font-semibold">{name}</strong> transferred <strong>{currency} {amount}</strong>`;
        }
        setCurrentTemplate(prev => ({ ...prev, template: newText, type: builderAction as any }));
    };
    const handleSaveTemplate = () => { if (!currentTemplate?.template) return; const newT = { ...currentTemplate, _id: currentTemplate._id || String(Date.now()) } as DemoActivityTemplate; setLocalSettings(prev => ({ ...prev, demoActivityTemplates: isEditingTemplate ? prev.demoActivityTemplates?.map(t => t._id === newT._id ? newT : t) : [newT, ...(prev.demoActivityTemplates||[])] })); setIsTemplateModalOpen(false); setIsDirty(true); };
    const handleDeleteTemplate = (id: string) => { if(window.confirm('Delete?')) { setLocalSettings(prev => ({ ...prev, demoActivityTemplates: prev.demoActivityTemplates?.filter(t => t._id !== id) })); setIsDirty(true); } };
    const handleBulkDeleteTemplates = () => { if(window.confirm(`Delete ${selectedTemplateIds.length}?`)) { setLocalSettings(prev => ({ ...prev, demoActivityTemplates: prev.demoActivityTemplates?.filter(t => !selectedTemplateIds.includes(t._id)) })); setIsDirty(true); setSelectedTemplateIds([]); } };
    const handleBulkEditTemplatesSave = () => { setLocalSettings(prev => ({ ...prev, demoActivityTemplates: prev.demoActivityTemplates?.map(t => selectedTemplateIds.includes(t._id) ? { ...t, type: bulkEditTemplateData.type as any || t.type, enabled: bulkEditTemplateData.enabled ? bulkEditTemplateData.enabled==='true' : t.enabled } : t) })); setIsDirty(true); setIsBulkEditTemplatesModalOpen(false); setSelectedTemplateIds([]); setBulkEditTemplateData({}); };
    const handleSaveBulkTemplates = () => { 
        const lines = bulkTemplateText.split('\n').filter(l=>l.trim());
        const newTemplates = lines.map(l => {
            const parts = l.split(':');
            const type = parts.length > 1 ? parts[0].trim() : 'joined';
            const text = parts.length > 1 ? parts.slice(1).join(':').trim() : l.trim();
            return { _id: `${Date.now()}-${Math.random()}`, template: text, type: type as any, enabled: true };
        });
        if(newTemplates.length > 0) {
            setLocalSettings(prev => ({ ...prev, demoActivityTemplates: [...newTemplates, ...(prev.demoActivityTemplates||[])] }));
            setIsDirty(true);
        }
        setIsBulkTemplateModalOpen(false); 
        setBulkTemplateText(''); 
    }; 
    const handleToggleSelectTemplate = (id: string) => setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(i=>i!==id) : [...prev, id]);
    const handleSelectAllTemplates = (page: DemoActivityTemplate[]) => { const ids = page.map(t=>t._id); const all = ids.every(i=>selectedTemplateIds.includes(i)); setSelectedTemplateIds(prev => all ? prev.filter(i=>!ids.includes(i)) : [...prev, ...ids]); };
    const handleInsertVariable = (v: string) => { if (templateTextareaRef.current && currentTemplate) { const t = currentTemplate.template; const start = templateTextareaRef.current.selectionStart; setCurrentTemplate({...currentTemplate, template: t.slice(0,start) + v + t.slice(templateTextareaRef.current.selectionEnd)}); } };
    const handleFormatSelection = (type: string) => { 
        if (templateTextareaRef.current && currentTemplate) { 
            const t = currentTemplate.template; 
            const start = templateTextareaRef.current.selectionStart;
            const end = templateTextareaRef.current.selectionEnd;
            if (start === end) return;
            
            const selectedText = t.slice(start, end);
            let formatted = selectedText;
            
            if (type === 'bold') formatted = `<strong class="font-semibold">${selectedText}</strong>`;
            if (type === 'green') formatted = `<span class="text-green-600">${selectedText}</span>`;
            if (type === 'red') formatted = `<span class="text-red-600">${selectedText}</span>`;
            
            setCurrentTemplate({...currentTemplate, template: t.slice(0,start) + formatted + t.slice(end)}); 
        } 
    };

    const handleOpenNoticeModal = (n: Notice | null) => { setCurrentNotice(n || { message: '', targetType: 'all', enabled: true }); setIsNoticeModalOpen(true); };
    const handleSaveNotice = () => { if(!currentNotice?.message) return; const newN = { ...currentNotice, _id: currentNotice._id || String(Date.now()) } as Notice; setLocalSettings(prev => ({ ...prev, notices: prev.notices?.some(n=>n._id===newN._id) ? prev.notices.map(n=>n._id===newN._id ? newN : n) : [newN, ...(prev.notices||[])] })); setIsNoticeModalOpen(false); setIsDirty(true); };
    const handleDeleteNotice = (id: string) => { if(window.confirm('Delete?')) { setLocalSettings(prev => ({ ...prev, notices: prev.notices?.filter(n=>n._id!==id) })); setIsDirty(true); } };
    
    const handleToggleNoticeUser = (userId: string) => {
        if (!currentNotice) return;
        const ids = currentNotice.targetIds || [];
        const newIds = ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId];
        setCurrentNotice({ ...currentNotice, targetIds: newIds });
    };


    // --- Previews ---
    const previewActivities = useMemo((): Activity[] => {
        // ... (Existing preview logic remains, just update variable replacements) ...
        const activities: Activity[] = [];
        const demoProfiles = localSettings.demoProfiles || [];
        const demoTemplates = (localSettings.demoActivityTemplates || []).filter(t => t.enabled);
        
        // ...
        
        if (localSettings.tickerContentSource !== 'real_only' && demoProfiles.length > 0 && demoTemplates.length > 0) {
            for (let i = 0; i < 15; i++) {
                const template = demoTemplates[i % demoTemplates.length];
                const profile = demoProfiles[i % demoProfiles.length];
                let text = template.template.replace('{name}', `<strong class="font-semibold">${profile.name}</strong>`).replace('{country}', `<strong>${profile.country}</strong>`).replace('{currency}', `<strong>${profile.currency}</strong>`);
                if (text.includes('{amount}')) text = text.replace('{amount}', `<strong>${50}</strong>`); // Simple number for demo
                if (text.includes('{plan}')) text = text.replace('{plan}', `<strong>Standard</strong>`);
                activities.push({ id: `preview-${i}`, type: template.type, text, time: `${i * 2 + 1}m ago` });
            }
        } 
        
        return activities.length > 0 ? activities.sort(() => Math.random() - 0.5) : [{ id: 'empty', type: 'joined', text: 'Add profiles and templates to see preview', time: 'now' }];
    }, [localSettings]);

    // NEW: Computed list of real activities
    const realActivityPreviewList = useMemo(() => {
        let list: { id: string, type: string, description: string, date: string, source: any, isHidden: boolean }[] = [];
        const toggles = localSettings.tickerRealActivities || { deposits: true, withdrawals: true, registrations: true, commissions: true, transfers: true, planPurchases: true };
        const hiddenIds = localSettings.tickerHiddenEventIds || [];
        
        const getTemplates = (key: keyof typeof PRESETS) => {
            const val = (localSettings.tickerRealActivityTemplates as any)?.[key];
            return Array.isArray(val) ? val : [];
        };

        const templates = {
            deposits: getTemplates('deposits'),
            withdrawals: getTemplates('withdrawals'),
            registrations: getTemplates('registrations'),
            commissions: getTemplates('commissions'),
            transfers: getTemplates('transfers'),
            planPurchases: getTemplates('planPurchases')
        };

        const getRandom = (list: string[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';
        const fmt = (amt: number, curr: string) => formatCurrency(amt, curr); // Uses symbol
        const processTemplate = (template: string, replacements: Record<string, string>) => {
            let res = template;
            Object.keys(replacements).forEach(key => {
                res = res.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
            });
            return res;
        };

        // Helper to extract country from user list
        const getCountry = (userId: string) => {
            const user = users.find(u => u._id === userId);
            return user ? user.country : 'Unknown';
        };

        if (toggles.deposits) {
            deposits.filter(d => d.status === 'Approved').slice(0, 10).forEach(d => {
                const tpl = getRandom(templates.deposits);
                const country = getCountry(d.userId);
                if (tpl) list.push({ id: d._id, type: 'Deposit', description: processTemplate(tpl, { name: d.userName, amount: d.amount.toFixed(2), currency: d.currency, country }), date: d.date, source: d, isHidden: hiddenIds.includes(d._id) });
            });
        }
        if (toggles.withdrawals) {
            withdrawals.filter(w => w.status === 'Paid').slice(0, 10).forEach(w => {
                const tpl = getRandom(templates.withdrawals);
                const country = getCountry(w.userId);
                if (tpl) list.push({ id: w._id, type: 'Withdrawal', description: processTemplate(tpl, { name: w.userName, amount: w.amount.toFixed(2), currency: w.currency, country }), date: w.date, source: w, isHidden: hiddenIds.includes(w._id) });
            });
        }
        if (toggles.registrations) {
            users.slice(0, 10).forEach(u => {
                const tpl = getRandom(templates.registrations);
                if (tpl) list.push({ id: u._id, type: 'Registration', description: processTemplate(tpl, { name: u.username, country: u.country, currency: u.currency }), date: u.registrationDate, source: u, isHidden: hiddenIds.includes(u._id) });
            });
        }
        if (toggles.commissions) {
            transactions.filter(t => t.type === 'Commission' && t.status === 'Approved').slice(0, 10).forEach(t => {
                const tpl = getRandom(templates.commissions);
                const country = getCountry(t.userId);
                if (tpl) list.push({ id: t._id, type: 'Commission', description: processTemplate(tpl, { name: t.userName, amount: t.amount.toFixed(2), currency: t.currency, source: 'referral', country }), date: t.date, source: t, isHidden: hiddenIds.includes(t._id) });
            });
        }
        if (toggles.planPurchases) {
            transactions.filter(t => t.type === 'Plan Purchase' && t.status === 'Approved').slice(0, 10).forEach(t => {
                const tpl = getRandom(templates.planPurchases);
                const country = getCountry(t.userId);
                const planName = t.description.replace('Purchased ', '').replace(' plan', '');
                if (tpl) list.push({ id: t._id, type: 'Plan', description: processTemplate(tpl, { name: t.userName, plan: planName, amount: Math.abs(t.amount).toFixed(2), currency: t.currency, country }), date: t.date, source: t, isHidden: hiddenIds.includes(t._id) });
            });
        }
        if (toggles.transfers) {
            transfers.filter(t => t.status === 'Approved').slice(0, 10).forEach(t => {
                const tpl = getRandom(templates.transfers);
                const country = getCountry(t.senderId); // Sender's country
                if (tpl) list.push({ id: t._id, type: 'Transfer', description: processTemplate(tpl, { name: t.senderName, recipient: t.recipientName, amount: t.amount.toFixed(2), currency: t.currency, country }), date: t.date, source: t, isHidden: hiddenIds.includes(t._id) });
            });
        }

        // Apply filters
        if (debugEventType !== 'all') {
            list = list.filter(item => item.type.toLowerCase() === debugEventType.toLowerCase());
        }
        if (debugSearch) {
            const term = debugSearch.toLowerCase();
            list = list.filter(item => 
                item.description.toLowerCase().includes(term) || 
                item.type.toLowerCase().includes(term) ||
                (item.source.userName && item.source.userName.toLowerCase().includes(term))
            );
        }

        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
    }, [localSettings.tickerRealActivities, localSettings.tickerRealActivityTemplates, localSettings.tickerHiddenEventIds, deposits, withdrawals, users, transactions, transfers, debugEventType, debugSearch]);

    // ... (Existing filteredTemplates logic) ...
    const filteredTemplates = (localSettings.demoActivityTemplates || []).filter(t => {
        const matchesSearch = !templateSearch || t.template.toLowerCase().includes(templateSearch.toLowerCase());
        const matchesType = templateTypeFilter === 'all' || t.type === templateTypeFilter;
        return matchesSearch && matchesType;
    });
    
    const paginatedFilteredTemplates = filteredTemplates.slice((templatesCurrentPage - 1) * templatesPerPage, templatesCurrentPage * templatesPerPage);

    // ... (TabButton component) ...
    const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon: React.ReactNode }) => (
        <button 
            onClick={() => setActiveTab(id)} 
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors duration-200 
                ${activeTab === id 
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-800' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    const paginatedProfiles = (localSettings.demoProfiles || []).slice((profilesCurrentPage - 1) * profilesPerPage, profilesCurrentPage * profilesPerPage);
    const builderSelectedProfile = isManualProfile ? (manualProfileName ? { _id: 'manual', name: manualProfileName, country: manualProfileCountry, currency: manualProfileCurrency } as DemoProfile : null) : localSettings.demoProfiles?.find(p => p._id === builderProfileId);
    const builderAvailablePlans = builderSelectedProfile ? investmentPlans.filter(p => p.currency === builderSelectedProfile.currency && p.status === 'Active') : [];

    return (
        <div className="space-y-6">
            {/* Header Area */}
            {/* ... (Existing Header and Live Preview) ... */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        Activity Ticker Manager
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${localSettings.tickerEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {localSettings.tickerEnabled ? 'Active' : 'Disabled'}
                        </span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Configure real-time broadcasts and simulated activity for user dashboards.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || !isDirty} size="lg" className="shadow-lg">
                    <SaveIcon />
                    {isSaving ? 'Saving...' : 'Save All Changes'}
                </Button>
            </div>

            {/* Live Preview Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Live Preview</h3>
                    <span className="text-xs text-gray-500">Updates automatically as you configure</span>
                </div>
                <div className="p-0">
                    <ActivityTicker activities={previewActivities} speed={localSettings.tickerSpeed || 6} pauseOnHover={localSettings.tickerPauseOnHover} style={localSettings.tickerStyle} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700 overflow-hidden min-h-[600px]">
                {/* Navigation Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    <TabButton id="general" label="General Settings" icon={<GeneralIcon />} />
                    <TabButton id="real" label="Real Activity" icon={<RealIcon />} />
                    <TabButton id="templates" label={`Demo Templates (${localSettings.demoActivityTemplates?.length || 0})`} icon={<TemplateIcon />} />
                    <TabButton id="profiles" label={`Demo Profiles (${localSettings.demoProfiles?.length || 0})`} icon={<ProfileIcon />} />
                    <TabButton id="notices" label={`Notices (${localSettings.notices?.length || 0})`} icon={<NoticeIcon />} />
                </div>

                <div className="p-6">
                    {/* CONTENT: GENERAL */}
                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                            <div className="space-y-6">
                                <section>
                                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Behavior & Styling</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                            <div>
                                                <div className="font-medium">Enable Ticker</div>
                                                <div className="text-xs text-gray-500">Show the ticker on user dashboards</div>
                                            </div>
                                            <ToggleSwitch checked={localSettings.tickerEnabled ?? true} onChange={() => handleGenericChange('tickerEnabled', !localSettings.tickerEnabled)} />
                                        </div>
                                        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                            <div>
                                                <div className="font-medium">Pause on Hover</div>
                                                <div className="text-xs text-gray-500">Stop scrolling when mouse is over</div>
                                            </div>
                                            <ToggleSwitch checked={localSettings.tickerPauseOnHover ?? false} onChange={() => handleGenericChange('tickerPauseOnHover', !localSettings.tickerPauseOnHover)} />
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                                            <label className="block text-sm font-medium mb-2">Scroll Speed ({localSettings.tickerSpeed}s)</label>
                                            <input type="range" min="2" max="20" step="1" value={localSettings.tickerSpeed} onChange={(e) => handleGenericChange('tickerSpeed', parseInt(e.target.value))} className="w-full accent-blue-600" />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Fast</span><span>Slow</span></div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Color Theme</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Background</label>
                                            <div className="flex items-center gap-2 p-2 border rounded dark:border-gray-600">
                                                <input type="color" value={localSettings.tickerStyle?.backgroundColor || '#ffffff'} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer p-0" />
                                                <span className="text-xs font-mono">{localSettings.tickerStyle?.backgroundColor || 'Default'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Text</label>
                                            <div className="flex items-center gap-2 p-2 border rounded dark:border-gray-600">
                                                <input type="color" value={localSettings.tickerStyle?.textColor || '#000000'} onChange={(e) => handleStyleChange('textColor', e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer p-0" />
                                                <span className="text-xs font-mono">{localSettings.tickerStyle?.textColor || 'Default'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Highlights</label>
                                            <div className="flex items-center gap-2 p-2 border rounded dark:border-gray-600">
                                                <input type="color" value={localSettings.tickerStyle?.accentColor || '#000000'} onChange={(e) => handleStyleChange('accentColor', e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer p-0" />
                                                <span className="text-xs font-mono">{localSettings.tickerStyle?.accentColor || 'Default'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-6">
                                <section>
                                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Data Source Strategy</h4>
                                    <div className="space-y-3">
                                        {[{ id: 'hybrid', label: 'Hybrid (Recommended)', desc: 'Mixes real user activity with simulated data for a busy look.' }, { id: 'real_only', label: 'Real Activity Only', desc: 'Shows only actual events. Ticker may be empty if traffic is low.' }, { id: 'demo_only', label: 'Demo Data Only', desc: 'Completely simulated. Good for new launches.' }].map(opt => (
                                            <label key={opt.id} className={`flex items-start p-4 rounded-lg border cursor-pointer transition-all ${localSettings.tickerContentSource === opt.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/20 dark:border-blue-500' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-gray-300'}`}>
                                                <input type="radio" name="source" value={opt.id} checked={localSettings.tickerContentSource === opt.id} onChange={() => handleGenericChange('tickerContentSource', opt.id)} className="mt-1 text-blue-600 focus:ring-blue-500" />
                                                <div className="ml-3">
                                                    <span className="block text-sm font-bold text-gray-900 dark:text-white">{opt.label}</span>
                                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-lg font-bold text-gray-800 dark:text-white">Demo Amount Ranges</h4>
                                        <button onClick={handleAutoFillRanges} className="text-xs text-blue-600 hover:underline">Auto-fill from Plans</button>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                                        <p className="text-xs text-gray-500 mb-4">Used for simulating random transfer amounts. Other activities follow plan prices.</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            {(['USD', 'EUR', 'PKR'] as Currency[]).map(curr => (
                                                <div key={curr} className="flex items-center justify-between">
                                                    <span className="font-mono font-bold w-12">{curr}</span>
                                                    <div className="flex items-center gap-2 flex-grow">
                                                        <input type="number" value={localSettings.tickerDemoAmountRanges?.[curr].min} onChange={(e) => handleAmountRangeChange(curr, 'min', e.target.value)} className="w-full text-sm rounded border-gray-300 dark:bg-gray-800 dark:border-gray-600 p-1.5" placeholder="Min" />
                                                        <span className="text-gray-400">-</span>
                                                        <input type="number" value={localSettings.tickerDemoAmountRanges?.[curr].max} onChange={(e) => handleAmountRangeChange(curr, 'max', e.target.value)} className="w-full text-sm rounded border-gray-300 dark:bg-gray-800 dark:border-gray-600 p-1.5" placeholder="Max" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* CONTENT: REAL ACTIVITY */}
                    {activeTab === 'real' && (
                        <div className="animate-fade-in space-y-8">
                            
                            {/* ... Global Config Panel ... */}
                            <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/30 dark:to-gray-800 p-6 rounded-lg border dark:border-gray-700">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <ShieldCheckIcon />
                                            Global Real Activity Settings
                                        </h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Control privacy and filters for all real events displayed in the ticker.</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-600 shadow-sm">
                                        <div>
                                            <div className="font-bold text-gray-800 dark:text-white">Privacy Mode (Mask Names)</div>
                                            <div className="text-xs text-gray-500">Show names as "John D." instead of "John Doe"</div>
                                        </div>
                                        <ToggleSwitch 
                                            checked={!!localSettings.tickerRealActivityConfig?.privacyMode} 
                                            onChange={() => handleRealConfigChange('privacyMode', !localSettings.tickerRealActivityConfig?.privacyMode)} 
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-600 shadow-sm">
                                        <div>
                                            <div className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                <FilterIcon />
                                                Minimum Transaction Amount
                                            </div>
                                            <div className="text-xs text-gray-500">Hide small transactions below this value</div>
                                        </div>
                                        <input 
                                            type="number" 
                                            className="w-24 text-sm font-mono font-bold text-right p-2 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-700" 
                                            value={localSettings.tickerRealActivityConfig?.minAmount || 0}
                                            onChange={(e) => handleRealConfigChange('minAmount', parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Event Types & Templates</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <RealActivityCard 
                                        item={{ id: 'deposits', label: 'Deposits', icon: <DepositIcon /> }}
                                        isActive={!!localSettings.tickerRealActivities?.deposits}
                                        templates={(localSettings.tickerRealActivityTemplates as any)?.deposits || []}
                                        onToggle={handleRealActivityChange}
                                        onUpdateTemplates={handleRealTemplateUpdate}
                                        variables={['{name}', '{amount}', '{currency}', '{country}']}
                                    />
                                    <RealActivityCard 
                                        item={{ id: 'withdrawals', label: 'Withdrawals', icon: <WithdrawalIcon /> }}
                                        isActive={!!localSettings.tickerRealActivities?.withdrawals}
                                        templates={(localSettings.tickerRealActivityTemplates as any)?.withdrawals || []}
                                        onToggle={handleRealActivityChange}
                                        onUpdateTemplates={handleRealTemplateUpdate}
                                        variables={['{name}', '{amount}', '{currency}', '{country}']}
                                    />
                                    <RealActivityCard 
                                        item={{ id: 'registrations', label: 'Registrations', icon: <UsersIcon /> }}
                                        isActive={!!localSettings.tickerRealActivities?.registrations}
                                        templates={(localSettings.tickerRealActivityTemplates as any)?.registrations || []}
                                        onToggle={handleRealActivityChange}
                                        onUpdateTemplates={handleRealTemplateUpdate}
                                        variables={['{name}', '{country}', '{currency}']}
                                    />
                                    <RealActivityCard 
                                        item={{ id: 'commissions', label: 'Commissions', icon: <EarningsIcon /> }}
                                        isActive={!!localSettings.tickerRealActivities?.commissions}
                                        templates={(localSettings.tickerRealActivityTemplates as any)?.commissions || []}
                                        onToggle={handleRealActivityChange}
                                        onUpdateTemplates={handleRealTemplateUpdate}
                                        variables={['{name}', '{amount}', '{currency}', '{source}', '{country}']}
                                    />
                                    <RealActivityCard 
                                        item={{ id: 'transfers', label: 'Transfers', icon: <TransferIcon /> }}
                                        isActive={!!localSettings.tickerRealActivities?.transfers}
                                        templates={(localSettings.tickerRealActivityTemplates as any)?.transfers || []}
                                        onToggle={handleRealActivityChange}
                                        onUpdateTemplates={handleRealTemplateUpdate}
                                        variables={['{name}', '{amount}', '{currency}', '{recipient}', '{country}']}
                                    />
                                    <RealActivityCard 
                                        item={{ id: 'planPurchases', label: 'Plan Purchases', icon: <PlanIcon /> }}
                                        isActive={!!localSettings.tickerRealActivities?.planPurchases}
                                        templates={(localSettings.tickerRealActivityTemplates as any)?.planPurchases || []}
                                        onToggle={handleRealActivityChange}
                                        onUpdateTemplates={handleRealTemplateUpdate}
                                        variables={['{name}', '{plan}', '{amount}', '{currency}', '{country}']}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-4 gap-4">
                                    <div className="flex items-center gap-4">
                                        <h4 className="text-lg font-bold text-gray-800 dark:text-white">Recent Real Events (Debug View)</h4>
                                        {selectedDebugIds.length > 0 && (
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="danger" onClick={handleBulkHide} className="text-xs py-1">
                                                    <EyeOffIcon /> Hide Selected ({selectedDebugIds.length})
                                                </Button>
                                                <Button size="sm" variant="success" onClick={handleBulkShow} className="text-xs py-1">
                                                    <EyeIcon /> Show Selected ({selectedDebugIds.length})
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <select 
                                            className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-sm rounded-md p-2 w-full sm:w-auto"
                                            value={debugEventType}
                                            onChange={e => setDebugEventType(e.target.value)}
                                        >
                                            <option value="all">All Events</option>
                                            <option value="deposit">Deposits</option>
                                            <option value="withdrawal">Withdrawals</option>
                                            <option value="registration">Registrations</option>
                                            <option value="commission">Commissions</option>
                                            <option value="plan">Plan Purchases</option>
                                        </select>
                                        <div className="relative w-full sm:w-auto">
                                            <input 
                                                type="text" 
                                                placeholder="Search events..." 
                                                className="pl-8 bg-white dark:bg-gray-800 border dark:border-gray-700 text-sm rounded-md p-2 w-full"
                                                value={debugSearch}
                                                onChange={e => setDebugSearch(e.target.value)}
                                            />
                                            <div className="absolute left-2.5 top-2.5"><SearchIcon /></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="border rounded-lg overflow-hidden dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-b dark:border-gray-700">
                                            <tr>
                                                <th className="px-4 py-3 w-10 text-center">
                                                    {/* Optional Select All */}
                                                </th>
                                                <th className="px-6 py-3 font-semibold">Event Type</th>
                                                <th className="px-6 py-3 font-semibold">Message Preview</th>
                                                <th className="px-6 py-3 font-semibold text-center">Ticker Status</th>
                                                <th className="px-6 py-3 font-semibold text-right">Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-700">
                                            {realActivityPreviewList.length > 0 ? realActivityPreviewList.map((item, idx) => (
                                                <tr key={idx} className={`transition-colors ${item.isHidden ? 'bg-red-50 dark:bg-red-900/10 opacity-70' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                                    <td className="px-4 py-3 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedDebugIds.includes(item.id)}
                                                            onChange={() => handleToggleSelectDebug(item.id)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{__html: item.description}}></td>
                                                    <td className="px-6 py-3 text-center">
                                                        <button 
                                                            onClick={() => handleToggleHideEvent(item.id)}
                                                            className={`text-xs font-bold px-2 py-1 rounded border transition-all ${
                                                                item.isHidden 
                                                                ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' 
                                                                : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                                            }`}
                                                        >
                                                            {item.isHidden ? (
                                                                <span className="flex items-center gap-1"><EyeOffIcon /> Hidden</span>
                                                            ) : (
                                                                <span className="flex items-center gap-1"><EyeIcon /> Visible</span>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-xs text-gray-500 font-mono">{new Date(item.date).toLocaleString()}</td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">No recent matching events found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... (Other Tabs Remain Unchanged) ... */}
                    {activeTab === 'templates' && (
                        <div className="space-y-4 animate-fade-in">
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">Simulated Messages (Demo)</h4>
                                    <p className="text-sm text-gray-500">Templates used for fake activity generation when using Hybrid or Demo mode.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedTemplateIds.length > 0 && (
                                        <>
                                            <Button size="sm" variant="secondary" onClick={() => setIsBulkEditTemplatesModalOpen(true)}>Edit Selected</Button>
                                            <Button size="sm" variant="danger" onClick={handleBulkDeleteTemplates}>Delete ({selectedTemplateIds.length})</Button>
                                        </>
                                    )}
                                    <Button size="sm" variant="secondary" onClick={()=>setIsBulkTemplateModalOpen(true)}>Bulk Import</Button>
                                    <Button size="sm" onClick={()=>handleOpenTemplateModal(null)}>+ Builder</Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4 items-center">
                                <div className="relative flex-grow max-w-md">
                                    <input 
                                        type="text" 
                                        placeholder="Search templates content..." 
                                        className="pl-8 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm py-2"
                                        value={templateSearch}
                                        onChange={e => setTemplateSearch(e.target.value)}
                                    />
                                    <div className="absolute left-2.5 top-2.5"><SearchIcon /></div>
                                </div>
                                <select 
                                    className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-sm py-2"
                                    value={templateTypeFilter}
                                    onChange={e => setTemplateTypeFilter(e.target.value)}
                                >
                                    <option value="all">All Types</option>
                                    <option value="joined">Joined</option>
                                    <option value="deposit">Deposit</option>
                                    <option value="withdrawal">Withdrawal</option>
                                    <option value="commission">Commission</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="plan">Plan</option>
                                </select>
                            </div>

                            <div className="border rounded-lg overflow-hidden dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                                 <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="rounded" checked={paginatedFilteredTemplates.length > 0 && paginatedFilteredTemplates.every(t=>selectedTemplateIds.includes(t._id))} onChange={()=>handleSelectAllTemplates(paginatedFilteredTemplates)} /></th>
                                            <th className="px-4 py-3">Template Preview</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {paginatedFilteredTemplates.map(t=>(
                                            <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded" checked={selectedTemplateIds.includes(t._id)} onChange={()=>handleToggleSelectTemplate(t._id)}/></td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{__html: t.template}}></td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded border ${
                                                        t.type === 'withdrawal' || t.type === 'transfer' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:border-red-900 dark:text-red-300' :
                                                        t.type === 'deposit' || t.type === 'commission' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:border-green-900 dark:text-green-300' :
                                                        'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:border-blue-900 dark:text-blue-300'
                                                    }`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`w-3 h-3 inline-block rounded-full ${t.enabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={()=>handleOpenTemplateModal(t)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-3 transition-colors"><EditIcon /></button>
                                                    <button onClick={()=>handleDeleteTemplate(t._id)} className="text-red-500 hover:text-red-700 transition-colors"><TrashIcon /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {paginatedFilteredTemplates.length === 0 && <div className="p-8 text-center text-gray-500">No templates found matching your filters.</div>}
                            </div>
                             <div className="flex justify-between items-center pt-2">
                                <span className="text-xs text-gray-500">Showing {Math.min(filteredTemplates.length, (templatesCurrentPage-1)*templatesPerPage+1)} - {Math.min(filteredTemplates.length, templatesCurrentPage*templatesPerPage)} of {filteredTemplates.length}</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" disabled={templatesCurrentPage === 1} onClick={() => setTemplatesCurrentPage(p => p - 1)}>Prev</Button>
                                    <Button size="sm" variant="secondary" disabled={paginatedFilteredTemplates.length < templatesPerPage} onClick={() => setTemplatesCurrentPage(p => p + 1)}>Next</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... (Profiles and Notices Tabs remain unchanged) ... */}
                    {activeTab === 'profiles' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">Manage Profiles</h4>
                                    <p className="text-sm text-gray-500">Fake user identities used for simulated activity.</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedProfileIds.length > 0 && (
                                        <>
                                            <Button size="sm" variant="secondary" onClick={() => setIsBulkEditProfilesModalOpen(true)}>Edit Selected</Button>
                                            <Button size="sm" variant="danger" onClick={handleBulkDeleteProfiles}>Delete ({selectedProfileIds.length})</Button>
                                        </>
                                    )}
                                    <Button size="sm" variant="secondary" onClick={()=>setIsBulkProfileModalOpen(true)}>Bulk CSV Import</Button>
                                    <Button size="sm" onClick={()=>handleOpenProfileModal(null)}>+ New Profile</Button>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden dark:border-gray-700 shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="rounded" checked={paginatedProfiles.length > 0 && paginatedProfiles.every(p=>selectedProfileIds.includes(p._id))} onChange={()=>handleSelectAllProfiles(paginatedProfiles)} /></th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Country</th>
                                            <th className="px-4 py-3">Currency</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
                                        {paginatedProfiles.map(p=>(
                                            <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded" checked={selectedProfileIds.includes(p._id)} onChange={()=>handleToggleSelectProfile(p._id)}/></td>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.country}</td>
                                                <td className="px-4 py-3"><Badge status={p.currency}/></td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={()=>handleOpenProfileModal(p)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-3 transition-colors"><EditIcon /></button>
                                                    <button onClick={()=>handleDeleteProfile(p._id)} className="text-red-500 hover:text-red-700 transition-colors"><TrashIcon /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {paginatedProfiles.length === 0 && <div className="p-8 text-center text-gray-500">No profiles found.</div>}
                            </div>
                            
                            {/* Pagination */}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-xs text-gray-500">Showing {Math.min(localSettings.demoProfiles?.length||0, (profilesCurrentPage-1)*profilesPerPage+1)} - {Math.min(localSettings.demoProfiles?.length||0, profilesCurrentPage*profilesPerPage)} of {localSettings.demoProfiles?.length||0}</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" disabled={profilesCurrentPage === 1} onClick={() => setProfilesCurrentPage(p => p - 1)}>Prev</Button>
                                    <Button size="sm" variant="secondary" disabled={paginatedProfiles.length < profilesPerPage} onClick={() => setProfilesCurrentPage(p => p + 1)}>Next</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTENT: NOTICES */}
                    {activeTab === 'notices' && (
                        <div className="space-y-4 animate-fade-in">
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-600">
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">System Notices</h4>
                                    <p className="text-sm text-gray-500">Banners displayed at the top of user dashboards.</p>
                                </div>
                                <Button size="sm" onClick={()=>handleOpenNoticeModal(null)}><PlusIcon /> Add Notice</Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {(localSettings.notices||[]).map(n => (
                                    <div key={n._id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-2 items-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${n.color==='danger'?'bg-red-100 text-red-800': n.color==='success'?'bg-green-100 text-green-800': n.color==='warning'?'bg-yellow-100 text-yellow-800':'bg-blue-100 text-blue-800'}`}>
                                                    {n.color}
                                                </span>
                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 capitalize">{n.style}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={()=>handleOpenNoticeModal(n)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1"><EditIcon/></button>
                                                <button onClick={()=>handleDeleteNotice(n._id)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon/></button>
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-white mb-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded border dark:border-gray-700 border-l-4 border-l-gray-300">
                                            {n.message}
                                        </p>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span>Target: <strong>{n.targetType}</strong></span>
                                            <span className={`flex items-center gap-1 font-bold ${n.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                                                <span className={`w-2 h-2 rounded-full ${n.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                                {n.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {(localSettings.notices||[]).length === 0 && <div className="text-center py-8 text-gray-500 italic">No active notices.</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS - Reusing existing Profile, Template, Notice, Bulk Modals */}
            {/* ... (Existing Profile Modal) ... */}
            {isProfileModalOpen && currentProfile && (
                <Modal isOpen={true} onClose={() => setIsProfileModalOpen(false)}>
                    <div className="p-4 w-96">
                        <h3 className="text-lg font-bold mb-4">{currentProfile._id ? 'Edit Profile' : 'Add Profile'}</h3>
                        <div className="space-y-3">
                            <input className="w-full border rounded p-2 dark:bg-gray-700" placeholder="Name (e.g. John Doe)" value={currentProfile.name} onChange={e => setCurrentProfile({...currentProfile, name: e.target.value})} />
                            <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentProfile.country} onChange={e => setCurrentProfile({...currentProfile, country: e.target.value})}>
                                {countries.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentProfile.currency} onChange={e => setCurrentProfile({...currentProfile, currency: e.target.value as Currency})}>
                                <option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option>
                            </select>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveProfile}>Save</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ... (Existing Template Builder Modal) ... */}
            {isTemplateModalOpen && currentTemplate && (
                <Modal isOpen={true} onClose={() => setIsTemplateModalOpen(false)}>
                    {/* ... (Modal content for template builder) ... */}
                    <div className="p-6 w-[600px] max-w-full">
                        <h3 className="text-xl font-bold mb-4">{currentTemplate._id ? 'Edit Template' : 'Add Template'}</h3>
                        
                        {/* VISUAL BUILDER SECTION */}
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600">
                            {/* ... (Existing Builder UI) ... */}
                            <h4 className="text-sm font-bold uppercase text-blue-600 dark:text-blue-400 mb-3">Template Builder</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-500">1. Actor Profile</label>
                                        {builderAction !== 'custom' && (
                                            <button 
                                                type="button" 
                                                onClick={() => setIsManualProfile(!isManualProfile)} 
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                {isManualProfile ? 'Select Existing' : 'Enter Manually'}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {builderAction === 'custom' ? (
                                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border dark:border-gray-600 text-xs text-gray-500 italic text-center">
                                            Not applicable for custom text
                                        </div>
                                    ) : !isManualProfile ? (
                                        <select 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            value={builderProfileId}
                                            onChange={e => {
                                                setBuilderProfileId(e.target.value);
                                                setBuilderPlanId(''); // Reset dependent fields
                                            }}
                                        >
                                            <option value="">-- Select Profile --</option>
                                            {localSettings.demoProfiles?.map(p => (
                                                <option key={p._id} value={p._id}>{p.name} ({p.country} - {p.currency})</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="space-y-2 p-2 bg-white dark:bg-gray-800 border rounded dark:border-gray-600">
                                            <input 
                                                className="w-full text-xs rounded border p-1 dark:bg-gray-700 dark:border-gray-500" 
                                                placeholder="Name (e.g. John)" 
                                                value={manualProfileName}
                                                onChange={e => setManualProfileName(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <select 
                                                    className="w-2/3 text-xs rounded border p-1 dark:bg-gray-700 dark:border-gray-500"
                                                    value={manualProfileCountry}
                                                    onChange={e => setManualProfileCountry(e.target.value)}
                                                >
                                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <select 
                                                    className="w-1/3 text-xs rounded border p-1 dark:bg-gray-700 dark:border-gray-500"
                                                    value={manualProfileCurrency}
                                                    onChange={e => {
                                                        setManualProfileCurrency(e.target.value as Currency);
                                                        setBuilderPlanId('');
                                                    }}
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="PKR">PKR</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">2. Event Type</label>
                                    <select 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                        value={builderAction}
                                        onChange={e => setBuilderAction(e.target.value)}
                                    >
                                        <option value="joined">New Registration</option>
                                        <option value="deposit">Deposit</option>
                                        <option value="withdrawal">Withdrawal</option>
                                        <option value="plan">Plan Purchase</option>
                                        <option value="commission">Commission</option>
                                        <option value="transfer">Transfer</option>
                                        <option value="custom">Custom Text / Announcement</option>
                                    </select>
                                </div>
                            </div>

                            {/* DYNAMIC FIELDS BASED ON ACTION */}
                            {(builderAction === 'deposit' || builderAction === 'withdrawal' || builderAction === 'plan' || builderAction === 'commission') && (
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">
                                        3. Select Plan Amount ({builderSelectedProfile?.currency || 'Select Profile First'})
                                    </label>
                                    <select 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                        value={builderPlanId}
                                        onChange={e => setBuilderPlanId(e.target.value)}
                                        disabled={!builderSelectedProfile}
                                    >
                                        <option value="">-- Select Plan --</option>
                                        {builderAvailablePlans.map(p => (
                                            <option key={p._id} value={p._id}>{p.name} - {formatCurrency(p.price, p.currency)}</option>
                                        ))}
                                        {builderSelectedProfile && builderAvailablePlans.length === 0 && <option disabled>No active plans found for {builderSelectedProfile.currency}</option>}
                                    </select>
                                </div>
                            )}

                            {builderAction === 'commission' && builderPlanId && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-gray-500">4. Commission Type</label>
                                        <select 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            value={builderCommissionType}
                                            onChange={e => setBuilderCommissionType(e.target.value as 'direct' | 'indirect')}
                                        >
                                            <option value="direct">Direct (Level 1)</option>
                                            <option value="indirect">Indirect (Level 2+)</option>
                                        </select>
                                    </div>
                                    {builderCommissionType === 'indirect' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-1 text-gray-500">5. Select Level</label>
                                            <select 
                                                className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                                value={builderIndirectLevel}
                                                onChange={e => setBuilderIndirectLevel(e.target.value)}
                                            >
                                                {(() => {
                                                    const plan = investmentPlans.find(p => p._id === builderPlanId);
                                                    if (!plan || !plan.indirectCommissions || plan.indirectCommissions.length === 0) {
                                                        return <option value="0">No indirect levels configured</option>;
                                                    }
                                                    return plan.indirectCommissions.map((_, idx) => (
                                                        <option key={idx} value={idx}>Level {idx + 2}</option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {builderAction === 'transfer' && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-gray-500">3. Random Amount</label>
                                        <input 
                                            type="number" 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            placeholder="e.g. 50"
                                            value={builderTransferAmount}
                                            onChange={e => setBuilderTransferAmount(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-gray-500">4. Recipient</label>
                                        <select 
                                            className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                            value={builderRecipientId}
                                            onChange={e => setBuilderRecipientId(e.target.value)}
                                        >
                                            <option value="">-- Select Recipient --</option>
                                            {localSettings.demoProfiles?.filter(p => isManualProfile || p._id !== builderProfileId).map(p => (
                                                <option key={p._id} value={p._id}>{p.name} ({p.country})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {builderAction === 'custom' && (
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">3. Custom Text Content</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600 mb-2"
                                        placeholder="e.g. System maintenance scheduled for tonight."
                                        value={builderCustomText}
                                        onChange={e => setBuilderCustomText(e.target.value)}
                                    />
                                    <label className="block text-xs font-semibold mb-1 text-gray-500">4. Styling</label>
                                    <select 
                                        className="w-full rounded text-sm p-2 border dark:bg-gray-800 dark:border-gray-600"
                                        value={builderCustomStyle}
                                        onChange={e => setBuilderCustomStyle(e.target.value as any)}
                                    >
                                        <option value="none">None (Plain Text)</option>
                                        <option value="success">Success (Green Text)</option>
                                        <option value="danger">Alert (Red Text)</option>
                                        <option value="info">Info (Blue Text)</option>
                                    </select>
                                </div>
                            )}

                            <Button onClick={handleBuilderApply} size="sm" className="w-full" disabled={builderAction !== 'custom' && !builderSelectedProfile}>
                                Generate Template Text from Selection
                            </Button>
                        </div>

                        {/* RAW EDIT SECTION */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Generated / Editable Template Text</label>
                            
                            {/* Formatting Toolbar */}
                            <div className="flex flex-wrap items-center gap-2 mb-2 p-1 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
                                <span className="text-xs font-bold text-gray-400 uppercase mr-2 ml-1">Insert:</span>
                                {['{name}', '{amount}', '{country}', '{plan}', '{currency}'].map(variable => (
                                    <button 
                                        key={variable} 
                                        onClick={() => handleInsertVariable(variable)}
                                        className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        {variable}
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                <span className="text-xs font-bold text-gray-400 uppercase mr-2">Format:</span>
                                <button onClick={() => handleFormatSelection('bold')} className="px-2 py-1 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Bold Selection">B</button>
                                <button onClick={() => handleFormatSelection('green')} className="px-2 py-1 text-xs font-bold text-green-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Green Color">A</button>
                                <button onClick={() => handleFormatSelection('red')} className="px-2 py-1 text-xs font-bold text-red-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Red Color">A</button>
                            </div>

                            <textarea 
                                ref={templateTextareaRef}
                                className="w-full border rounded p-2 dark:bg-gray-700 h-24 font-mono text-sm" 
                                value={currentTemplate.template} 
                                onChange={e => setCurrentTemplate({...currentTemplate, template: e.target.value})}
                            />
                            <p className="text-xs text-gray-500 mt-1">HTML tags like &lt;strong&gt; are allowed for styling.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Assigned Type</label>
                            <select 
                                className="w-full border rounded p-2 dark:bg-gray-700" 
                                value={currentTemplate.type} 
                                onChange={e => setCurrentTemplate({...currentTemplate, type: e.target.value as any})}
                            >
                                <option value="joined">New User Joined</option>
                                <option value="deposit">Deposit</option>
                                <option value="withdrawal">Withdrawal</option>
                                <option value="transfer">Transfer</option>
                                <option value="plan">Plan Purchase</option>
                                <option value="commission">Commission Earned</option>
                            </select>
                        </div>

                        <div className="mt-6 flex justify-end gap-2 border-t pt-4 dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveTemplate}>Save Template</Button>
                        </div>
                    </div>
                </Modal>
            )}
            {/* ... Other Modals ... */}
            {isBulkProfileModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkProfileModalOpen(false)}>
                    <div className="p-4 w-[600px] max-w-full"><h3 className="text-lg font-bold mb-2">Bulk Add Profiles</h3><textarea className="w-full border rounded p-2 h-48 dark:bg-gray-700 font-mono text-sm" placeholder={`John Doe, USA, USD\nAli Khan, Pakistan, PKR\nMaria, Germany, EUR`} value={bulkProfileText} onChange={e => setBulkProfileText(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkProfileModalOpen(false)}>Cancel</Button><Button onClick={handleBulkSaveProfiles}>Add Profiles</Button></div></div>
                </Modal>
            )}
             {isBulkTemplateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkTemplateModalOpen(false)}>
                    <div className="p-4 w-[600px] max-w-full"><h3 className="text-lg font-bold mb-2">Bulk Add Templates</h3><textarea className="w-full border rounded p-2 h-48 dark:bg-gray-700 font-mono text-sm" placeholder={`joined: {name} from {country} joined!\ndeposit: {name} deposited {amount}.`} value={bulkTemplateText} onChange={e => setBulkTemplateText(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkTemplateModalOpen(false)}>Cancel</Button><Button onClick={handleSaveBulkTemplates}>Add Templates</Button></div></div>
                </Modal>
            )}
            {isBulkEditProfilesModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkEditProfilesModalOpen(false)}>
                    <div className="p-4 w-96"><h3 className="text-lg font-bold mb-4">Bulk Edit</h3><div className="space-y-3"><div><label className="text-xs font-bold">Set Country</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditProfileData.country || ''} onChange={e => setBulkEditProfileData({...bulkEditProfileData, country: e.target.value})}><option value="">-- No Change --</option>{countries.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="text-xs font-bold">Set Currency</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditProfileData.currency || ''} onChange={e => setBulkEditProfileData({...bulkEditProfileData, currency: e.target.value as Currency})}><option value="">-- No Change --</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="PKR">PKR</option></select></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkEditProfilesModalOpen(false)}>Cancel</Button><Button onClick={handleBulkEditProfilesSave}>Apply Changes</Button></div></div>
                </Modal>
            )}
            {isBulkEditTemplatesModalOpen && (
                <Modal isOpen={true} onClose={() => setIsBulkEditTemplatesModalOpen(false)}>
                    <div className="p-4 w-96"><h3 className="text-lg font-bold mb-4">Bulk Edit Templates</h3><div className="space-y-3"><div><label className="text-xs font-bold">Set Type</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditTemplateData.type || ''} onChange={e => setBulkEditTemplateData({...bulkEditTemplateData, type: e.target.value})}><option value="">-- No Change --</option><option value="joined">New User Joined</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="transfer">Transfer</option><option value="plan">Plan Purchase</option><option value="commission">Commission Earned</option></select></div><div><label className="text-xs font-bold">Set Status</label><select className="w-full border rounded p-2 dark:bg-gray-700" value={bulkEditTemplateData.enabled || ''} onChange={e => setBulkEditTemplateData({...bulkEditTemplateData, enabled: e.target.value})}><option value="">-- No Change --</option><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsBulkEditTemplatesModalOpen(false)}>Cancel</Button><Button onClick={handleBulkEditTemplatesSave}>Apply Changes</Button></div></div>
                </Modal>
            )}
            
            {/* Notice Modal */}
            {isNoticeModalOpen && currentNotice && (
                <Modal isOpen={true} onClose={() => setIsNoticeModalOpen(false)}>
                    <div className="p-4 w-[500px]">
                        <h3 className="text-lg font-bold mb-4">{currentNotice._id ? 'Edit Notice' : 'Add Notice'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Message</label>
                                <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows={3} value={currentNotice.message} onChange={e => setCurrentNotice({...currentNotice, message: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Color</label>
                                    <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentNotice.color} onChange={e => setCurrentNotice({...currentNotice, color: e.target.value as any})}>
                                        <option value="info">Info (Blue)</option><option value="success">Success (Green)</option><option value="warning">Warning (Yellow)</option><option value="danger">Danger (Red)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Style</label>
                                    <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentNotice.style} onChange={e => setCurrentNotice({...currentNotice, style: e.target.value as any})}>
                                        <option value="sliding">Sliding (Marquee)</option><option value="static">Static</option><option value="blinking">Blinking</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Target Audience</label>
                                <select className="w-full border rounded p-2 dark:bg-gray-700" value={currentNotice.targetType} onChange={e => setCurrentNotice({...currentNotice, targetType: e.target.value as any, targetIds: []})}>
                                    <option value="all">All Users</option><option value="plan">Users with Specific Plan</option><option value="inactive">Inactive Users</option><option value="manual">Specific Users (Manual)</option>
                                </select>
                            </div>
                            {currentNotice.targetType === 'plan' && (
                                <div><label className="block text-xs font-medium text-gray-500 mb-1">Select Plans</label><select multiple className="w-full border rounded p-2 dark:bg-gray-700 h-24 text-sm" value={currentNotice.targetIds} onChange={e => setCurrentNotice({...currentNotice, targetIds: Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value)})}>{investmentPlans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
                            )}
                            {currentNotice.targetType === 'manual' && (
                                <div><input className="w-full border rounded p-2 dark:bg-gray-700 text-sm mb-2" placeholder="Search user..." value={manualUserSearch} onChange={e => setManualUserSearch(e.target.value)} /><div className="max-h-32 overflow-y-auto border rounded p-2 dark:bg-gray-700">{users.filter(u => !manualUserSearch || u.username.includes(manualUserSearch)).map(u => <div key={u._id} className="flex items-center gap-2 mb-1"><input type="checkbox" checked={currentNotice.targetIds?.includes(u._id)} onChange={() => handleToggleNoticeUser(u._id)} /> <span className="text-sm">{u.username}</span></div>)}</div></div>
                            )}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Status:</label>
                                <ToggleSwitch checked={currentNotice.enabled !== false} onChange={() => setCurrentNotice({...currentNotice, enabled: !currentNotice.enabled})} />
                                <span className="text-sm">{currentNotice.enabled !== false ? 'Active' : 'Disabled'}</span>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsNoticeModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveNotice}>Save Notice</Button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};

export default TickerSettings;
