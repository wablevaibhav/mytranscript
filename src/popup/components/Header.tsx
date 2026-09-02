/**
 * Header Component
 * Displays application title, logo, and local privacy badge.
 */

import React from 'react';
import { Video, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  statusText?: string;
}

export const Header: React.FC<HeaderProps> = ({ statusText }) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-subtle/40">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <Video className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-1.5">
            Meet Recorder
            {statusText && (
              <span className="text-[11px] font-normal text-slate-400 px-1.5 py-0.5 rounded bg-elevated">
                {statusText}
              </span>
            )}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
            } else {
              window.open('/dashboard.html', '_blank');
            }
          }}
          title="Open Full Dashboard & History"
          className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white bg-surface hover:bg-elevated border border-subtle/60 px-2 py-1 rounded transition-colors focus:outline-none"
        >
          <span>Dashboard</span>
          <span className="text-[10px]">↗</span>
        </button>

        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% Local</span>
        </div>
      </div>
    </header>
  );
};
