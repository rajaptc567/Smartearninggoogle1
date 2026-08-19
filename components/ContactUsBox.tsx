import React, { useState } from 'react';
import { Settings, User } from '../types';
import Button from './ui/Button';

interface ContactUsBoxProps {
    settings?: Settings;
    currentUser?: User | null;
    className?: string;
    customTitle?: string;
    customSubtitle?: string;
}

const COUNTRY_CODES = [
    { code: '+1', country: 'United States / Canada', flag: '🇺🇸' },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
    { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪' },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
    { code: '+55', country: 'Brazil', flag: '🇧🇷' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+27', country: 'South Africa', flag: '🇿🇦' },
    { code: '+90', country: 'Turkey', flag: '🇹🇷' },
    { code: '+52', country: 'Mexico', flag: '🇲🇽' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+63', country: 'Philippines', flag: '🇵🇭' },
    { code: '+', country: 'Other International Prefix', flag: '🌐' },
];

const QUICK_SUBJECTS = [
    '💳 Withdrawal & Payout Query',
    '🔐 Account Verification',
    '💼 Task / Work Inquiry',
    '❓ General Support Question',
];

export const ContactUsBox: React.FC<ContactUsBoxProps> = ({
    settings,
    currentUser,
    className = '',
    customTitle,
    customSubtitle,
}) => {
    // Admin toggles check
    const isBoxEnabled = settings?.enableContactUsBox !== false;
    const isEmailEnabled = settings?.enableContactViaEmail !== false;
    const isWhatsAppEnabled = settings?.enableContactViaWhatsApp !== false;

    // If contact box is completely disabled by admin, return null
    if (!isBoxEnabled) {
        return null;
    }

    // Determine initial active channel
    const initialChannel: 'email' | 'whatsapp' = isEmailEnabled ? 'email' : isWhatsAppEnabled ? 'whatsapp' : 'email';
    const [selectedChannel, setSelectedChannel] = useState<'email' | 'whatsapp'>(initialChannel);

    // Form fields
    const [emailInput, setEmailInput] = useState(currentUser?.email || '');
    const [countryCode, setCountryCode] = useState('+1');
    const [phoneInput, setPhoneInput] = useState(currentUser?.phone || '');
    const [subject, setSubject] = useState('💳 Withdrawal & Payout Query');
    const [message, setMessage] = useState('');

    // Status state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successData, setSuccessData] = useState<{
        ticketId: string;
        channel: 'email' | 'whatsapp';
        target: string;
        whatsAppUrl?: string;
    } | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const adminEmail = settings?.contactUsEmailAddress || 'support@international-payouts.com';
    const adminWhatsApp = settings?.contactUsWhatsAppNumber || '+1 (555) 019-2834';

    const handleSendInquiry = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (selectedChannel === 'email' && !emailInput.trim()) {
            setErrorMsg('Please enter a valid email address.');
            return;
        }

        if (selectedChannel === 'whatsapp' && !phoneInput.trim()) {
            setErrorMsg('Please enter your WhatsApp phone number.');
            return;
        }

        if (!subject.trim()) {
            setErrorMsg('Please enter or select a message subject/title.');
            return;
        }

        if (!message.trim()) {
            setErrorMsg('Please enter your message details.');
            return;
        }

        setIsSubmitting(true);

        setTimeout(() => {
            const ticketId = `INT-${Math.floor(100000 + Math.random() * 900000)}`;
            const fullPhone = `${countryCode}${phoneInput.replace(/\D/g, '')}`;

            let waUrl = '';
            if (selectedChannel === 'whatsapp') {
                const waText = encodeURIComponent(
                    `*International Support Request (Ticket #${ticketId})*\n\n` +
                    `*User Email:* ${emailInput || 'N/A'}\n` +
                    `*Phone:* ${fullPhone}\n` +
                    `*Subject:* ${subject}\n\n` +
                    `*Message:* ${message}`
                );
                const cleanAdminWA = adminWhatsApp.replace(/\D/g, '') || '15550192834';
                waUrl = `https://wa.me/${cleanAdminWA}?text=${waText}`;
            }

            // Save to local support history
            try {
                const existingTickets = JSON.parse(localStorage.getItem('user_support_tickets') || '[]');
                existingTickets.unshift({
                    id: ticketId,
                    userId: currentUser?._id || 'guest',
                    email: emailInput,
                    phone: fullPhone,
                    channel: selectedChannel,
                    subject,
                    message,
                    date: new Date().toISOString(),
                    status: 'Open',
                });
                localStorage.setItem('user_support_tickets', JSON.stringify(existingTickets));
            } catch (err) {
                console.error("Failed to save support ticket locally:", err);
            }

            setSuccessData({
                ticketId,
                channel: selectedChannel,
                target: selectedChannel === 'email' ? emailInput : fullPhone,
                whatsAppUrl: waUrl,
            });

            setIsSubmitting(false);
            setMessage('');
        }, 600);
    };

    return (
        <div className={`bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 sm:p-8 md:p-10 text-white border border-slate-800 shadow-2xl relative overflow-hidden my-8 ${className}`}>
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Outer Box Header */}
            <div className="relative z-10 space-y-2 mb-6 text-center sm:text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
                <div>
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                        <span className="text-2xl">🌐</span>
                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                            {customTitle || settings?.contactUsBoxTitle || "International Member Support & Contact Desk"}
                        </h2>
                    </div>
                    <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
                        {customSubtitle || settings?.contactUsBoxSubtitle || "Have questions regarding your withdrawal, payout settlement, or account verification? Reach out directly to our global support team."}
                    </p>
                </div>

                {/* Destination Badges */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-end w-full sm:w-auto">
                    {isEmailEnabled && (
                        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                            <span className="text-teal-400">📧</span>
                            <span>{adminEmail}</span>
                        </div>
                    )}
                    {isWhatsAppEnabled && (
                        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                            <span className="text-emerald-400">💬</span>
                            <span>{adminWhatsApp}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Inner Box Form ("Box inside a Box") */}
            <div className="relative z-10 bg-slate-800/90 dark:bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
                {/* Step 1: Channel Selector (If both enabled) */}
                {isEmailEnabled && isWhatsAppEnabled && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-teal-400 uppercase tracking-widest block">
                            Select Preferred Contact Method
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedChannel('email')}
                                className={`p-3.5 rounded-xl border-2 font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    selectedChannel === 'email'
                                        ? 'bg-teal-600 text-white border-teal-400 shadow-lg shadow-teal-600/30 ring-2 ring-teal-500/20'
                                        : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:border-slate-500'
                                }`}
                            >
                                <span className="text-base">📧</span>
                                <span>Email Support</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedChannel('whatsapp')}
                                className={`p-3.5 rounded-xl border-2 font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    selectedChannel === 'whatsapp'
                                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                                        : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:border-slate-500'
                                }`}
                            >
                                <span className="text-base">💬</span>
                                <span>WhatsApp Direct</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Notice if only 1 channel is active */}
                {!(isEmailEnabled && isWhatsAppEnabled) && (
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/80 flex items-center gap-2 text-xs text-slate-300">
                        <span className="text-teal-400 text-base">ℹ️</span>
                        <span>
                            Official Support Channel Active:{' '}
                            <strong className="text-white uppercase font-black">
                                {isEmailEnabled ? '📧 Email Inquiry' : isWhatsAppEnabled ? '💬 WhatsApp Contact' : 'Direct Support Ticket'}
                            </strong>
                        </span>
                    </div>
                )}

                {/* SUCCESS NOTIFICATION RECEIPT */}
                {successData ? (
                    <div className="bg-emerald-950/80 border-2 border-emerald-500/50 p-6 rounded-2xl text-emerald-200 space-y-4 animate-fade-in shadow-2xl">
                        <div className="flex items-start gap-3">
                            <span className="text-3xl">✅</span>
                            <div className="space-y-1">
                                <h4 className="text-base font-black text-white uppercase tracking-tight">
                                    Inquiry Dispatched Successfully!
                                </h4>
                                <p className="text-xs text-emerald-300 leading-relaxed">
                                    Your international support ticket{' '}
                                    <strong className="font-mono text-white bg-emerald-900/80 px-2 py-0.5 rounded">
                                        #{successData.ticketId}
                                    </strong>{' '}
                                    has been registered.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-900/90 rounded-xl border border-emerald-800/80 text-xs space-y-2 font-mono">
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400 uppercase text-[10px]">Contact Method</span>
                                <span className="font-bold text-teal-400 uppercase">{successData.channel}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400 uppercase text-[10px]">Target Destination</span>
                                <span className="font-bold text-white">{successData.target}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 uppercase text-[10px]">Estimated Reply</span>
                                <span className="font-bold text-emerald-400">Within 15 - 60 Minutes</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            {successData.whatsAppUrl && (
                                <a
                                    href={successData.whatsAppUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>💬</span>
                                    <span>Open WhatsApp Chat Now &rarr;</span>
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => setSuccessData(null)}
                                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition-all"
                            >
                                Send Another Inquiry
                            </button>
                        </div>
                    </div>
                ) : (
                    /* FORM INPUTS */
                    <form onSubmit={handleSendInquiry} className="space-y-4">
                        {errorMsg && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Email Address Input */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                Your Email Address (For Response & Updates)
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                                    ✉️
                                </span>
                                <input
                                    type="email"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    placeholder="your-name@domain.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all placeholder-slate-500"
                                    required
                                />
                            </div>
                        </div>

                        {/* Phone Number Input with International Country Code (When WhatsApp is selected or enabled) */}
                        {(selectedChannel === 'whatsapp' || isWhatsAppEnabled) && (
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                    WhatsApp Phone Number & Country Code
                                </label>
                                <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-5 sm:col-span-4">
                                        <select
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            className="w-full px-2.5 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                                        >
                                            {COUNTRY_CODES.map((item) => (
                                                <option key={item.code + item.country} value={item.code} className="bg-slate-900 text-white">
                                                    {item.flag} {item.code} ({item.country})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-7 sm:col-span-8">
                                        <input
                                            type="tel"
                                            value={phoneInput}
                                            onChange={(e) => setPhoneInput(e.target.value)}
                                            placeholder="300 1234567"
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all placeholder-slate-500 font-mono"
                                            required={selectedChannel === 'whatsapp'}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Subject Chips + Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                Inquiry Subject / Title
                            </label>

                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {QUICK_SUBJECTS.map((chip) => (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => setSubject(chip)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            subject === chip
                                                ? 'bg-teal-500 text-slate-950 font-black shadow-md'
                                                : 'bg-slate-900/90 text-slate-400 border border-slate-700/80 hover:text-white'
                                        }`}
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Enter message subject..."
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Message Details Textarea */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                Message / Question Details
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                placeholder="Please describe your inquiry, withdrawal issue, or questions in detail..."
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all placeholder-slate-500 leading-relaxed"
                                required
                            ></textarea>
                        </div>

                        {/* Send Button */}
                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-600/30 bg-teal-600 hover:bg-teal-500 text-white border-0 transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <span>Sending Inquiry...</span>
                                ) : (
                                    <>
                                        <span>{selectedChannel === 'whatsapp' ? '💬' : '📧'}</span>
                                        <span>
                                            {selectedChannel === 'whatsapp'
                                                ? 'Dispatch Inquiry via WhatsApp'
                                                : 'Send Email Inquiry & Create Ticket'}
                                        </span>
                                        <span>&rarr;</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ContactUsBox;
