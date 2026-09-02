/**
 * TranscriptFeed Component
 * Renders real-time live captions with speaker badges, auto-scroll, and search filtering.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, ArrowDown, Sparkles } from 'lucide-react';
import { TranscriptEntry } from '../../shared/types';
import { formatTimestamp } from '../../shared/utils/formatters';

interface TranscriptFeedProps {
  transcripts: TranscriptEntry[];
  isLoading?: boolean;
}

// Deterministic speaker color mapping
const SPEAKER_COLORS = [
  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'text-rose-400 bg-rose-500/10 border-rose-500/20',
];

function getSpeakerColor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[index];
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({ transcripts, isLoading }) => {
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new entries if autoScroll enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, autoScroll]);

  // Filter transcripts by search query
  const filtered = transcripts.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.text.toLowerCase().includes(q) || t.speaker.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-base">
      {/* Top Header of Feed */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface/40 border-b border-subtle/30 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>Live Transcript</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-elevated text-slate-300">
            {transcripts.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded hover:bg-elevated transition-colors ${
              showSearch ? 'text-blue-400' : 'text-slate-400'
            }`}
            title="Search Transcript"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-surface border-subtle text-blue-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Search Input Bar (collapsible) */}
      {showSearch && (
        <div className="px-3 py-2 bg-surface border-b border-subtle/40">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dialogue or speaker..."
            className="w-full px-2.5 py-1 text-xs bg-base rounded border border-subtle text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
      )}

      {/* Scrollable Dialogue List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading && transcripts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Loading transcript history...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            {searchQuery ? (
              <p className="text-xs">No entries match &quot;{searchQuery}&quot;</p>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <p className="text-xs font-medium text-slate-200 mb-1">
                  Listening for Google Meet Captions...
                </p>
                <p className="text-[11px] text-slate-400 max-w-[240px] leading-relaxed">
                  Turn on live captions in Google Meet (<kbd className="px-1 py-0.5 rounded bg-surface border border-subtle font-mono text-[10px] text-slate-300">c</kbd>) to start capturing speech in real time.
                </p>
              </>
            )}
          </div>
        ) : (
          filtered.map((entry) => {
            const colorClass = getSpeakerColor(entry.speaker);

            return (
              <div
                key={entry.id}
                className="p-2.5 rounded-lg bg-surface/80 border border-subtle/40 hover:border-subtle/80 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border truncate ${colorClass}`}
                    >
                      {entry.speaker}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed break-words">
                  {entry.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Scroll-To-Bottom Floating Button */}
      {!autoScroll && transcripts.length > 5 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-12 right-4 p-2 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 transition-transform active:scale-95"
          title="Scroll to latest"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
