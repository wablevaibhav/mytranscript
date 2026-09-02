/**
 * CompletedView Component
 * Renders Screen 5 (Meeting Summary & Export Actions) and Screen 6 (Export Confirmation & Purge Feedback)
 */

import React, { useState } from 'react';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  Video,
  Trash2,
  DownloadCloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Meeting, TranscriptEntry, ExportFormat } from '../../shared/types';
import { formatDuration, formatBytes } from '../../shared/utils/formatters';
import { exportMeetingFile, exportAndPurgeMeeting } from '../../shared/export/exporter';

interface CompletedViewProps {
  meeting: Meeting;
  transcripts: TranscriptEntry[];
  onDeleteRequest: () => void;
  onDone: () => void;
}

export const CompletedView: React.FC<CompletedViewProps> = ({
  meeting,
  transcripts,
  onDeleteRequest,
  onDone,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | 'all' | null>(null);
  const [isPurged, setIsPurged] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExportSingle = async (format: ExportFormat) => {
    setIsExporting(true);
    setActiveFormat(format);
    setErrorMessage(null);

    try {
      await exportMeetingFile(meeting.id, format);
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsExporting(false);
      setActiveFormat(null);
    }
  };

  const handleExportAllAndPurge = async () => {
    setIsExporting(true);
    setActiveFormat('all');
    setErrorMessage(null);

    try {
      await exportAndPurgeMeeting(meeting.id, ['pdf', 'docx', 'txt', 'webm']);
      setIsPurged(true);
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsExporting(false);
      setActiveFormat(null);
    }
  };

  // Screen 6: Post-Purge Confirmation
  if (isPurged) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h2 className="text-base font-semibold text-slate-100 mb-1.5">
          Exported & Purged Successfully
        </h2>
        <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed mb-6">
          Your files have been saved to your device. All local meeting recordings and transcript chunks were permanently purged from browser storage.
        </p>

        <button
          onClick={onDone}
          className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus:outline-none"
        >
          Done
        </button>
      </div>
    );
  }

  // Screen 5: Completed Meeting Summary
  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto">
      {/* Summary Box */}
      <div className="p-3.5 rounded-xl bg-surface border border-subtle/50 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-200">Meeting Summary</span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-subtle/30 text-center">
          <div className="p-2 rounded bg-base/60">
            <span className="block text-[10px] text-slate-400 uppercase">Duration</span>
            <span className="font-mono text-xs font-bold text-slate-200">
              {formatDuration(meeting.duration)}
            </span>
          </div>

          <div className="p-2 rounded bg-base/60">
            <span className="block text-[10px] text-slate-400 uppercase">Transcripts</span>
            <span className="font-mono text-xs font-bold text-slate-200">
              {transcripts.length}
            </span>
          </div>

          <div className="p-2 rounded bg-base/60">
            <span className="block text-[10px] text-slate-400 uppercase">Recording</span>
            <span className="font-mono text-xs font-bold text-slate-200">
              {formatBytes(meeting.recordingSize || 0)}
            </span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Transcript Export Options */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Export Transcript
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleExportSingle('pdf')}
            disabled={isExporting}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-surface hover:bg-elevated border border-subtle/60 text-slate-200 transition-colors focus:outline-none disabled:opacity-50"
          >
            {isExporting && activeFormat === 'pdf' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 mb-1" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-red-400 mb-1" />
            )}
            <span className="text-xs font-medium">PDF</span>
          </button>

          <button
            onClick={() => handleExportSingle('docx')}
            disabled={isExporting}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-surface hover:bg-elevated border border-subtle/60 text-slate-200 transition-colors focus:outline-none disabled:opacity-50"
          >
            {isExporting && activeFormat === 'docx' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 mb-1" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400 mb-1" />
            )}
            <span className="text-xs font-medium">DOCX</span>
          </button>

          <button
            onClick={() => handleExportSingle('txt')}
            disabled={isExporting}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-surface hover:bg-elevated border border-subtle/60 text-slate-200 transition-colors focus:outline-none disabled:opacity-50"
          >
            {isExporting && activeFormat === 'txt' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 mb-1" />
            ) : (
              <FileCode className="w-4 h-4 text-emerald-400 mb-1" />
            )}
            <span className="text-xs font-medium">TXT</span>
          </button>
        </div>
      </div>

      {/* Media Export */}
      <div className="mb-5">
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Export Media
        </label>
        <button
          onClick={() => handleExportSingle('webm')}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface hover:bg-elevated border border-subtle/60 text-slate-200 text-xs font-medium transition-colors focus:outline-none disabled:opacity-50"
        >
          {isExporting && activeFormat === 'webm' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          ) : (
            <Video className="w-3.5 h-3.5 text-purple-400" />
          )}
          <span>Download WebM Recording</span>
        </button>
      </div>

      {/* Main Workflow Buttons */}
      <div className="mt-auto space-y-2 pt-2 border-t border-subtle/40">
        <button
          onClick={handleExportAllAndPurge}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-md transition-colors focus:outline-none disabled:opacity-50"
        >
          {isExporting && activeFormat === 'all' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <DownloadCloud className="w-3.5 h-3.5" />
          )}
          <span>Export All & Delete Local Data</span>
        </button>

        <button
          onClick={onDeleteRequest}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-transparent hover:bg-red-950/30 text-red-400 text-xs font-medium rounded-lg transition-colors border border-transparent hover:border-red-500/20 focus:outline-none"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Meeting Data</span>
        </button>
      </div>
    </div>
  );
};
