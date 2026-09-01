import React from 'react';
import { useData } from '../hooks/useData';

interface SupportOfficeCardProps {
  variant?: 'compact' | 'showcase' | 'banner';
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
}

export const SupportOfficeCard: React.FC<SupportOfficeCardProps> = ({
  variant = 'compact',
  className = '',
  theme = 'auto',
}) => {
  const { settings } = useData();

  const officeAddress = settings?.supportOfficeAddress || "71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom";
  const phoneWhatsApp = settings?.supportOfficePhone || settings?.contactUsWhatsAppNumber || "+447846775662";
  const officialEmail = settings?.supportOfficeEmail || settings?.contactUsEmailAddress || "smartexn.com@gmail.com";
  const officeTitle = settings?.supportOfficeTitle || "Customer Support Office (UK)";
  const badge1 = settings?.supportOfficeBadge1 || "Official Registered Support Desk";
  const badge2 = settings?.supportOfficeBadge2 || "UK Registered Office";
  const officeSubtitle = settings?.supportOfficeSubtitle || "Have questions or need assistance before creating an account? Our dedicated UK headquarters desk provides direct support for workers, campaign creators, and international partners.";
  const responseTime = settings?.supportOfficeHours || "15 – 60 Minutes";

  const rawPhone = phoneWhatsApp.replace(/[^0-9+]/g, '').replace('+', '');
  const whatsappUrl = `https://wa.me/${rawPhone || '447846775662'}`;

  if (variant === 'showcase') {
    return (
      <div 
        id="uk-customer-support-office-card"
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 md:p-10 border transition-all duration-300 ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-[#0c223a] via-[#091a2e] to-[#061424] border-sky-500/30 text-white shadow-2xl shadow-sky-950/50' 
            : 'bg-gradient-to-br from-slate-900 via-[#0b1f36] to-[#07172b] border-sky-500/20 text-white shadow-2xl'
        } ${className}`}
      >
        {/* Subtle Decorative Ambient Background Elements */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Heading & Verification Badge */}
          <div className="lg:col-span-7 space-y-4 text-left">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-3xl filter drop-shadow">🇬🇧</span>
              {badge1 && (
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {badge1}
                </span>
              )}
              {badge2 && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-500/15 border border-sky-400/30 text-sky-300">
                  {badge2}
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {officeTitle}
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed max-w-xl">
                {officeSubtitle}
              </p>
            </div>

            {/* Address Box */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 max-w-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 block">
                Official Registered Office Address
              </span>
              <p className="text-slate-200 font-medium leading-relaxed flex items-start gap-2">
                <span className="text-sky-400 mt-0.5 shrink-0">📍</span>
                <span>{officeAddress}</span>
              </p>
            </div>
          </div>

          {/* Right Column: Direct Contact Action Cards */}
          <div className="lg:col-span-5 flex flex-col gap-3.5">
            {/* WhatsApp Card */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-4 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 hover:border-emerald-400/60 transition-all flex items-center justify-between gap-4 shadow-lg hover:shadow-emerald-950/50"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md group-hover:scale-105 transition-transform shrink-0">
                  💬
                </div>
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Direct WhatsApp Live Support</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono tracking-tight group-hover:text-emerald-300 transition-colors">
                    {phoneWhatsApp}
                  </span>
                </div>
              </div>
              <span className="text-emerald-400 group-hover:translate-x-1 transition-transform text-lg shrink-0 font-bold">
                &rarr;
              </span>
            </a>

            {/* Email Card */}
            <a
              href={`mailto:${officialEmail}`}
              className="group p-4 rounded-2xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 hover:border-sky-400/60 transition-all flex items-center justify-between gap-4 shadow-lg hover:shadow-sky-950/50"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center text-xl shadow-md group-hover:scale-105 transition-transform shrink-0">
                  ✉️
                </div>
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-sky-300 block">Official Support Email Desk</span>
                  <span className="text-xs sm:text-sm font-black text-white font-mono tracking-tight group-hover:text-sky-300 transition-colors">
                    {officialEmail}
                  </span>
                </div>
              </div>
              <span className="text-sky-400 group-hover:translate-x-1 transition-transform text-lg shrink-0 font-bold">
                &rarr;
              </span>
            </a>

            {/* Operating Response Window */}
            <div className="px-4 py-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="text-sky-400">⏱️</span> Average Response Time:
              </span>
              <span className="font-bold text-slate-200">{responseTime}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact Footer Card
  return (
    <div className={`space-y-2.5 text-left ${className}`}>
      <h5 className="text-[11px] font-black uppercase text-gray-900 dark:text-gray-200 tracking-wider flex items-center gap-1.5">
        <span>🇬🇧</span> {officeTitle}
      </h5>
      <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 space-y-2 text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
            Registered Office Address:
          </span>
          <p className="text-gray-700 dark:text-gray-300 font-medium leading-snug">
            {officeAddress}
          </p>
        </div>
        
        <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/60 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-[11px] font-semibold">Phone/WhatsApp:</span>
            <a 
              href={whatsappUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>💬</span>
              {phoneWhatsApp}
            </a>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-[11px] font-semibold">Official Support Email:</span>
            <a 
              href={`mailto:${officialEmail}`} 
              className="font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline text-[11px]"
            >
              {officialEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportOfficeCard;
