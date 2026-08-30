import React from 'react';
import { Link } from 'react-router-dom';

interface FooterProps {
  className?: string;
  isMemberArea?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ className = '', isMemberArea = true }) => {
  const officeAddress = "71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom";
  const phoneWhatsApp = "+447846775662";
  const officialEmail = "smartexn.com@gmail.com";
  const whatsappUrl = "https://wa.me/447846775662";

  return (
    <footer id="app-main-footer" className={`mt-auto border-t border-gray-200/60 dark:border-gray-800/80 pt-8 pb-6 text-left ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
        
        {/* Branding, Overview & Operational Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-md shadow-blue-500/20">
              S
            </span>
            <span className="text-sm font-black tracking-tight text-gray-900 dark:text-white uppercase">
              SmartExn Platform
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
            International digital micro-task marketplace, crowdsourced campaigns ecosystem, and secure escrow payout network.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            All Platform Systems Operational
          </div>
        </div>

        {/* Official UK Customer Support Office */}
        <div className="space-y-2.5">
          <h5 className="text-[11px] font-black uppercase text-gray-900 dark:text-gray-200 tracking-wider flex items-center gap-1.5">
            <span>🇬🇧</span> Customer Support Office (UK)
          </h5>
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 space-y-2 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Registered Office Address:</span>
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

        {/* Legal & Compliance Links */}
        <div>
          <h5 className="text-[11px] font-black uppercase text-gray-900 dark:text-gray-200 tracking-wider mb-3">
            ⚖️ Legal & Governance
          </h5>
          <ul className="space-y-2 text-xs font-semibold">
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-legal?tab=privacy" : "/privacy-policy"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-legal?tab=terms" : "/terms-of-use"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-legal?tab=cookie" : "/privacy-policy"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Cookie Policy
              </Link>
            </li>
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-legal?tab=antifraud" : "/trust-and-safety"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Anti-Fraud & Escrow Safety
              </Link>
            </li>
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-legal?tab=refund" : "/refund-policy"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Refund Policy
              </Link>
            </li>
          </ul>
        </div>

        {/* Help & Support Desk */}
        <div>
          <h5 className="text-[11px] font-black uppercase text-gray-900 dark:text-gray-200 tracking-wider mb-3">
            💡 Quick Help & Desk
          </h5>
          <ul className="space-y-2 text-xs font-semibold">
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-faqs" : "/faqs"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Knowledge Base & FAQs
              </Link>
            </li>
            <li>
              <Link 
                to={isMemberArea ? "/member/disputes" : "/how-it-works"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Disputes & Support Desk
              </Link>
            </li>
            <li>
              <Link 
                to={isMemberArea ? "/member/hub-legal?tab=about" : "/how-it-works-for-workers"} 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                About Platform & Gigs
              </Link>
            </li>
            <li>
              <a 
                href={whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 font-bold"
              >
                <span>💬</span> Live WhatsApp Support
              </a>
            </li>
            <li>
              <a 
                href={`mailto:${officialEmail}`} 
                className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5 font-bold"
              >
                <span>✉️</span> Contact Official Mail
              </a>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200/60 dark:border-gray-800/80 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        <div>
          © 2026 SmartExn Inc. & Work and Earn Hub. All Rights Reserved. Regulated International Escrow Platform.
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-gray-700 dark:hover:text-gray-200 transition cursor-help">Secure SSL 256-bit</span>
          <span>•</span>
          <span className="hover:text-gray-700 dark:hover:text-gray-200 transition cursor-help">PCI DSS Compliant</span>
          <span>•</span>
          <span className="hover:text-gray-700 dark:hover:text-gray-200 transition cursor-help">Escrow Secured</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
