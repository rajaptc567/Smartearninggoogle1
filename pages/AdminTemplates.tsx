import React, { useState, useEffect, useMemo } from 'react';
import { 
    getTemplates, 
    updateTemplate, 
    resetTemplatesToDefault,
    bulkUpdateTemplates,
    getUsers,
    getTemplatesHistory,
    deleteTemplatesHistoryBulk,
    manualSendTemplate
} from '../services/api';
import { Template, TemplateLog, User } from '../types';
import { 
    Mail, 
    MessageSquare, 
    Search, 
    Settings, 
    Save, 
    RotateCcw, 
    Check, 
    X, 
    AlertTriangle, 
    Info, 
    Smartphone, 
    Copy, 
    Sparkles,
    Eye,
    EyeOff,
    Filter,
    CheckSquare,
    Square
} from 'lucide-react';

const AdminTemplates: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterType, setFilterType] = useState<'all' | 'email' | 'whatsapp'>('all');
    
    // New Advanced Filters States
    const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [filterTheme, setFilterTheme] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [showFilters, setShowFilters] = useState<boolean>(false);

    // Bulk selection state
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [bulkUpdating, setBulkUpdating] = useState<boolean>(false);

    // Editor State
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [editorSubject, setEditorSubject] = useState<string>('');
    const [editorBody, setEditorBody] = useState<string>('');
    const [editorIsEnabled, setEditorIsEnabled] = useState<boolean>(true);
    const [editorTheme, setEditorTheme] = useState<Template['graphicTheme']>('default');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // New Tabs state
    const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'manual'>('editor');

    // Users and history states
    const [users, setUsers] = useState<User[]>([]);
    const [historyLogs, setHistoryLogs] = useState<TemplateLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
    const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

    // Selected items for bulk history delete
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
    const [deletingHistory, setDeletingHistory] = useState<boolean>(false);

    // Manual send states
    const [manualSelectedUserIds, setManualSelectedUserIds] = useState<string[]>([]);
    const [manualSelectedTemplateKey, setManualSelectedTemplateKey] = useState<string>('');
    const [manualUserSearch, setManualUserSearch] = useState<string>('');
    const [sendingManual, setSendingManual] = useState<boolean>(false);
    const [manualVars, setManualVars] = useState({
        amount: '',
        txId: '',
        notes: ''
    });

    // History filter states
    const [historySearch, setHistorySearch] = useState<string>('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'Success' | 'Failed'>('all');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'email' | 'whatsapp'>('all');
    const [historySentByFilter, setHistorySentByFilter] = useState<'all' | 'System' | 'Admin'>('all');

    // Expanded log details for history panel (optional popup/accordion)
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Sample placeholders reference
    const placeholderVars = [
        { name: '{username}', desc: 'The username of the recipient user (e.g. @john_doe)' },
        { name: '{fullName}', desc: 'The full name of the user' },
        { name: '{amount}', desc: 'The transaction amount' },
        { name: '{currency}', desc: 'The wallet currency (e.g., PKR, USD, EUR)' },
        { name: '{txId}', desc: 'Transaction reference code or deposit ID' },
        { name: '{date}', desc: 'Current date and timestamp' },
        { name: '{notes}', desc: 'Admin remarks, notes, or rejection comments' }
    ];

    // Presets for the admin to select and load as samples
    const samplePresets = [
        {
            name: 'Standard Transactional',
            desc: 'Clean, structured table layout',
            subject: '🔔 Status Update: Your transaction of {amount} has been processed',
            body: `
<div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 25px; border-radius: 8px; max-width: 550px; margin: 0 auto; border: 1px solid #e2e8f0;">
    <h3 style="color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Transaction Notification</h3>
    <p>Dear <strong>@{username}</strong>,</p>
    <p>This is to inform you that your request has been updated.</p>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 15px 0;">
        <p style="margin: 4px 0;"><strong>Amount:</strong> {amount} {currency}</p>
        <p style="margin: 4px 0;"><strong>Reference:</strong> {txId}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> {date}</p>
        <p style="margin: 4px 0; color: #64748b;"><strong>Notes:</strong> {notes}</p>
    </div>
    <p style="font-size: 12px; color: #94a3b8; text-align: center;">SmartEarning Team &copy; 2026</p>
</div>
            `.trim()
        },
        {
            name: 'Premium Dark Cosmic',
            desc: 'Futuristic high-contrast dark theme',
            subject: '🌌 Cosmic Alert: Payout of {amount} Dispatch Confirmed!',
            body: `
<div style="font-family: 'Courier New', monospace; background: linear-gradient(135deg, #0f172a, #1e1b4b); color: #e2e8f0; padding: 30px; border-radius: 12px; max-width: 550px; margin: 0 auto; border: 1px solid #4f46e5; text-align: center;">
    <div style="font-size: 32px; margin-bottom: 10px;">🌟</div>
    <h3 style="color: #818cf8; letter-spacing: 2px; margin-top: 0;">COSMIC SETTLEMENT INSTALLED</h3>
    <p style="font-size: 14px;">Greetings, Voyager <strong style="color: #60a5fa;">@{username}</strong>.</p>
    <p style="font-size: 14px; color: #cbd5e1;">Your extraction value of <strong style="font-size: 18px; color: #34d399;">{amount} {currency}</strong> has cleared the stargate portal.</p>
    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 20px auto; border-left: 3px solid #818cf8; text-align: left; max-width: 400px; font-size: 13px;">
        <div>⚡ PORT: {txId}</div>
        <div>🪐 DATE: {date}</div>
        <div>🛰️ FEED: {notes}</div>
    </div>
    <p style="font-size: 11px; color: #64748b;">Secure Ledger Automated Broadcast.</p>
</div>
            `.trim()
        },
        {
            name: 'Minimal Clean Text',
            desc: 'Personal plain message with greeting line',
            subject: 'Notification regarding your SmartEarning request',
            body: `
Hello {fullName} (@{username}),

Your recent action involving {amount} {currency} has been verified and processed by our accounting desk.

Transaction Details:
ID: {txId}
Timestamp: {date}
Remarks: {notes}

If you have any questions, please feel free to create a Dispute ticket in your dashboard.

Sincerely,
The SmartEarning Desk
            `.trim()
        }
    ];

    useEffect(() => {
        fetchTemplatesData();
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistoryData();
        } else if (activeTab === 'manual') {
            fetchUsersData();
            fetchTemplatesData();
        }
    }, [activeTab]);

    const fetchHistoryData = async () => {
        setLoadingHistory(true);
        try {
            const logs = await getTemplatesHistory();
            setHistoryLogs(logs);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch history logs');
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchUsersData = async () => {
        setLoadingUsers(true);
        try {
            const allUsers = await getUsers();
            setUsers(allUsers);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleToggleSelectHistoryId = (id: string) => {
        setSelectedHistoryIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllHistoryVisible = (visibleIds: string[]) => {
        const allSelected = visibleIds.every(id => selectedHistoryIds.includes(id));
        if (allSelected) {
            setSelectedHistoryIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedHistoryIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const handleBulkDeleteHistory = async () => {
        if (selectedHistoryIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to permanently delete ${selectedHistoryIds.length} history log(s)?`)) {
            return;
        }
        setDeletingHistory(true);
        try {
            await deleteTemplatesHistoryBulk(selectedHistoryIds);
            setSuccessMsg(`Successfully deleted ${selectedHistoryIds.length} history logs.`);
            setSelectedHistoryIds([]);
            fetchHistoryData();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            alert(`Failed to delete history logs: ${err.message || err}`);
        } finally {
            setDeletingHistory(false);
        }
    };

    const handleManualSend = async () => {
        if (manualSelectedUserIds.length === 0) {
            alert('Please select at least one user.');
            return;
        }
        if (!manualSelectedTemplateKey) {
            alert('Please select a template to send.');
            return;
        }

        const template = templates.find(t => t.key === manualSelectedTemplateKey);
        if (!template) {
            alert('Selected template not found.');
            return;
        }

        const confirmMsg = `Are you sure you want to manually send the "${template.name}" (${template.type}) template to ${manualSelectedUserIds.length} user(s)?`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setSendingManual(true);
        try {
            await manualSendTemplate(manualSelectedUserIds, manualSelectedTemplateKey, {
                amount: manualVars.amount,
                txId: manualVars.txId,
                notes: manualVars.notes
            });
            setSuccessMsg(`Successfully sent template to ${manualSelectedUserIds.length} users!`);
            setManualSelectedUserIds([]);
            setTimeout(() => setSuccessMsg(null), 3500);
        } catch (err: any) {
            alert(`Failed to send manual templates: ${err.message}`);
        } finally {
            setSendingManual(false);
        }
    };

    const handleToggleSelectUser = (id: string) => {
        setManualSelectedUserIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllUsersVisible = () => {
        const visibleIds = filteredUsers.map(u => u._id);
        const allSelected = visibleIds.every(id => manualSelectedUserIds.includes(id));
        if (allSelected) {
            setManualSelectedUserIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setManualSelectedUserIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // Filtered users for manual send selector
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            return user.username.toLowerCase().includes(manualUserSearch.toLowerCase()) ||
                   user.fullName.toLowerCase().includes(manualUserSearch.toLowerCase()) ||
                   user.email.toLowerCase().includes(manualUserSearch.toLowerCase()) ||
                   (user.phone && user.phone.includes(manualUserSearch)) ||
                   (user.country && user.country.toLowerCase().includes(manualUserSearch.toLowerCase()));
        });
    }, [users, manualUserSearch]);

    // Filtered history logs
    const filteredHistoryLogs = useMemo(() => {
        return historyLogs.filter(log => {
            const matchesSearch = 
                log.username.toLowerCase().includes(historySearch.toLowerCase()) ||
                log.recipient.toLowerCase().includes(historySearch.toLowerCase()) ||
                log.templateName.toLowerCase().includes(historySearch.toLowerCase()) ||
                (log.subject && log.subject.toLowerCase().includes(historySearch.toLowerCase())) ||
                (log.body && log.body.toLowerCase().includes(historySearch.toLowerCase()));
            
            const matchesStatus = historyStatusFilter === 'all' ? true : log.status === historyStatusFilter;
            const matchesType = historyTypeFilter === 'all' ? true : log.type === historyTypeFilter;
            const matchesSentBy = historySentByFilter === 'all' ? true : log.sentBy === historySentByFilter;

            return matchesSearch && matchesStatus && matchesType && matchesSentBy;
        });
    }, [historyLogs, historySearch, historyStatusFilter, historyTypeFilter, historySentByFilter]);

    const fetchTemplatesData = async () => {
        setLoading(true);
        try {
            const data = await getTemplates();
            setTemplates(data);
            if (data.length > 0 && !selectedTemplate) {
                loadIntoEditor(data[0]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const loadIntoEditor = (tpl: Template) => {
        setSelectedTemplate(tpl);
        setEditorSubject(tpl.subject || '');
        setEditorBody(tpl.body || '');
        setEditorIsEnabled(tpl.isEnabled);
        setEditorTheme(tpl.graphicTheme || 'default');
        setSuccessMsg(null);
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;
        setIsSaving(true);
        setSuccessMsg(null);
        try {
            const updated = await updateTemplate(selectedTemplate.key, {
                subject: editorSubject,
                body: editorBody,
                isEnabled: editorIsEnabled,
                graphicTheme: editorTheme
            });
            
            // Update local list
            setTemplates(prev => prev.map(t => t.key === updated.key ? updated : t));
            setSelectedTemplate(updated);
            setSuccessMsg('Template saved successfully!');
            setTimeout(() => setSuccessMsg(null), 3500);
        } catch (err: any) {
            alert(`Error: ${err.message || 'Failed to update template'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetAll = async () => {
        if (!window.confirm('Are you absolutely sure you want to reset ALL templates to factory defaults? This will overwrite your current templates.')) {
            return;
        }
        setLoading(true);
        try {
            const resetData = await resetTemplatesToDefault();
            setTemplates(resetData);
            if (resetData.length > 0) {
                const currentKey = selectedTemplate?.key;
                const match = resetData.find(t => t.key === currentKey) || resetData[0];
                loadIntoEditor(match);
            }
            alert('Templates reset to factory defaults successfully!');
        } catch (err: any) {
            alert(`Reset failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleInsertPlaceholder = (placeholder: string) => {
        setEditorBody(prev => prev + placeholder);
    };

    const handleApplyPreset = (presetBody: string, presetSubject?: string) => {
        if (window.confirm('Replace current editor body with this sample preset?')) {
            setEditorBody(presetBody);
            if (presetSubject && selectedTemplate?.type === 'email') {
                setEditorSubject(presetSubject);
            }
        }
    };

    const getTemplateCategory = (key: string): string => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('deposit')) return 'Deposit';
        if (lowerKey.includes('withdrawal')) return 'Withdrawal';
        if (lowerKey.includes('transfer')) return 'Transfer';
        if (lowerKey.includes('plan')) return 'Plan';
        if (lowerKey.includes('referral')) return 'Referral';
        if (lowerKey.includes('announcement') || lowerKey.includes('general')) return 'Announcement';
        return 'Other';
    };

    // Filter logic
    const filteredTemplates = useMemo(() => {
        return templates.filter(tpl => {
            const matchesSearch = tpl.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 tpl.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (tpl.subject && tpl.subject.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesType = filterType === 'all' ? true : tpl.type === filterType;
            
            const matchesStatus = filterStatus === 'all' 
                ? true 
                : filterStatus === 'enabled' 
                    ? tpl.isEnabled 
                    : !tpl.isEnabled;

            const matchesTheme = filterTheme === 'all' ? true : tpl.graphicTheme === filterTheme;

            const matchesCategory = filterCategory === 'all' 
                ? true 
                : getTemplateCategory(tpl.key).toLowerCase() === filterCategory.toLowerCase();

            return matchesSearch && matchesType && matchesStatus && matchesTheme && matchesCategory;
        });
    }, [templates, searchTerm, filterType, filterStatus, filterTheme, filterCategory]);

    // Bulk actions logic
    const handleToggleSelectKey = (key: string) => {
        setSelectedKeys(prev => 
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleSelectAllVisible = () => {
        const allVisibleKeys = filteredTemplates.map(t => t.key);
        const allAreSelected = allVisibleKeys.every(k => selectedKeys.includes(k));
        if (allAreSelected) {
            setSelectedKeys(prev => prev.filter(k => !allVisibleKeys.includes(k)));
        } else {
            setSelectedKeys(prev => Array.from(new Set([...prev, ...allVisibleKeys])));
        }
    };

    const handleClearSelection = () => {
        setSelectedKeys([]);
    };

    const handleBulkStatusUpdate = async (isEnabled: boolean) => {
        if (selectedKeys.length === 0) return;
        const actionLabel = isEnabled ? 'enable' : 'disable';
        if (!window.confirm(`Are you sure you want to ${actionLabel} the ${selectedKeys.length} selected template(s)?`)) {
            return;
        }
        setBulkUpdating(true);
        try {
            const updatedList = await bulkUpdateTemplates(selectedKeys, isEnabled);
            setTemplates(updatedList);
            
            // If active editor template is in bulk, reload editor state
            if (selectedTemplate && selectedKeys.includes(selectedTemplate.key)) {
                const updatedActive = updatedList.find(t => t.key === selectedTemplate.key);
                if (updatedActive) {
                    loadIntoEditor(updatedActive);
                }
            }
            
            setSuccessMsg(`Successfully ${isEnabled ? 'enabled' : 'disabled'} ${selectedKeys.length} templates!`);
            setSelectedKeys([]);
            setTimeout(() => setSuccessMsg(null), 3500);
        } catch (err: any) {
            alert(`Bulk update failed: ${err.message || 'Error occurred'}`);
        } finally {
            setBulkUpdating(false);
        }
    };

    // Live HTML/Text preview engine
    const previewContent = useMemo(() => {
        if (!editorBody) return '';
        let content = editorBody;

        const demoVars: Record<string, string> = {
            username: 'pioneer_investor',
            fullName: 'Muhammad Ali',
            amount: '12,500',
            currency: 'PKR',
            txId: 'TXN-8274950392',
            date: new Date().toLocaleString(),
            notes: 'Verified transaction instantly matched via P2P node.'
        };

        for (const [k, v] of Object.entries(demoVars)) {
            const regex = new RegExp(`{${k}}`, 'g');
            content = content.replace(regex, v);
        }

        return content;
    }, [editorBody]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                <span className="ml-3 font-semibold text-gray-500 dark:text-gray-400">Loading templates...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Settings className="w-6 h-6 text-blue-600" />
                        Automated Notification Templates
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Configure customized HTML & text templates for automated emails and WhatsApp alerts dispatched on user actions (deposits, withdrawals, etc).
                    </p>
                </div>
                <div className="mt-4 md:mt-0 flex gap-3">
                    <button
                        onClick={handleResetAll}
                        className="inline-flex items-center px-4 py-2 border border-orange-200 dark:border-orange-800 text-sm font-medium rounded-xl text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset Defaults
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 gap-4 mb-2">
                <button
                    onClick={() => setActiveTab('editor')}
                    id="btn-tab-editor"
                    className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'editor'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Template Editor & Rules</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    id="btn-tab-history"
                    className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'history'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    <Copy className="w-4 h-4" />
                    <span>Sent History Logs</span>
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    id="btn-tab-manual"
                    className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'manual'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    <Mail className="w-4 h-4" />
                    <span>Manual Bulk Send</span>
                </button>
            </div>

            {/* Split Grid */}
            {activeTab === 'editor' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Left Panel: Template List (Col Span 4) */}
                <div className="xl:col-span-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[750px]">
                    <div className="mb-3">
                        <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Search Templates</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        </div>
                    </div>

                    <div className="flex gap-1 mb-3 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterType === 'all' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('email')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${filterType === 'email' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                        >
                            <Mail className="w-3.5 h-3.5" />
                            Email
                        </button>
                        <button
                            onClick={() => setFilterType('whatsapp')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${filterType === 'whatsapp' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            WhatsApp
                        </button>
                    </div>

                    {/* Filter and Bulk Action Toggles */}
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            <span>{showFilters ? 'Hide Filters' : 'Advanced Filters'}</span>
                            {(filterStatus !== 'all' || filterTheme !== 'all' || filterCategory !== 'all') && (
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            )}
                        </button>
                        {selectedKeys.length > 0 && (
                            <button
                                onClick={handleClearSelection}
                                className="text-[10px] font-bold text-red-500 hover:underline"
                            >
                                Deselect ({selectedKeys.length})
                            </button>
                        )}
                    </div>

                    {/* Collapsible Advanced Filters Panel */}
                    {showFilters && (
                        <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-150 dark:border-gray-800/80 mb-3 space-y-2.5">
                            {/* Status Filter */}
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as any)}
                                    className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="enabled">Active Only</option>
                                    <option value="disabled">Disabled Only</option>
                                </select>
                            </div>

                            {/* Category Filter */}
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Category</label>
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none"
                                >
                                    <option value="all">All Categories</option>
                                    <option value="deposit">Deposit</option>
                                    <option value="withdrawal">Withdrawal</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="plan">Plan</option>
                                    <option value="referral">Referral</option>
                                    <option value="announcement">Announcement</option>
                                </select>
                            </div>

                            {/* Theme Filter */}
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Theme</label>
                                <select
                                    value={filterTheme}
                                    onChange={(e) => setFilterTheme(e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none"
                                >
                                    <option value="all">All Themes</option>
                                    <option value="default">Default Neutral</option>
                                    <option value="minimalist">Minimalist</option>
                                    <option value="cosmic">Cosmic Electric</option>
                                    <option value="emerald_success">Emerald Success</option>
                                    <option value="coral_danger">Coral Error/Notice</option>
                                </select>
                            </div>

                            <div className="flex justify-end pt-1">
                                <button
                                    onClick={() => {
                                        setFilterStatus('all');
                                        setFilterCategory('all');
                                        setFilterTheme('all');
                                    }}
                                    className="text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bulk Selection Header */}
                    <div className="flex items-center justify-between px-1 mb-2">
                        <button
                            onClick={handleSelectAllVisible}
                            className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            {filteredTemplates.length > 0 && filteredTemplates.every(t => selectedKeys.includes(t.key)) ? (
                                <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            ) : (
                                <Square className="w-3.5 h-3.5 text-gray-400" />
                            )}
                            <span>Select {filteredTemplates.length} Filtered</span>
                        </button>
                        {selectedKeys.length > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {selectedKeys.length} Selected
                            </span>
                        )}
                    </div>

                    {/* Bulk Action Controls */}
                    {selectedKeys.length > 0 && (
                        <div className="bg-blue-50/70 dark:bg-blue-950/45 border border-blue-100 dark:border-blue-900/40 p-2 rounded-xl mb-3 flex items-center justify-between gap-1.5 shadow-sm">
                            <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">
                                Bulk Status:
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleBulkStatusUpdate(true)}
                                    disabled={bulkUpdating}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors flex items-center gap-0.5"
                                >
                                    <Check className="w-3 h-3" /> Enable
                                </button>
                                <button
                                    onClick={() => handleBulkStatusUpdate(false)}
                                    disabled={bulkUpdating}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center gap-0.5"
                                >
                                    <X className="w-3 h-3" /> Disable
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Template list overflow */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {filteredTemplates.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <span className="text-xs">No matching templates found</span>
                            </div>
                        ) : (
                            filteredTemplates.map(tpl => {
                                const isSelected = selectedTemplate?.key === tpl.key;
                                return (
                                    <div
                                        key={tpl.key}
                                        onClick={() => loadIntoEditor(tpl)}
                                        className={`w-full text-left p-3.5 rounded-xl transition-all border flex gap-3 cursor-pointer select-none ${
                                            isSelected 
                                            ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900 shadow-sm' 
                                            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-750'
                                        }`}
                                    >
                                        {/* Multi-Select Checkbox */}
                                        <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleSelectKey(tpl.key);
                                            }}
                                            className="flex items-center justify-center pt-0.5"
                                        >
                                            {selectedKeys.includes(tpl.key) ? (
                                                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                            ) : (
                                                <Square className="w-4 h-4 text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 flex-shrink-0" />
                                            )}
                                        </div>

                                        {/* Main Card Content */}
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <div className="flex items-center justify-between w-full gap-1">
                                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {tpl.name}
                                                </span>
                                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5 flex-shrink-0 ${
                                                    tpl.type === 'email' 
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' 
                                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                }`}>
                                                    {tpl.type === 'email' ? <Mail className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                                                    {tpl.type}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate w-full">
                                                key: {tpl.key}
                                            </span>
                                            <div className="flex items-center justify-between w-full mt-1 border-t border-gray-100 dark:border-gray-700 pt-1.5 gap-1">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${tpl.isEnabled ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500'}`}>
                                                        {tpl.isEnabled ? 'Active' : 'Disabled'}
                                                    </span>
                                                    <span className="text-[9px] bg-gray-100 dark:bg-gray-900 text-gray-500 px-1.5 py-0.5 rounded font-semibold">
                                                        {getTemplateCategory(tpl.key)}
                                                    </span>
                                                </div>
                                                {tpl.graphicTheme && tpl.graphicTheme !== 'default' && (
                                                    <span className="text-[9px] font-semibold text-purple-500 capitalize flex-shrink-0">
                                                        🎨 {tpl.graphicTheme.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel: Active Editor & Live Preview Split (Col Span 8) */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    {selectedTemplate ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* Editor Form (Col Span 7) */}
                            <div className="lg:col-span-7 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[750px] overflow-y-auto">
                                <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3 mb-4">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Active Template Editor</span>
                                        <h2 className="text-base font-bold text-gray-800 dark:text-white truncate">
                                            {selectedTemplate.name}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Enabled:</label>
                                        <input
                                            type="checkbox"
                                            checked={editorIsEnabled}
                                            onChange={(e) => setEditorIsEnabled(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 flex-grow">
                                    {/* Subject line (Email templates only) */}
                                    {selectedTemplate.type === 'email' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Email Subject Line</label>
                                            <input
                                                type="text"
                                                value={editorSubject}
                                                onChange={(e) => setEditorSubject(e.target.value)}
                                                placeholder="Enter email subject header..."
                                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}

                                    {/* Theme selection */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Graphic Presentation Theme</label>
                                        <select
                                            value={editorTheme}
                                            onChange={(e) => setEditorTheme(e.target.value as Template['graphicTheme'])}
                                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="default">Default Neutral Theme</option>
                                            <option value="minimalist">Minimalist Plain-Text Theme</option>
                                            <option value="cosmic">Cosmic Electric Dark Theme</option>
                                            <option value="emerald_success">Emerald Success Accent Theme</option>
                                            <option value="coral_danger">Coral Error/Notice Theme</option>
                                        </select>
                                    </div>

                                    {/* Sample Presets Dropdown */}
                                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100/60 dark:border-blue-900/30">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                                <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                                Select Sample Presets (Click to Load)
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {samplePresets.map(preset => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => handleApplyPreset(preset.body, preset.subject)}
                                                    className="px-2.5 py-1.5 text-[10px] font-semibold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                                                    title={preset.desc}
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Text Editor Body */}
                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                Template Content ({selectedTemplate.type === 'email' ? 'HTML supported' : 'Proper Text / Whatsapp Formatting'})
                                            </label>
                                        </div>
                                        <textarea
                                            rows={12}
                                            value={editorBody}
                                            onChange={(e) => setEditorBody(e.target.value)}
                                            placeholder="Write template body content here..."
                                            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[220px]"
                                        />
                                    </div>

                                    {/* Insertable Placeholders */}
                                    <div>
                                        <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                                            Click Placeholders to Append
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {placeholderVars.map(item => (
                                                <button
                                                    key={item.name}
                                                    type="button"
                                                    onClick={() => handleInsertPlaceholder(item.name)}
                                                    className="px-2 py-1 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-200 text-gray-600 dark:text-gray-300 rounded transition-all"
                                                    title={item.desc}
                                                >
                                                    {item.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Save Button Footer */}
                                <div className="mt-6 pt-4 border-t dark:border-gray-700 flex items-center justify-between">
                                    {successMsg ? (
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <Check className="w-4 h-4 bg-green-100 dark:bg-green-900 p-0.5 rounded-full" />
                                            {successMsg}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400">
                                            Remember to click save to commit changes.
                                        </span>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-sm font-bold text-white rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {isSaving ? 'Saving Changes...' : 'Save Template'}
                                    </button>
                                </div>
                            </div>

                            {/* Live Device Sandbox Preview (Col Span 5) */}
                            <div className="lg:col-span-5 bg-gray-50 dark:bg-gray-900/40 p-6 rounded-2xl border border-gray-150 dark:border-gray-800 flex flex-col items-center justify-start h-[750px] overflow-y-auto">
                                <div className="w-full text-center mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center justify-center gap-1">
                                        <Smartphone className="w-3.5 h-3.5" />
                                        Interactive Live Preview
                                    </span>
                                    <p className="text-[11px] text-gray-400 mt-0.5">Simulating rendered variables & styling with demo user</p>
                                </div>

                                {/* Phone frame / Container */}
                                <div className="w-full max-w-[320px] bg-white dark:bg-gray-950 rounded-[32px] border-[6px] border-gray-800 dark:border-gray-800 shadow-2xl relative overflow-hidden flex flex-col h-[600px] font-sans">
                                    
                                    {/* Speaker & camera sensor */}
                                    <div className="h-6 bg-gray-850 dark:bg-gray-850 w-full flex justify-center items-center gap-2 relative z-10 flex-shrink-0">
                                        <div className="w-12 h-3.5 bg-black rounded-b-xl absolute top-0 flex justify-center items-center gap-1">
                                            <div className="w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
                                            <div className="w-6 h-1 bg-gray-800 rounded-full"></div>
                                        </div>
                                    </div>

                                    {/* Status details simulated */}
                                    <div className="bg-gray-50 dark:bg-gray-900 px-4 py-1 flex justify-between items-center text-[10px] text-gray-400 font-bold border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                                        <span>9:41 AM</span>
                                        <div className="flex gap-1">
                                            <span>📶</span>
                                            <span>🔋</span>
                                        </div>
                                    </div>

                                    {/* Device Canvas Screen */}
                                    <div className="flex-grow overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 flex flex-col">
                                        {selectedTemplate.type === 'email' ? (
                                            /* Email envelope visualization */
                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-150 dark:border-gray-700 flex-grow shadow-sm text-left">
                                                <div className="text-[10px] border-b dark:border-gray-700 pb-2 mb-2 space-y-1 text-gray-500">
                                                    <div><span className="font-bold">From:</span> support@smartearning.com</div>
                                                    <div><span className="font-bold">To:</span> pioneer_investor@gmail.com</div>
                                                    <div className="text-gray-800 dark:text-gray-100 truncate"><span className="font-bold">Subj:</span> {editorSubject ? previewContent.substring(0, 50) + (editorSubject.length > 50 ? '...' : '') : 'SmartEarning Notification'}</div>
                                                </div>
                                                <div className="text-xs break-words font-sans text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: previewContent || '<p className="text-gray-400 italic">Body content is empty.</p>' }} />
                                            </div>
                                        ) : (
                                            /* WhatsApp Bubble message visualization */
                                            <div className="flex flex-col justify-end flex-grow pb-4 font-sans text-left">
                                                {/* Header header info inside whatsapp chat */}
                                                <div className="flex items-center gap-2 bg-emerald-600 text-white p-2.5 rounded-lg mb-4 text-xs">
                                                    <div className="w-6 h-6 bg-emerald-700 rounded-full flex items-center justify-center font-bold">S</div>
                                                    <div>
                                                        <div className="font-bold">SmartEarning Desk</div>
                                                        <div className="text-[9px] opacity-80">Support Online</div>
                                                    </div>
                                                </div>
                                                
                                                {/* Simulated Message Balloon */}
                                                <div className="self-start max-w-[85%] bg-white dark:bg-gray-850 p-3 rounded-2xl rounded-tl-none shadow-sm text-xs relative text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800">
                                                    <p className="whitespace-pre-wrap break-words">{previewContent || 'Enter template body...'}</p>
                                                    <div className="text-[9px] text-gray-400 text-right mt-1.5">9:41 AM ✓✓</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border text-center text-gray-400 flex flex-col justify-center items-center h-[500px]">
                            <Mail className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600 animate-pulse" />
                            <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">No Template Selected</span>
                            <span className="text-xs text-gray-400 mt-1 max-w-xs">Select any email or WhatsApp template from the left pane to launch the interactive designer.</span>
                        </div>
                    )}
                </div>

            </div>
            )}

            {/* Sent History Logs Tab */}
            {activeTab === 'history' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        {/* Filter controls */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Search Logs</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search recipient, user, subject..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none"
                                    />
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Status</label>
                                <select
                                    value={historyStatusFilter}
                                    onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="Success">Success Only</option>
                                    <option value="Failed">Failed Only</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Type</label>
                                <select
                                    value={historyTypeFilter}
                                    onChange={(e) => setHistoryTypeFilter(e.target.value as any)}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none"
                                >
                                    <option value="all">All Types</option>
                                    <option value="email">Email</option>
                                    <option value="whatsapp">WhatsApp</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Sent By</label>
                                <select
                                    value={historySentByFilter}
                                    onChange={(e) => setHistorySentByFilter(e.target.value as any)}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none"
                                >
                                    <option value="all">All Senders</option>
                                    <option value="System">System Automated</option>
                                    <option value="Admin">Admin Manual</option>
                                </select>
                            </div>
                        </div>

                        {/* Bulk delete panel */}
                        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4 mb-4">
                            <button
                                onClick={() => handleSelectAllHistoryVisible(filteredHistoryLogs.map(l => l._id))}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-650 dark:text-gray-300 hover:text-blue-600 transition-colors"
                            >
                                {filteredHistoryLogs.length > 0 && filteredHistoryLogs.every(l => selectedHistoryIds.includes(l._id)) ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                    <Square className="w-4 h-4 text-gray-400" />
                                )}
                                <span>Select All Visible ({filteredHistoryLogs.length})</span>
                            </button>

                            {selectedHistoryIds.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 px-2.5 py-1 rounded-lg">
                                        {selectedHistoryIds.length} Logs Selected
                                    </span>
                                    <button
                                        onClick={handleBulkDeleteHistory}
                                        disabled={deletingHistory}
                                        className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                                    >
                                        <X className="w-3.5 h-3.5 mr-1.5" />
                                        Delete Selected
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* History Table */}
                        {loadingHistory ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                            </div>
                        ) : filteredHistoryLogs.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                                <p className="font-bold text-sm text-gray-600 dark:text-gray-400">No sent template logs found</p>
                                <p className="text-xs text-gray-400 mt-1">Try modifying your filter options or search terms.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400 uppercase">
                                            <th className="py-3 px-4 w-10"></th>
                                            <th className="py-3 px-4">User</th>
                                            <th className="py-3 px-4">Template Name</th>
                                            <th className="py-3 px-4">Recipient</th>
                                            <th className="py-3 px-4">Type</th>
                                            <th className="py-3 px-4">Sender</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-medium">
                                        {filteredHistoryLogs.map((log) => {
                                            const isSelected = selectedHistoryIds.includes(log._id);
                                            const isExpanded = expandedLogId === log._id;
                                            return (
                                                <React.Fragment key={log._id}>
                                                    <tr className={`border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 ${isSelected ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}>
                                                        <td className="py-3.5 px-4">
                                                            <button
                                                                onClick={() => handleToggleSelectHistoryId(log._id)}
                                                                className="flex items-center justify-center"
                                                            >
                                                                {isSelected ? (
                                                                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                                ) : (
                                                                    <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="py-3.5 px-4 font-bold text-gray-800 dark:text-gray-200">
                                                            @{log.username}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300">
                                                            <span className="font-semibold">{log.templateName}</span>
                                                            <span className="block text-[10px] font-mono text-gray-400 mt-0.5">{log.templateKey}</span>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-gray-500 font-mono">
                                                            {log.recipient}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <span className={`inline-flex items-center gap-1 uppercase text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded ${
                                                                log.type === 'email'
                                                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                            }`}>
                                                                {log.type === 'email' ? <Mail className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                                                                {log.type}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                log.sentBy === 'Admin'
                                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500'
                                                            }`}>
                                                                {log.sentBy}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            {log.status === 'Success' ? (
                                                                <span className="inline-flex items-center gap-0.5 text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 px-1.5 py-0.5 rounded font-bold">
                                                                    <Check className="w-2.5 h-2.5" /> Sent
                                                                </span>
                                                            ) : (
                                                                <div>
                                                                    <span className="inline-flex items-center gap-0.5 text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded font-bold">
                                                                        <X className="w-2.5 h-2.5" /> Failed
                                                                    </span>
                                                                    {log.error && (
                                                                        <span className="block text-[9px] text-red-500 dark:text-red-400 max-w-[150px] truncate mt-0.5" title={log.error}>
                                                                            {log.error}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-gray-400">
                                                            {log.date ? new Date(log.date).toLocaleString() : 'N/A'}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <button
                                                                onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                                                                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                                            >
                                                                {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                                <span>{isExpanded ? 'Hide' : 'View Message'}</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={9} className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-800">
                                                                <div className="bg-white dark:bg-gray-850 p-4 rounded-xl border border-gray-150 dark:border-gray-700 shadow-inner">
                                                                    {log.subject && (
                                                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 pb-1 border-b dark:border-gray-700">
                                                                            Subject: <span className="text-gray-800 dark:text-gray-100 font-medium">{log.subject}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="text-xs font-sans text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap">
                                                                        {log.type === 'email' && log.body.includes('<') && log.body.includes('>') ? (
                                                                            <div dangerouslySetInnerHTML={{ __html: log.body }} />
                                                                        ) : (
                                                                            log.body
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Send Tab */}
            {activeTab === 'manual' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Left Panel: Configuration (Col Span 5) */}
                    <div className="xl:col-span-5 space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
                            <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                1. Select Template & Setup Parameters
                            </h3>

                            {/* Template Selection */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                                    Message Template
                                </label>
                                <select
                                    value={manualSelectedTemplateKey}
                                    onChange={(e) => setManualSelectedTemplateKey(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none"
                                >
                                    <option value="">-- Choose Template --</option>
                                    {templates.map(tpl => (
                                        <option key={tpl.key} value={tpl.key}>
                                            {tpl.name} ({tpl.type === 'email' ? '✉️ Email' : '💬 WhatsApp'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Variable inputs card */}
                            <div className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-150 dark:border-gray-800 space-y-4">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                                    <Info className="w-4 h-4 text-blue-500" />
                                    <span>Optional Substitution Variables</span>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                                        Amount value ({'{amount}'})
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 5,000"
                                        value={manualVars.amount}
                                        onChange={(e) => setManualVars(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 dark:text-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                                        Transaction reference ID ({'{txId}'})
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. TXN-9274920"
                                        value={manualVars.txId}
                                        onChange={(e) => setManualVars(prev => ({ ...prev, txId: e.target.value }))}
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 dark:text-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                                        Remarks / Notes ({'{notes}'})
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="e.g. Verified by accountant desk."
                                        value={manualVars.notes}
                                        onChange={(e) => setManualVars(prev => ({ ...prev, notes: e.target.value }))}
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 dark:text-white focus:outline-none resize-none"
                                    />
                                </div>
                            </div>

                            {/* Dispatch Trigger Panel */}
                            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-3 text-xs text-gray-500 dark:text-gray-400">
                                    <span>Recipient Count:</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                        {manualSelectedUserIds.length} User(s) selected
                                    </span>
                                </div>

                                <button
                                    onClick={handleManualSend}
                                    id="btn-trigger-manual-send"
                                    disabled={sendingManual || manualSelectedUserIds.length === 0 || !manualSelectedTemplateKey}
                                    className="w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold rounded-xl transition-all shadow-sm gap-2"
                                >
                                    {sendingManual ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                            <span>Sending Broadcast...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Manually Send Template ({manualSelectedUserIds.length})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Recipient list (Col Span 7) */}
                    <div className="xl:col-span-7 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[700px]">
                        <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                            2. Select Recipient Users ({manualSelectedUserIds.length} Selected)
                        </h3>

                        {/* Recipient Search */}
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Search users by name, email, or username..."
                                value={manualUserSearch}
                                onChange={(e) => setManualUserSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        </div>

                        {/* Selection Options Header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                            <button
                                onClick={handleSelectAllUsersVisible}
                                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                {filteredUsers.length > 0 && filteredUsers.every(u => manualSelectedUserIds.includes(u._id)) ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                    <Square className="w-4 h-4 text-gray-400" />
                                )}
                                <span>Select All Visible ({filteredUsers.length})</span>
                            </button>

                            {manualSelectedUserIds.length > 0 && (
                                <button
                                    onClick={() => setManualSelectedUserIds([])}
                                    className="text-[11px] font-bold text-red-500 hover:underline"
                                >
                                    Clear Selection
                    </button>
                            )}
                        </div>

                        {/* User Selection table container */}
                        <div className="flex-1 overflow-y-auto pr-1">
                            {loadingUsers ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-xs">No users match search query.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredUsers.map(user => {
                                        const isUserSelected = manualSelectedUserIds.includes(user._id);
                                        return (
                                            <div
                                                key={user._id}
                                                onClick={() => handleToggleSelectUser(user._id)}
                                                className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer select-none ${
                                                    isUserSelected
                                                        ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900'
                                                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-750'
                                                }`}
                                            >
                                                <div className="flex items-center justify-center">
                                                    {isUserSelected ? (
                                                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                            {user.fullName} (@{user.username})
                                                        </span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                                            user.status === 'Active' || user.status === 'Verified'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500'
                                                        }`}>
                                                            {user.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono truncate">
                                                        <span>{user.email}</span>
                                                        <span>{user.whatsapp || user.phone || 'No phone'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTemplates;
