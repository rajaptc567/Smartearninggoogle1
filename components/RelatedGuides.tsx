import React from 'react';
import { Link } from 'react-router-dom';
import { seoAnalytics } from '../services/seoAnalytics';

export interface GuideItem {
  title: string;
  description: string;
  to: string;
  category?: string;
  tag?: string;
}

export interface RelatedGuidesProps {
  title?: string;
  description?: string;
  guides: GuideItem[];
  className?: string;
}

export const RelatedGuides: React.FC<RelatedGuidesProps> = ({
  title = 'Related Educational Guides & Authority Hubs',
  description = 'Deepen your knowledge of micro-tasks, campaign workflows, survey methodologies, and platform security standards.',
  guides,
  className = ''
}) => {
  if (!guides || guides.length === 0) return null;

  return (
    <section className={`pt-12 sm:pt-16 border-t border-slate-800/80 ${className}`}>
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" aria-hidden="true" />
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {guides.map((guide, idx) => (
          <Link
            key={idx}
            to={guide.to}
            onClick={() => seoAnalytics.trackArticleClick(guide.to, guide.title, guide.category || 'general')}
            className="group flex flex-col justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-sky-500/50 hover:bg-slate-900/90 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                {guide.category && (
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700/60">
                    {guide.category}
                  </span>
                )}
                {guide.tag && (
                  <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/40">
                    {guide.tag}
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors leading-snug">
                {guide.title}
              </h3>

              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-3">
                {guide.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-sky-400 group-hover:text-sky-300">
              <span>Read complete guide</span>
              <svg
                className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
