
import React, { useState } from 'react';

// SVG Icons for social platforms (scaled down for compact layout)
const WhatsAppIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.77.46 3.45 1.28 4.94L2 22l5.25-1.38c1.44.75 3.06 1.18 4.79 1.18h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zM9.53 8.5c.24-.12.55-.2 1.76.38 1.2.58 2.35 1.99 2.55 2.13.2.14.34.23.48.23.14 0 .4-.09.53-.18.13-.09.63-.29.76-.53.13-.24.13-.44 0-.58l-.13-.18c-.1-.12-.22-.17-.35-.23-.13-.06-.28-.09-.43-.09-.15 0-.3-.02-.43-.02-.13 0-.34.02-.51.2-.17.18-.7.84-.85 1.02-.15.18-.29.2-.4.1-.1-.1-.49-.18-.94-.36-1.1-.43-1.83-1.1-1.97-1.28-.14-.18-.02-.28.09-.39.1-.1.22-.24.32-.34.1-.1.14-.18.2-.3s.04-.27-.02-.39c-.06-.12-.53-1.29-.72-1.76-.2-.47-.39-.4-.53-.4h-.24c-.14 0-.38.04-.57.27-.2.23-.75.72-.75 1.76 0 1.04.77 2.04.88 2.18.1.14 1.5 2.3 3.65 3.23.5.24.9.38 1.22.48.5.15.94.13 1.3.08.4-.04 1.22-.5 1.4-1 .17-.48.17-.9.12-1l-.06-.08c-.04-.04-.1-.08-.15-.08-.05 0-.12 0-.18.02z"/></svg>;
const FacebookIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-1.1 0-1.5.9-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const TelegramIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.78-1.58 7.37c-.12.58-.59.71-1.04.44l-2.4-1.77-1.16 1.12c-.13.13-.24.23-.46.23l.17-2.45 4.49-4.08c.19-.17-.03-.26-.29-.1l-5.54 3.48-2.36-.73c-.58-.18-.58-.58.11-.86l9.25-3.56c.49-.19.94.13.78.7z"/></svg>;
const InstagramIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>;
const TikTokIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.81-.74-3.91-1.72-.08-.07-.13-.16-.21-.24v5.39c0 2.87-.78 5.85-3.2 7.29-2.24 1.41-5.24 1.55-7.48.16-2.5-1.51-3.6-4.66-2.9-7.47.53-2.34 2.45-4.28 4.82-4.75V13.1c-1.39.23-2.6 1.34-2.88 2.74-.38 1.56.34 3.32 1.74 3.99 1.4.72 3.25.33 4.14-.99.51-.72.63-1.63.6-2.5V.02z"/></svg>;
const SnapchatIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 2c-3.13 0-5 2.11-5 4.49 0 .47.08.97.22 1.45A3.48 3.48 0 0 1 6 8.5C5.17 8.5 4.5 9.17 4.5 10c0 .35.12.67.32.93-.19.24-.32.55-.32.89 0 .52.28.97.69 1.21-.11.45-.19.93-.19 1.43 0 1.93 1.12 2.94 3 3.42.27.7.83 1.21 1.52 1.44-.12.56-.3.97-.54 1.22-.24.25-.56.41-1 .47-.44.06-1 .11-1 .5s.56.44 1 .5c.44.06.88.11 1.25.3.37.19.64.55.81 1.05.17.5.34.8.84.8s.67-.3.84-.8c.17-.5.44-.86.81-1.05.37-.19.81-.24 1.25-.3.44-.06 1-.11 1-.5s-.56-.44-1-.5c-.44-.06-.76-.22-1-.47-.24-.25-.42-.66-.54-1.22.69-.23 1.25-.74 1.52-1.44 1.88-.48 3-1.49 3-3.42 0-.5-.08-.98-.19-1.43.41-.24.69-.69.69-1.21 0-.34-.13-.65-.32-.89.2-.26.32-.58.32-.93 0-.83-.67-1.5-1.5-1.5a3.48 3.48 0 0 1-1.22-.56c.14-.48.22-.98.22-1.45C17 4.11 15.13 2 12 2z"/></svg>;
const LinkedInIcon = () => <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>;
const CopyIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;

interface ShareButtonsProps {
  url: string;
  title: string;
  className?: string;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ url, title, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const text = `${title} ${url}`;

  const socials = [
    { name: 'WhatsApp', icon: <WhatsAppIcon />, href: `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, color: 'bg-[#25D366] text-white hover:bg-[#128C7E]' },
    { name: 'Facebook', icon: <FacebookIcon />, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, color: 'bg-[#1877F2] text-white hover:bg-[#166FE5]' },
    { name: 'X', icon: <XIcon />, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, color: 'bg-[#111827] text-white hover:bg-black' },
    { name: 'Telegram', icon: <TelegramIcon />, href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, color: 'bg-[#2AABEE] text-white hover:bg-[#229ED9]' },
    { name: 'Instagram', icon: <InstagramIcon />, href: `https://instagram.com`, color: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white hover:opacity-90' },
    { name: 'TikTok', icon: <TikTokIcon />, href: `https://tiktok.com`, color: 'bg-black text-white hover:bg-gray-900' },
    { name: 'Snapchat', icon: <SnapchatIcon />, href: `https://www.snapchat.com/share?url=${encodeURIComponent(url)}`, color: 'bg-[#FFFC00] text-black hover:bg-[#E6E300]' },
    { name: 'LinkedIn', icon: <LinkedInIcon />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, color: 'bg-[#0077B5] text-white hover:bg-[#005582]' },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  return (
    <div className={`bg-white dark:bg-[#0f172a] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3.5 space-y-2.5 ${className}`}>
        <h3 className="text-[10px] uppercase tracking-wider font-black text-gray-500 dark:text-gray-400">Share Your Referral Link</h3>
        
        <div className="flex gap-1.5">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-grow text-[10px] font-mono py-1.5 px-2.5 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#111827] rounded-md border border-gray-200 dark:border-gray-700 outline-none"
            />
            <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-1 shadow-md shadow-blue-600/10"
            >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800/60">
            <div className="flex flex-wrap gap-1 items-center max-w-[240px] xs:max-w-none">
                {socials.map(({ name, icon, href, color }) => (
                    <a
                        key={name}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-all transform hover:scale-105 shadow-sm ${color}`}
                        title={`Share on ${name}`}
                    >
                        {icon}
                    </a>
                ))}
            </div>

            {navigator.share && (
                <button
                    onClick={handleNativeShare}
                    className="flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95 mt-1 sm:mt-0 whitespace-nowrap"
                >
                    <ShareIcon />
                    Share Options
                </button>
            )}
        </div>
    </div>
  );
};

export default ShareButtons;
