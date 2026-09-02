/**
 * RecoveryBanner Component
 * Renders Screen 8 (Interrupted Recording Recovery Mode)
 */

import React from 'react';
import { AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import { Meeting } from '../../shared/types';
import { formatFullDate, formatDuration } from '../../shared/utils/formatters';

interface RecoveryBannerProps {
  meeting: Meeting;
  onRecover: (meetingId: string) => void;
  onDiscard: (meetingId: string) => void;
}

export const RecoveryBanner: React.FC<RecoveryBannerProps> = ({
  meeting,
  onRecover,
  onDiscard,
}) => {
  return (
    <div className="flex-1 flex flex-col p-5">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h2 className="text-sm font-semibold text-slate-100 mb-1">
        Interrupted Recording Found
      </h2>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        A previous Google Meet session was halted unexpectedly (e.g. browser crash or closed tab). You can recover and export the captured data.
      </p>

      <div className="p-3.5 rounded-xl bg-surface border border-subtle/60 mb-6 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Meeting:</span>
          <span className="text-slate-200 font-medium">{meeting.title || meeting.meetCode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Date:</span>
          <span className="text-slate-200">{formatFullDate(meeting.startedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Duration Recorded:</span>
          <span className="font-mono text-slate-200 font-semibold">{formatDuration(meeting.duration)}</span>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button
          onClick={() => onRecover(meeting.id)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Recover & Export Session</span>
        </button>

        <button
          onClick={() => onDiscard(meeting.id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-transparent hover:bg-red-950/20 text-red-400 text-xs font-medium rounded-lg transition-colors border border-transparent hover:border-red-500/20"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Discard Interrupted Data</span>
        </button>
      </div>
    </div>
  );
};
