
import React from 'react';

// Icons for different activities
const WithdrawalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>;
const TransferIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" /></svg>;
const JoinIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>;

const icons: { [key: string]: React.ReactNode } = {
  withdrawal: <WithdrawalIcon />,
  transfer: <TransferIcon />,
  joined: <JoinIcon />,
  deposit: <JoinIcon />,
  plan: <JoinIcon />,
  commission: <JoinIcon />,
};

export interface Activity {
    id: string;
    type: 'withdrawal' | 'transfer' | 'joined' | 'deposit' | 'plan' | 'commission';
    text: string;
    time: string;
}

/**
 * 🔒 SAFE TEXT PARSER
 * Replaces dangerouslySetInnerHTML with React elements.
 * Supports bold tags only for {name}, {amount} etc.
 */
const SafeTickerText: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(<strong>.*?<\/strong>)/g);
    return (
        <span className="ml-2 text-sm text-gray-800 dark:text-gray-200">
            {parts.map((part, i) => {
                if (part.startsWith('<strong>')) {
                    const content = part.replace(/<\/?strong.*?>/g, '');
                    return <strong key={i} className="font-bold text-blue-600 dark:text-blue-400">{content}</strong>;
                }
                return part;
            })}
        </span>
    );
};

interface ActivityTickerProps {
  activities: Activity[];
  speed: number;
  pauseOnHover?: boolean;
  style?: {
      backgroundColor?: string;
      textColor?: string;
      accentColor?: string;
  };
}

const ActivityTicker: React.FC<ActivityTickerProps> = ({ activities, speed = 6, pauseOnHover = false, style }) => {
    if (!activities || activities.length === 0) return null;

    const extendedActivities = activities.length > 20 ? [...activities] : [...activities, ...activities, ...activities];
    const duration = extendedActivities.length * speed;

    return (
        <div 
            className="relative w-full h-10 border-b dark:border-gray-700 overflow-hidden shadow-inner bg-white dark:bg-gray-800"
            style={style?.backgroundColor ? { backgroundColor: style.backgroundColor } : {}}
        >
            <div className={`absolute inset-0 flex items-center animate-marquee whitespace-nowrap ${pauseOnHover ? 'hover:pause-animation' : ''}`}>
                {extendedActivities.map((activity, index) => (
                    <div key={`${activity.id}-${index}`} className="inline-flex items-center mx-6">
                        {icons[activity.type]}
                        <SafeTickerText text={activity.text} />
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 opacity-70">{activity.time}</span>
                    </div>
                ))}
            </div>
            <style>
            {`
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-${100 / (extendedActivities.length / activities.length)}%); }
                }
                .animate-marquee {
                    animation: marquee ${duration}s linear infinite;
                }
                .hover\\:pause-animation:hover {
                    animation-play-state: paused;
                }
            `}
            </style>
        </div>
    );
};

export default ActivityTicker;
