
import React, { useState } from 'react';

// SVG Icons for social platforms
const WhatsAppIcon = () => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.77.46 3.45 1.28 4.94L2 22l5.25-1.38c1.44.75 3.06 1.18 4.79 1.18h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zM9.53 8.5c.24-.12.55-.2 1.76.38 1.2.58 2.35 1.99 2.55 2.13.2.14.34.23.48.23.14 0 .4-.09.53-.18.13-.09.63-.29.76-.53.13-.24.13-.44 0-.58l-.13-.18c-.1-.12-.22-.17-.35-.23-.13-.06-.28-.09-.43-.09-.15 0-.3-.02-.43-.02-.13 0-.34.02-.51.2-.17.18-.7.84-.85 1.02-.15.18-.29.2-.4.1-.1-.1-.49-.18-.94-.36-1.1-.43-1.83-1.1-1.97-1.28-.14-.18-.02-.28.09-.39.1-.1.22-.24.32-.34.1-.1.14-.18.2-.3s.04-.27-.02-.39c-.06-.12-.53-1.29-.72-1.76-.2-.47-.39-.4-.53-.4h-.24c-.14 0-.38.04-.57.27-.2.23-.75.72-.75 1.76 0 1.04.77 2.04.88 2.18.1.14 1.5 2.3 3.65 3.23.5.24.9.38 1.22.48.5.15.94.13 1.3.08.4-.04 1.22-.5 1.4-1 .17-.48.17-.9.12-1l-.06-.08c-.04-.04-.1-.08-.15-.08-.05 0-.12 0-.18.02z"/></svg>;
const FacebookIcon = () => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-1.1 0-1.5.9-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const TelegramIcon = () => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.78-1.58 7.37c-.12.58-.59.71-1.04.44l-2.4-1.77-1.16 1.12c-.13.13-.24.23-.46.23l.17-2.45 4.49-4.08c.19-.17-.03-.26-.29-.1l-5.54 3.48-2.36-.73c-.58-.18-.58-.58.11-.86l9.25-3.56c.49-.19.94.13.78.7z"/></svg>;
const ThreadsIcon = () => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12.77,10.63c-1.35-0.19-2.22-1.41-2.22-2.73c0-1.63,1.32-2.95,2.95-2.95s2.95,1.32,2.95,2.95c0,1.3-0.84,2.5-2.16,2.72 C14.64,10.74,15,11.33,15,12c0,0.47-0.1,0.92-0.29,1.34c0.55-0.21,1.15-0.34,1.79-0.34c1.63,0,2.95,1.32,2.95,2.95S18.13,18.9,16.5,18.9 s-2.95-1.32-2.95-2.95c0-0.65,0.22-1.25,0.58-1.73C13.8,13.91,13.25,13.56,12.7,13.3c-1.35,0.67-2.28,2.02-2.28,3.54 c0,2.2,1.79,3.99,3.99,3.99s3.99-1.79,3.99-3.99c0-1.46-0.8-2.75-2-3.44c0.16-0.34,0.25-0.71,0.25-1.09c0-1.1-0.9-2-2-2 s-2,0.9-2,2c0,0.56,0.24,1.07,0.62,1.44C11.39,11.23,11.9,11.1,12.77,10.63z M10.42,14.27c-0.55,0.21-1.15,0.34-1.79,0.34 c-1.63,0-2.95-1.32-2.95-2.95S7,8.71,8.63,8.71s2.95,1.32,2.95,2.95c0,0.65-0.22,1.25-0.58,1.73c0.33,0.31,0.71,0.57,1.12,0.76 c1.35-0.67,2.28-2.02,2.28-3.54c0-2.2-1.79-3.99-3.99-3.99S7.37,6.86,7.37,9.06c0,1.46,0.8,2.75,2,3.44 c-0.16,0.34-0.25,0.71-0.25,1.09c0,1.1,0.9,2,2,2s2-0.9,2-2c0-0.56-0.24-1.07-0.62-1.44C11.39,14.77,11.9,14.9,10.42,14.27z"/></svg>;
const LinkedInIcon = () => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zm-12 5v10h4V12.77c0-1 .5-1.5 1.5-1.5s1.5.5 1.5 1.5V18h4v-5.23c0-2.5-1.5-3.5-3.5-3.5C8.5 9.27 7 10.27 7 12.77V18H3V8h4zm-1.5-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>;
const InstagramIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.85-.069zM12 0C8.74 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98C23.986 15.667 24 15.26 24 12s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98C15.667.014 15.26 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"></path></svg>;
const TikTokIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.05-4.84-.95-6.43-2.98-1.59-2.04-1.6-4.9 0-7.08 1.59-2.17 4.35-3.41 6.92-3.44.02 2.11-.01 4.22.02 6.33-.02 1.08.27 2.15.82 3.02.55.87 1.34 1.47 2.28 1.7-1.12.02-2.24-.01-3.36-.02-.27-.01-.54-.01-.81-.02-.13-.01-.26-.04-.39-.08-.39-.12-.77-.3-1.12-.52-.52-.33-1.01-.75-1.4-1.24-.39-.49-.7-1.06-.88-1.68-.17-.6-.24-1.23-.24-1.87v-1.11c.01-4.08.01-8.16.01-12.24Z"/></svg>;
const SnapchatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M14.996 6.002c-.521 0-1.018.214-1.41.606l-1.586 1.586c-.785.785-2.037.785-2.822 0L7.592 6.608C7.199 6.216 6.702 6 6.182 6c-1.077 0-1.953.876-1.953 1.953 0 .521.214 1.018.606 1.41l3.58 3.58c.785.785 2.037.785 2.822 0l3.58-3.58c.392-.392.606-.889.606-1.41 0-1.077-.876-1.953-1.953-1.953zm-3.004 7c.521 0 1.018-.214 1.41-.606l1.586-1.586c.785-.785 2.037.785 2.822 0l1.586 1.586c.392.392.889.606 1.41.606 1.077 0 1.953-.876 1.953-1.953 0-.521-.214-1.018-.606-1.41l-3.58-3.58c-.785-.785-2.037-.785-2.822 0l-3.58 3.58c-.392.392-.606.889-.606 1.41 0 1.077.876 1.953 1.953 1.953z"/></svg>;
const CopyIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;


interface ShareButtonsProps {
  url: string;
  title: string;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ url, title }) => {
  const [copied, setCopied] = useState(false);
  const text = `${title} ${url}`;

  const socials = [
    { name: 'WhatsApp', icon: <WhatsAppIcon />, href: `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, color: 'text-[#25D366] hover:text-[#128C7E]' },
    { name: 'Facebook', icon: <FacebookIcon />, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, color: 'text-[#1877F2] hover:text-[#166FE5]' },
    { name: 'X', icon: <XIcon />, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, color: 'text-black dark:text-white hover:text-gray-600' },
    { name: 'Telegram', icon: <TelegramIcon />, href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, color: 'text-[#2AABEE] hover:text-[#229ED9]' },
    { name: 'Instagram', icon: <InstagramIcon />, href: '#', color: 'text-pink-600 hover:text-pink-700' },
    { name: 'TikTok', icon: <TikTokIcon />, href: '#', color: 'text-black dark:text-white hover:text-gray-600' },
    { name: 'Snapchat', icon: <SnapchatIcon />, href: '#', color: 'text-yellow-400 hover:text-yellow-500' },
    { name: 'LinkedIn', icon: <LinkedInIcon />, href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, color: 'text-[#0A66C2] hover:text-[#004182]' },
    { name: 'Threads', icon: <ThreadsIcon />, href: `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`, color: 'text-black dark:text-white hover:text-gray-600' },
  ];

  const copyOnlyPlatforms = ['Instagram', 'TikTok', 'Snapchat'];

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-white">Share Your Referral Link</h3>
        
        <div>
            <label htmlFor="referral-url" className="sr-only">Referral URL</label>
            <input
              id="referral-url"
              type="text"
              readOnly
              value={url}
              className="w-full text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg border-gray-200 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
             {/* Native Share Button for Mobile */}
            {typeof navigator !== 'undefined' && navigator.share && (
                <button
                    onClick={handleNativeShare}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow"
                >
                    <ShareIcon />
                    Share
                </button>
            )}

            {socials.map(({ name, icon, href, color }) => {
              if (copyOnlyPlatforms.includes(name)) {
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={handleCopy}
                    aria-label={`Copy link for ${name}`}
                    title={`Copy link to share on ${name}`}
                    className={`p-2.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all transform hover:scale-110 ${color}`}
                  >
                    {icon}
                  </button>
                )
              }
              return (
                <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Share on ${name}`}
                    // FIX: The 'color' variable is a string of CSS classes, not a function. Removed parentheses.
                    className={`p-2.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all transform hover:scale-110 ${color}`}
                >
                    {icon}
                </a>
              )
            })}
            
            <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy Link'}
            </button>
        </div>
    </div>
  );
};

export default ShareButtons;
