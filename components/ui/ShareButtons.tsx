
import React, { useState } from 'react';

// SVG Icons for social platforms
const WhatsAppIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.77.46 3.45 1.28 4.94L2 22l5.25-1.38c1.44.75 3.06 1.18 4.79 1.18h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zM9.53 8.5c.24-.12.55-.2 1.76.38 1.2.58 2.35 1.99 2.55 2.13.2.14.34.23.48.23.14 0 .4-.09.53-.18.13-.09.63-.29.76-.53.13-.24.13-.44 0-.58l-.13-.18c-.1-.12-.22-.17-.35-.23-.13-.06-.28-.09-.43-.09-.15 0-.3-.02-.43-.02-.13 0-.34.02-.51.2-.17.18-.7.84-.85 1.02-.15.18-.29.2-.4.1-.1-.1-.49-.18-.94-.36-1.1-.43-1.83-1.1-1.97-1.28-.14-.18-.02-.28.09-.39.1-.1.22-.24.32-.34.1-.1.14-.18.2-.3s.04-.27-.02-.39c-.06-.12-.53-1.29-.72-1.76-.2-.47-.39-.4-.53-.4h-.24c-.14 0-.38.04-.57.27-.2.23-.75.72-.75 1.76 0 1.04.77 2.04.88 2.18.1.14 1.5 2.3 3.65 3.23.5.24.9.38 1.22.48.5.15.94.13 1.3.08.4-.04 1.22-.5 1.4-1 .17-.48.17-.9.12-1l-.06-.08c-.04-.04-.1-.08-.15-.08-.05 0-.12 0-.18.02z"/></svg>;
const FacebookIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-1.1 0-1.5.9-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const TelegramIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.78-1.58 7.37c-.12.58-.59.71-1.04.44l-2.4-1.77-1.16 1.12c-.13.13-.24.23-.46.23l.17-2.45 4.49-4.08c.19-.17-.03-.26-.29-.1l-5.54 3.48-2.36-.73c-.58-.18-.58-.58.11-.86l9.25-3.56c.49-.19.94.13.78.7z"/></svg>;
const LinkedInIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zm-12 5v10h4V12.77c0-1 .5-1.5 1.5-1.5s1.5.5 1.5 1.5V18h4v-5.23c0-2.5-1.5-3.5-3.5-3.5C8.5 9.27 7 10.27 7 12.77V18H3V8h4zm-1.5-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>;
const InstagramIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.85-.069zM12 0C8.74 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98C23.986 15.667 24 15.26 24 12s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98C15.667.014 15.26 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"></path></svg>;
const TikTokIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.05-4.84-.95-6.43-2.98-1.59-2.04-1.6-4.9 0-7.08 1.59-2.17 4.35-3.41 6.92-3.44.02 2.11-.01 4.22.02 6.33-.02 1.08.27 2.15.82 3.02.55.87 1.34 1.47 2.28 1.7-1.12.02-2.24-.01-3.36-.02-.27-.01-.54-.01-.81-.02-.13-.01-.26-.04-.39-.08-.39-.12-.77-.3-1.12-.52-.52-.33-1.01-.75-1.4-1.24-.39-.49-.7-1.06-.88-1.68-.17-.6-.24-1.23-.24-1.87v-1.11c.01-4.08.01-8.16.01-12.24Z"/></svg>;
const SnapchatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.001 2c-3.149 0-5.725 1.66-7.399 4.12-.134.2-.26.406-.379.617C3.125 8.657 2 10.198 2 12c0 1.24.53 2.355 1.385 3.144.331.306.7.575 1.103.8 1.015.57 2.195.912 3.449.988v1.076h-1.295c-1.332 0-2.41 1.078-2.41 2.41v1.171C4.232 21.854 4.545 22 5 22h14c.455 0 .768-.146.768-.411v-1.171c0-1.332-1.078-2.41-2.41-2.41h-1.295V17.932c1.254-.076 2.434-.418 3.449-.988.403-.225.772-.494 1.103-.8.855-.789 1.385-1.904 1.385-3.144 0-1.802-1.125-3.343-2.223-5.263-.119-.211-.245-.417-.379-.617C17.726 3.66 15.15 2 12.001 2z"></path></svg>;
const CopyIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;
const LinkIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>;

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
    { name: 'Instagram', icon: <InstagramIcon />, href: '#', color: 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white' },
    { name: 'TikTok', icon: <TikTokIcon />, href: '#', color: 'bg-black text-white' },
    { name: 'Snapchat', icon: <SnapchatIcon />, href: '#', color: 'bg-[#FFFC00] text-black' },
    { name: 'LinkedIn', icon: <LinkedInIcon />, href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, color: 'bg-[#0A66C2] text-white' },
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
    <div className={`bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-5 ${className}`}>
        <h3 className="text-base font-bold text-gray-800 dark:text-white">Share Your Referral Link</h3>
        
        <div className="relative">
            <input
              type="text"
              readOnly
              value={url}
              className="w-full text-xs font-mono py-3 px-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-700 outline-none"
            />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
            <button
                onClick={handleNativeShare}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
                <ShareIcon />
                Share
            </button>

            {socials.map(({ name, icon, href, color }) => (
                <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all transform hover:scale-110 shadow-sm ${color}`}
                    title={`Share on ${name}`}
                >
                    {icon}
                </a>
            ))}
        </div>
        
        <div className="flex gap-2.5 pt-1">
            <button
                className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Generic Link"
            >
                <LinkIcon />
            </button>
            <button
                onClick={handleCopy}
                className="flex-grow flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
            >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy Link'}
            </button>
        </div>
    </div>
  );
};

export default ShareButtons;
