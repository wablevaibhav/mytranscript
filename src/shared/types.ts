/**
 * Types and interfaces for Google Meet Recorder & Local Transcript
 */

export type MeetingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'interrupted'
  | 'error';

export interface Meeting {
  id: string;                      // Unique ID (e.g. meet-abc-defg-hij-1725280000000)
  meetCode: string;                // e.g. "abc-defg-hij"
  title: string;                   // e.g. "Google Meet (abc-defg-hij)"
  url: string;                     // e.g. "https://meet.google.com/abc-defg-hij"
  tabId: number;                   // Chrome tab ID
  startedAt: number;               // Epoch timestamp (ms)
  endedAt?: number;                // Epoch timestamp (ms)
  duration: number;                // Cumulative active recorded seconds
  recordingMimeType?: string;      // e.g. "video/webm;codecs=vp9,opus"
  recordingSize?: number;          // Total bytes stored
  status: MeetingStatus;
  errorMessage?: string;
}

export interface TranscriptEntry {
  id: string;                      // Unique ID
  meetingId: string;               // Foreign key -> Meeting.id
  timestamp: number;               // Epoch timestamp (ms)
  relativeTime: number;            // Seconds elapsed since meeting start
  speaker: string;                 // Speaker name (e.g. "Rahul Wable")
  text: string;                    // Spoken text
  isFinal: boolean;                // Whether speaker has finished this utterance
}

export interface RecordingChunk {
  id?: number;                     // IndexedDB auto-increment primary key
  meetingId: string;               // Foreign key -> Meeting.id
  chunkIndex: number;              // 0, 1, 2, 3...
  data: ArrayBuffer | Blob;        // Binary media data
  timestamp: number;               // Epoch timestamp (ms)
  byteLength: number;              // Size of this chunk in bytes
}

export interface MeetingSettings {
  autoExportPdf: boolean;
  autoExportDocx: boolean;
  autoExportTxt: boolean;
  autoDownloadWebm: boolean;
  deleteAfterExport: boolean;
  timesliceIntervalMs: number;     // Default 3000ms
}

export type ExportFormat = 'pdf' | 'docx' | 'txt' | 'webm';

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  success: boolean;
  error?: string;
}

export interface TabInfo {
  tabId: number;
  url: string;
  isMeet: boolean;
  meetCode: string | null;
  title: string;
}
