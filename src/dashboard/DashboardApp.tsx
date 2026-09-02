import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Video,
  ShieldCheck,
  Clock,
  MessageSquare,
  HardDrive,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Play,
  Pause,
  Square,
  FileText,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  X,
  Sparkles,
  Activity,
  Layers,
} from 'lucide-react';
import { Meeting, TranscriptEntry, ExportFormat } from '../shared/types';
import {
  getAllMeetings,
  getDatabaseStats,
  getTranscripts,
  deleteMeetingData,
  clearAllData,
  DatabaseStats,
} from '../shared/db';
import { formatDuration, formatBytes } from '../shared/utils/formatters';
import { exportMeetingFile } from '../shared/export/exporter';

export const DashboardApp: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<DatabaseStats>({
    totalMeetings: 0,
    totalDurationSec: 0,
    totalTranscripts: 0,
    totalRecordingBytes: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recording' | 'completed' | 'interrupted'>('all');
  const [selectedMeetingForTranscript, setSelectedMeetingForTranscript] = useState<Meeting | null>(null);
  const [dialogTranscripts, setDialogTranscripts] = useState<TranscriptEntry[]>([]);
  const [isTranscriptsLoading, setIsTranscriptsLoading] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [activeMeetingLive, setActiveMeetingLive] = useState<Meeting | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<TranscriptEntry[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [allMeetings, dbStats] = await Promise.all([
        getAllMeetings(),
        getDatabaseStats(),
      ]);

      setMeetings(allMeetings);
      setStats(dbStats);

      // Check if there is an actively recording meeting
      const active = allMeetings.find((m) => m.status === 'recording' || m.status === 'paused' || m.status === 'starting');
      setActiveMeetingLive(active || null);

      if (active) {
        const trans = await getTranscripts(active.id);
        setLiveTranscripts(trans);
      }
    } catch (err) {
      console.error('Failed loading dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Refresh every 3 seconds for real-time live monitoring
    const interval = setInterval(() => {
      loadData();
    }, 3000);

    // Listen for runtime broadcasts from service worker
    const messageListener = (msg: { type: string; payload?: { meeting?: Meeting; entry?: TranscriptEntry } }) => {
      if (msg.type === 'RECORDING_STATE_CHANGED' || msg.type === 'CAPTION_UPDATE') {
        loadData();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      clearInterval(interval);
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [loadData]);

  // Open transcript modal
  const handleViewTranscript = async (meeting: Meeting) => {
    setSelectedMeetingForTranscript(meeting);
    setIsTranscriptsLoading(true);
    setTranscriptSearch('');
    try {
      const entries = await getTranscripts(meeting.id);
      setDialogTranscripts(entries);
    } catch (err) {
      showToast(`Failed loading transcript: ${String(err)}`, 'error');
    } finally {
      setIsTranscriptsLoading(false);
    }
  };

  // Export handler
  const handleExport = async (meetingId: string, format: ExportFormat) => {
    setExportingId(meetingId);
    try {
      await exportMeetingFile(meetingId, format);
      showToast(`Exported ${format.toUpperCase()} successfully!`, 'success');
    } catch (err) {
      showToast(`Export failed: ${String(err)}`, 'error');
    } finally {
      setExportingId(null);
    }
  };

  // Delete single meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this meeting recording and its transcripts?')) {
      return;
    }
    try {
      await deleteMeetingData(meetingId);
      showToast('Meeting data deleted permanently.', 'info');
      if (selectedMeetingForTranscript?.id === meetingId) {
        setSelectedMeetingForTranscript(null);
      }
      loadData();
    } catch (err) {
      showToast(`Delete failed: ${String(err)}`, 'error');
    }
  };

  // Clear all data
  const handleClearAll = async () => {
    if (!window.confirm('CAUTION: This will delete ALL local recordings and transcripts. Are you sure?')) {
      return;
    }
    try {
      await clearAllData();
      showToast('All local storage purged successfully.', 'info');
      setSelectedMeetingForTranscript(null);
      loadData();
    } catch (err) {
      showToast(`Purge failed: ${String(err)}`, 'error');
    }
  };

  // Controls for active meeting
  const handleSendControl = (action: 'PAUSE_RECORDING' | 'RESUME_RECORDING' | 'STOP_RECORDING') => {
    if (!activeMeetingLive) return;
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: action,
        payload: { meetingId: activeMeetingLive.id },
      });
      setTimeout(loadData, 500);
    }
  };

  // Copy full transcript text
  const handleCopyTranscript = () => {
    const text = dialogTranscripts
      .map((t) => `[${formatDuration(t.relativeTime)}] ${t.speaker}: ${t.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Transcript copied to clipboard!', 'success');
  };

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const matchesSearch =
        m.meetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.url && m.url.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'recording' && (m.status === 'recording' || m.status === 'paused')) ||
        (statusFilter === 'completed' && m.status === 'completed') ||
        (statusFilter === 'interrupted' && m.status === 'interrupted');

      return matchesSearch && matchesStatus;
    });
  }, [meetings, searchQuery, statusFilter]);

  // Filtered transcript entries in modal
  const filteredDialogTranscripts = useMemo(() => {
    if (!transcriptSearch.trim()) return dialogTranscripts;
    const query = transcriptSearch.toLowerCase();
    return dialogTranscripts.filter(
      (t) => t.speaker.toLowerCase().includes(query) || t.text.toLowerCase().includes(query)
    );
  }, [dialogTranscripts, transcriptSearch]);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-xs font-medium animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            notification.type === 'error'
              ? 'bg-red-950/90 border-red-500/40 text-red-200'
              : notification.type === 'info'
              ? 'bg-blue-950/90 border-blue-500/40 text-blue-200'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#0F172A]/90 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Google Meet Recorder</h1>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Dashboard
              </span>
            </div>
            <p className="text-xs text-slate-400">Local-First Private Recording & Real-Time Live Transcripts</p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.create({ url: 'https://meet.google.com/new' });
              } else {
                window.open('https://meet.google.com/new', '_blank');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all focus:outline-none"
          >
            <Video className="w-3.5 h-3.5" />
            <span>New Google Meet</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh dashboard stats"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors focus:outline-none"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-4 h-4" />
            <span>100% Local (No Cloud Upload)</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Active Recording Live Monitor Banner (if recording active) */}
        {activeMeetingLive && (
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/30 p-5 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider text-red-400">
                    {activeMeetingLive.status === 'paused' ? 'Recording Paused' : 'Live Meeting Recording Active'}
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700">
                    {formatDuration(activeMeetingLive.duration || 0)}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {activeMeetingLive.title}
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    ({activeMeetingLive.meetCode})
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {liveTranscripts.length} live dialogue entries captured so far • Video/Audio chunks streaming safely to local storage.
                </p>
              </div>

              {/* Active Recording Controls */}
              <div className="flex items-center gap-2.5">
                {activeMeetingLive.status === 'recording' ? (
                  <button
                    onClick={() => handleSendControl('PAUSE_RECORDING')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendControl('RESUME_RECORDING')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                )}

                <button
                  onClick={() => handleSendControl('STOP_RECORDING')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/20 transition-all"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop & Finalize</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Recorded</span>
              <Video className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats.totalMeetings}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Google Meet Sessions</span>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Recorded Time</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-white mb-1">
              {formatDuration(stats.totalDurationSec)}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Cumulative active audio & video</span>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Transcripts</span>
              <MessageSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats.totalTranscripts.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Spoken dialogue lines parsed</span>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Local Storage</span>
              <HardDrive className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatBytes(stats.totalRecordingBytes)}
            </div>
            <span className="text-[11px] text-purple-400/90 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3 h-3 text-purple-400" />
              <span>6-Hour Retention Managed</span>
            </span>
          </div>
        </section>

        {/* Meeting History Section */}
        <section className="bg-[#0F172A] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
          {/* Section Toolbar */}
          <div className="p-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/40">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Meeting Sessions & Saved Transcripts</h3>
              <span className="text-xs text-slate-400">({filteredMeetings.length})</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search meet code or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-48 sm:w-60 transition-colors"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
                {(['all', 'recording', 'completed', 'interrupted'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      statusFilter === tab
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {meetings.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-500/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Purge All</span>
                </button>
              )}
            </div>
          </div>

          {/* Table / List View */}
          {filteredMeetings.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Video className="w-10 h-10 mx-auto mb-3 text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-300 mb-1">No meeting sessions found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Open a Google Meet link in Chrome. The extension will automatically detect the meeting, start captions, and record.
              </p>
              <button
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.create({ url: 'https://meet.google.com/new' });
                  } else {
                    window.open('https://meet.google.com/new', '_blank');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors"
              >
                <span>Launch Google Meet</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filteredMeetings.map((m) => (
                <div
                  key={m.id}
                  className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left Column: Meeting Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {m.meetCode}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{m.title}</h4>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          m.status === 'recording'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : m.status === 'paused'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : m.status === 'interrupted'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(m.startedAt).toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono font-medium text-slate-300">
                          {formatDuration(m.duration || 0)}
                        </span>
                      </span>
                      {m.recordingSize ? (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatBytes(m.recordingSize)}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleViewTranscript(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>View Transcript</span>
                    </button>

                    {/* Exporters */}
                    <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700 p-0.5 gap-0.5">
                      <button
                        onClick={() => handleExport(m.id, 'pdf')}
                        disabled={exportingId === m.id}
                        title="Export as PDF"
                        className="px-2 py-1 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-red-400" />
                        <span>PDF</span>
                      </button>

                      <button
                        onClick={() => handleExport(m.id, 'docx')}
                        disabled={exportingId === m.id}
                        title="Export as Word DOCX"
                        className="px-2 py-1 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span>DOCX</span>
                      </button>

                      <button
                        onClick={() => handleExport(m.id, 'txt')}
                        disabled={exportingId === m.id}
                        title="Export as Plain TXT"
                        className="px-2 py-1 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>TXT</span>
                      </button>

                      <button
                        onClick={() => handleExport(m.id, 'webm')}
                        disabled={exportingId === m.id}
                        title="Download WebM Media Recording"
                        className="px-2 py-1 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Video className="w-3.5 h-3.5 text-purple-400" />
                        <span>WebM</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteMeeting(m.id)}
                      title="Delete recording and transcripts"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Transcript Drawer / Dialog Modal */}
      {selectedMeetingForTranscript && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {selectedMeetingForTranscript.title}
                  </h3>
                  <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {selectedMeetingForTranscript.meetCode}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Duration: {formatDuration(selectedMeetingForTranscript.duration)} • {dialogTranscripts.length} dialogue entries
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTranscript}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy All'}</span>
                </button>

                <button
                  onClick={() => setSelectedMeetingForTranscript(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Filter inside Modal */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/30 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter spoken text or speaker name..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs bg-slate-800/60 border border-slate-700/60 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Quick Export in modal */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => handleExport(selectedMeetingForTranscript.id, 'pdf')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3 h-3 text-red-400" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleExport(selectedMeetingForTranscript.id, 'docx')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 flex items-center gap-1"
                >
                  <FileText className="w-3 h-3 text-blue-400" />
                  <span>DOCX</span>
                </button>
                <button
                  onClick={() => handleExport(selectedMeetingForTranscript.id, 'txt')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 flex items-center gap-1"
                >
                  <FileCode className="w-3 h-3 text-emerald-400" />
                  <span>TXT</span>
                </button>
              </div>
            </div>

            {/* Dialogue Viewport */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[500px]">
              {isTranscriptsLoading ? (
                <div className="text-center py-12 text-xs text-slate-400">Loading transcripts...</div>
              ) : filteredDialogTranscripts.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  {transcriptSearch ? 'No matches found for search keyword.' : 'No transcript text recorded for this meeting.'}
                </div>
              ) : (
                filteredDialogTranscripts.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-300 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/20 text-[11px]">
                          {entry.speaker}
                        </span>
                        {!entry.isFinal && (
                          <span className="text-[10px] text-amber-400 animate-pulse font-mono">(speaking...)</span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {formatDuration(entry.relativeTime)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed pl-1 pt-0.5">
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
