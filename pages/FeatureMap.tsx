
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { Settings, Status } from '../types';
import { updateSettings } from '../services/api';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const FeatureMap: React.FC = () => {
    const { state, dispatch } = useData();
    const { settings, tasks, withdrawals, disputes, investmentPlans, users } = state;
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);

    const handleToggleFeature = async (field: keyof Settings, currentValue: boolean) => {
        setIsSaving(true);
        try {
            const updated = await updateSettings({ [field]: !currentValue });
            dispatch({ type: 'UPDATE_SETTINGS', payload: updated });
        } catch (error) {
            console.error(error);
            alert("Failed to toggle feature.");
        } finally {
            setIsSaving(false);
        }
    };

    const FeatureCard: React.FC<{
        title: string;
        desc: string;
        isActive: boolean;
        icon: string;
        onToggle: () => void;
        onManage: () => void;
        stats?: string;
        category: 'Financial' | 'MLM' | 'Engagement' | 'Compliance';
    }> = ({ title, desc, isActive, icon, onToggle, onManage, stats, category }) => (
        <div className={`relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden group ${isActive ? 'bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900 shadow-xl' : 'bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 opacity-80'}`}>
            {/* Background Glow */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] transition-opacity duration-1000 ${isActive ? 'bg-blue-500/10 opacity-100' : 'bg-gray-500/5 opacity-0'}`}></div>
            
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${isActive ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            {icon}
                        </div>
                        <div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${category === 'Financial' ? 'bg-green-100 text-green-700' : category === 'MLM' ? 'bg-purple-100 text-purple-700' : category === 'Engagement' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {category}
                            </span>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter mt-1">{title}</h3>
                        </div>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isActive} onChange={onToggle} className="sr-only peer" disabled={isSaving} />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-6 leading-relaxed flex-grow">
                    {desc}
                </p>

                {stats && (
                    <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Module Metric</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{stats}</span>
                    </div>
                )}

                <button 
                    onClick={onManage}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200'}`}
                >
                    Configure Module &rarr;
                </button>
            </div>

            {/* Pulse Indicator */}
            {isActive && (
                <div className="absolute bottom-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-10 pb-20">
            <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group border border-white/5">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">Feature Intelligence</h1>
                        <p className="mt-4 text-blue-100/70 font-medium text-lg max-w-2xl leading-relaxed">
                            Centralized neural map of the SmartEarning v12.6 core modules. Monitor live engine status and deploy system-wide logic overrides.
                        </p>
                    </div>
                    <div className="hidden lg:block shrink-0 p-8 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 text-center animate-pulse-subtle">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">System Integrity</span>
                        <p className="text-3xl font-black mt-1">99.9%</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard 
                    category="Financial"
                    title="Transfer Engine"
                    desc="Enables instant wallet-to-wallet liquidity movement between members with configurable fee tiers."
                    isActive={settings.transferConfig?.enabled ?? true}
                    icon="💸"
                    onToggle={() => handleToggleFeature('isUserTransferEnabled', settings.transferConfig?.enabled ?? true)}
                    onManage={() => navigate('/admin/settings')}
                    stats={`${users.length} Wallets Eligible`}
                />
                <FeatureCard 
                    category="Engagement"
                    title="Task Missions"
                    desc="Mandatory social engagement workflows that act as a security guard for withdrawal eligibility."
                    isActive={settings.isTasksEnabled !== false}
                    icon="🎯"
                    onToggle={() => handleToggleFeature('isTasksEnabled', settings.isTasksEnabled !== false)}
                    onManage={() => navigate('/admin/tasks')}
                    stats={`${tasks.filter(t => t.status === 'Active').length} Active Missions`}
                />
                <FeatureCard 
                    category="Financial"
                    title="P2P Matching"
                    desc="Automated liquidity matching that links withdrawal requests directly to new member deposits."
                    isActive={withdrawals.some(w => w.status === Status.Matching)}
                    icon="🤝"
                    onToggle={() => {}} // Derived from status
                    onManage={() => navigate('/admin/withdrawals')}
                    stats={`${withdrawals.filter(w => w.status === Status.Matching).length} Active Matches`}
                />
                <FeatureCard 
                    category="MLM"
                    title="Equivalency Core"
                    desc="Dynamic logic that handles cross-currency commission tracking (USD, EUR, PKR) for global teams."
                    isActive={settings.planEquivalencyGroups && settings.planEquivalencyGroups.length > 0}
                    icon="🧬"
                    onToggle={() => {}} 
                    onManage={() => navigate('/admin/plan-equivalency')}
                    stats={`${settings.planEquivalencyGroups?.length || 0} Linked Currencies`}
                />
                <FeatureCard 
                    category="Compliance"
                    title="Dispute Center"
                    desc="Official tribunal for resolving transaction errors, missing screenshots, and account audits."
                    isActive={disputes.length > 0}
                    icon="🛡️"
                    onToggle={() => {}} 
                    onManage={() => navigate('/admin/disputes')}
                    stats={`${disputes.filter(d => d.status === 'Open').length} Open Tickets`}
                />
                <FeatureCard 
                    category="Engagement"
                    title="Social Ticker"
                    desc="Real-time hybrid activity feed that broadcasts global platform success to improve conversion."
                    isActive={settings.tickerEnabled !== false}
                    icon="📢"
                    onToggle={() => handleToggleFeature('tickerEnabled', settings.tickerEnabled !== false)}
                    onManage={() => navigate('/admin/ticker-settings')}
                    stats={`Speed: ${settings.tickerSpeed}s`}
                />
                <FeatureCard 
                    category="MLM"
                    title="One-Time Limit"
                    desc="Advanced rule to prevent commission farming by restricting payouts to one per unique referral."
                    isActive={settings.oneTimeCommissionPerGroup ?? false}
                    icon="⛔"
                    onToggle={() => handleToggleFeature('oneTimeCommissionPerGroup', settings.oneTimeCommissionPerGroup ?? false)}
                    onManage={() => navigate('/admin/sponsor-commission-rules')}
                />
                <FeatureCard 
                    category="Financial"
                    title="Frequency Guard"
                    desc="Prevents liquidity drains by enforcing time-based cooldown periods between withdrawal requests."
                    isActive={settings.withdrawalFrequency?.enabled ?? false}
                    icon="⏳"
                    onToggle={() => {}} // Managed in settings
                    onManage={() => navigate('/admin/settings')}
                    stats={`Cooldown: ${settings.withdrawalFrequency?.value} ${settings.withdrawalFrequency?.unit}`}
                />
                <FeatureCard 
                    category="MLM"
                    title="Joining Rules"
                    desc="Dependency engine that requires users to hold specific plans before upgrading to higher tiers."
                    isActive={state.rules.length > 0}
                    icon="📐"
                    onToggle={() => {}} 
                    onManage={() => navigate('/admin/rules')}
                    stats={`${state.rules.length} Strict Rules`}
                />
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border dark:border-gray-700 shadow-xl">
                 <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-6">Engine Dependencies</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">1</div>
                            <div>
                                <p className="font-bold">Withdrawal Gateway relies on Task Verification</p>
                                <p className="text-xs text-gray-500">If 'Task Missions' are enabled, the 'Withdrawal Engine' will remain locked for users until they complete their missions.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">2</div>
                            <div>
                                <p className="font-bold">Commission Engine relies on Equivalency Maps</p>
                                <p className="text-xs text-gray-500">Global referrals will only credit correctly if the 'Equivalency Core' has mapped the different currency plans.</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">3</div>
                            <div>
                                <p className="font-bold">P2P Matching relies on Deposit Verification</p>
                                <p className="text-xs text-gray-500"> matched deposits won't be credited to the withdrawer until an admin confirms the receipt in the Deposit Queue.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">4</div>
                            <div>
                                <p className="font-bold">Upgrade Rules depend on Investment Hierarchy</p>
                                <p className="text-xs text-gray-500">Ensure your plans are set up correctly before enforcing purchase restrictions.</p>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>

            <style>{`
                @keyframes pulse-subtle {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 4s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default FeatureMap;
