/**
 * MeetStatusCard Component
 * Renders Screen 1 (Not on Google Meet) or Screen 2 (Google Meet Detected / Ready to Record)
 */

import React from 'react';
import { Video, ExternalLink, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { TabInfo } from '../../shared/types';
import { openGoogleMeetTab } from '../../shared/utils/tab';

interface MeetStatusCardProps {
  tabInfo: TabInfo;
  onStartRecording: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export const MeetStatusCard: React.FC<MeetStatusCardProps> = ({
  tabInfo,
  onStartRecording,
  isLoading,
  errorMessage,
}) => {
  if (!tabInfo.isMeet) {
    // Screen 1: Not on Google Meet
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface border border-subtle flex items-center justify-center text-slate-400 mb-4 shadow-sm">
          <Video className="w-7 h-7 text-blue-400" />
        </div>

        <h2 className="text-base font-semibold text-slate-100 mb-1.5">
          Not on Google Meet
        </h2>
        <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed mb-6">
          Open or join a Google Meet call in Chrome to start capturing local transcripts and recording.
        </p>

        <button
          onClick={openGoogleMeetTab}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>Open Google Meet</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Screen 2: Google Meet Detected (Ready)
  return (
    <div className="flex-1 flex flex-col p-5">
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-subtle/50 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-200">Google Meet Detected</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
            {tabInfo.meetCode ? `meet.google.com/${tabInfo.meetCode}` : tabInfo.url}
          </p>
        </div>
      </div>

      {/* Pro-tip for closed captions */}
      <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 mb-5">
        <div className="flex items-start gap-2 text-blue-300 mb-1">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="text-xs font-medium">Live Captions Requirement</span>
        </div>
        <p className="text-[11px] text-blue-200/70 leading-relaxed">
          Ensure closed captions are turned on in Google Meet (press <kbd className="px-1 py-0.5 rounded bg-blue-900/60 font-mono text-[10px] text-blue-100">c</kbd>) to enable real-time speaker transcription.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-auto">
        <button
          onClick={onStartRecording}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-accent hover:bg-accent-hover active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>Start Recording</span>
        </button>
      </div>
    </div>
  );
};
