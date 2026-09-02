/**
 * RecordingControls Component
 * Renders live timer and controls for Screen 3 (Recording) and Screen 4 (Paused)
 */

import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { MeetingStatus } from '../../shared/types';
import { useRecordingTimer } from '../hooks/useRecordingTimer';

interface RecordingControlsProps {
  status: MeetingStatus;
  initialDuration: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  status,
  initialDuration,
  onPause,
  onResume,
  onStop,
}) => {
  const { formattedTime } = useRecordingTimer(initialDuration, status);
  const isPaused = status === 'paused';

  return (
    <div className="p-3 bg-surface border-b border-subtle/40 flex items-center justify-between">
      {/* State & Timer Indicator */}
      <div className="flex items-center gap-2.5">
        {isPaused ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-500/30 text-amber-400 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>PAUSED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-ring" />
            <span>REC</span>
          </div>
        )}

        <span className="font-mono text-sm font-semibold text-slate-100 tracking-wider">
          {formattedTime}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {isPaused ? (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            title="Resume Recording"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-elevated hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            title="Pause Recording"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Pause</span>
          </button>
        )}

        <button
          onClick={onStop}
          className="flex items-center gap-1.5 py-1.5 px-3 bg-red-600/90 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          title="Stop Recording"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
};
