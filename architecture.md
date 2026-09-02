# Technical Architecture Document (`architecture.md`)

This document details the architectural design, data models, message passing protocols, storage layers, and execution lifecycles for the **Google Meet Recorder & Local Transcript** Chrome Extension.

---

## 1. System Overview & Tech Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                           Google Meet Tab                              │
│                                                                        │
│   ┌──────────────────────────┐          ┌──────────────────────────┐   │
│   │ Google Meet Live Captions│          │ Video Canvas / WebRTC    │   │
│   │       DOM Elements       │          │      Audio Tracks        │   │
│   └─────────────┬────────────┘          └─────────────┬────────────┘   │
└─────────────────┼─────────────────────────────────────┼────────────────┘
                  │ DOM MutationObserver                │ chrome.tabCapture StreamId
                  ▼                                     ▼
        ┌──────────────────┐                  ┌──────────────────┐
        │  Content Script  │                  │  Service Worker  │ (Coordinator)
        └─────────┬────────┘                  └─────────┬────────┘
                  │ chrome.runtime.sendMessage          │ chrome.offscreen.createDocument
                  ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Offscreen Document                           │
│                                                                        │
│   ┌─────────────────────────┐             ┌─────────────────────────┐  │
│   │ navigator.mediaDevices  │             │   AudioContext Graph    │  │
│   │     .getUserMedia()     ├────────────►│ (Loopback to Speakers)  │  │
│   └─────────────┬───────────┘             └─────────────────────────┘  │
│                 │ MediaStream                                          │
│                 ▼                                                      │
│   ┌─────────────────────────┐  timeslice (3s)  ┌────────────────────┐  │
│   │      MediaRecorder      ├─────────────────►│ Binary Chunk Writer│  │
│   │    (VP9/VP8 + Opus)     │                  │    (IndexedDB)     │  │
│   └─────────────────────────┘                  └──────────┬─────────┘  │
└───────────────────────────────────────────────────────────┼────────────┘
                                                            │
                                                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        IndexedDB Storage Layer                         │
│                                                                        │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│   │  meetings store  │  │ transcripts store│  │recordingChunks store│  │
│   └─────────┬────────┘  └────────┬─────────┘  └─────────┬──────────┘   │
└─────────────┼────────────────────┼──────────────────────┼──────────────┘
              │                    │                      │
              ▼                    ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      React Popup UI (Manifest V3)                      │
│                                                                        │
│   ┌─────────────────────────┐             ┌─────────────────────────┐  │
│   │ Real-time State & Timer │             │  Live Transcript Feed   │  │
│   └─────────────┬───────────┘             └─────────────┬───────────┘  │
│                 │                                       │              │
│                 ▼                                       ▼              │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                     Client-Side Export Layer                    │  │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│   │   │  PDF (jsPDF) │  │ DOCX (docx)  │  │  TXT (Blob)  │          │  │
│   │   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │  │
│   │          └─────────────────┼─────────────────┘                  │  │
│   │                            ▼                                    │  │
│   │             Local Download -> Confirm -> IndexedDB Wipe         │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Frontend Framework**: React 18+ with TypeScript
- **Bundler & Tooling**: Vite with custom multi-page rollup outputs for MV3 extension targets
- **Extension Standard**: Chrome Manifest V3
- **Document Exporters**: `jspdf` (PDF), `docx` (Word DOCX)
- **Local Database**: IndexedDB (Native Promisified Storage Wrapper)
- **Icons**: `lucide-react` (SVGs bundled statically)

---

## 2. Component Specifications

### 2.1 React Popup (`src/popup/`)
- Renders the interactive interface when the user clicks the extension toolbar icon.
- Queries the background service worker on mount to determine active Meet status and recording state.
- Subscribes to live transcript broadcasts and updates the UI in real time.
- Triggers export routines and coordinates atomic download-and-delete workflows.
- Lightweight: unmounts cleanly without affecting ongoing recording.

### 2.2 Background Service Worker (`src/background/serviceWorker.ts`)
- The central orchestrator running in the extension’s background service worker.
- Manages the lifecycle of the Offscreen Document (`chrome.offscreen`).
- Listens for tab activation and URL changes to detect Google Meet sessions.
- Generates capture stream identifiers using `chrome.tabCapture.getMediaStreamId({ targetTabId })`.
- Relays messages between Content Script, Offscreen Document, and Popup.
- Maintains runtime session tracking in `chrome.storage.local`.

### 2.3 Offscreen Document (`src/offscreen/offscreen.ts`)
- A hidden sandboxed HTML document loaded via `chrome.offscreen.createDocument({ reasons: ['USER_MEDIA'], justification: 'Record Google Meet tab media and audio loopback' })`.
- Calls `navigator.mediaDevices.getUserMedia()` using the `streamId` provided by the service worker.
- Instantiates a `MediaRecorder` instance with optimal codec detection (`video/webm;codecs=vp9,opus`).
- Routes audio into an `AudioContext` connected to `audioContext.destination` to prevent muting the meeting for the user.
- Emits chunks via `ondataavailable` at 3000ms intervals and saves them directly to IndexedDB.

### 2.4 Content Script (`src/content/contentScript.ts`)
- Automatically injected into `https://meet.google.com/*` tabs.
- Detects the Google Meet call state and meeting code.
- Attaches a `MutationObserver` to observe caption DOM containers.
- Filters and deduplicates incremental speech updates from Google Meet's live captions.
- Formats caption events into `TranscriptEntry` payloads and dispatches them via `chrome.runtime.sendMessage`.

### 2.5 IndexedDB Storage Layer (`src/shared/db.ts`)
- High-performance, client-side transactional storage (`meet_recorder_db`, Version 1).
- Houses three dedicated object stores: `meetings`, `transcripts`, and `recordingChunks`.
- Facilitates crash recovery for unfinalized sessions and chunk assembly during WebM export.

### 2.6 Export Engine (`src/shared/export/`)
- **PDF Engine (`pdf.ts`)**: Builds styled, paginated documents via `jsPDF` containing meeting headers, speaker badges, timestamps, and multi-line word-wrapped dialogues.
- **DOCX Engine (`docx.ts`)**: Assembles `.docx` files with metadata overview tables and dialogue blocks with distinct speaker headings.
- **TXT Engine (`txt.ts`)**: Formats clean UTF-8 text files.
- **WebM Assembler (`webm.ts`)**: Reads sequential binary chunks from IndexedDB and concatenates them into a unified `Blob`.

---

## 3. Data Models & TypeScript Interfaces

```typescript
// src/shared/types.ts

export type MeetingStatus = 'idle' | 'recording' | 'paused' | 'completed' | 'interrupted' | 'error';

export interface Meeting {
  id: string;                      // Unique UUID or meetCode + timestamp
  meetCode: string;                // e.g. "abc-defg-hij"
  title: string;                   // "Google Meet (abc-defg-hij)"
  url: string;                     // "https://meet.google.com/abc-defg-hij"
  tabId: number;                   // Chrome tab ID
  startedAt: number;               // Epoch timestamp (ms)
  endedAt?: number;                // Epoch timestamp (ms)
  duration: number;                // Cumulative active seconds recorded (excluding paused time)
  recordingMimeType?: string;      // e.g. "video/webm;codecs=vp9,opus"
  recordingSize?: number;          // Total bytes recorded
  status: MeetingStatus;
  errorMessage?: string;
}

export interface TranscriptEntry {
  id: string;                      // Unique UUID
  meetingId: string;               // Foreign key -> Meeting.id
  timestamp: number;               // Epoch timestamp (ms)
  relativeTime: number;            // Seconds elapsed since recording start
  speaker: string;                 // Extracted speaker name (e.g. "Rahul Wable")
  text: string;                    // Spoken dialogue text
  isFinal: boolean;                // Whether this phrase has finished updating
}

export interface RecordingChunk {
  id?: number;                     // Auto-increment primary key
  meetingId: string;               // Foreign key -> Meeting.id
  chunkIndex: number;              // 0, 1, 2, 3...
  data: ArrayBuffer | Blob;        // Binary media slice
  timestamp: number;               // Timestamp when chunk was captured
  byteLength: number;              // Size of chunk in bytes
}

export interface MeetingSettings {
  autoExportPdf: boolean;
  autoExportDocx: boolean;
  autoExportTxt: boolean;
  autoDownloadWebm: boolean;
  deleteAfterExport: boolean;
  timesliceIntervalMs: number;     // Default: 3000ms
}
```

---

## 4. Message Passing Architecture

All inter-component communication is strictly typed using a discriminated union pattern over `type`.

```typescript
// src/shared/messages.ts

import { Meeting, MeetingStatus, TranscriptEntry } from './types';

export type ExtensionMessage =
  // Popup -> Service Worker
  | { type: 'START_RECORDING'; payload: { tabId: number; meetCode: string; url: string } }
  | { type: 'STOP_RECORDING'; payload: { meetingId: string } }
  | { type: 'PAUSE_RECORDING'; payload: { meetingId: string } }
  | { type: 'RESUME_RECORDING'; payload: { meetingId: string } }
  | { type: 'GET_STATUS' }
  | { type: 'DELETE_MEETING'; payload: { meetingId: string } }
  | { type: 'RECOVER_MEETING'; payload: { meetingId: string } }

  // Service Worker -> Offscreen Document
  | { type: 'OFFSCREEN_START_CAPTURE'; payload: { streamId: string; meetingId: string; timesliceMs: number } }
  | { type: 'OFFSCREEN_PAUSE_CAPTURE'; payload: { meetingId: string } }
  | { type: 'OFFSCREEN_RESUME_CAPTURE'; payload: { meetingId: string } }
  | { type: 'OFFSCREEN_STOP_CAPTURE'; payload: { meetingId: string } }

  // Content Script -> Service Worker -> Popup
  | { type: 'CAPTION_UPDATE'; payload: { meetingId: string; entry: TranscriptEntry } }
  | { type: 'MEET_PAGE_DETECTED'; payload: { meetCode: string; url: string } }

  // Offscreen / Service Worker -> Popup (Broadcasts)
  | { type: 'RECORDING_STATE_CHANGED'; payload: { meeting: Meeting; status: MeetingStatus } }
  | { type: 'CHUNK_SAVED'; payload: { meetingId: string; chunkIndex: number; totalBytes: number } }
  | { type: 'RECORDING_ERROR'; payload: { meetingId?: string; error: string } };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Message Interaction Matrix

| Message Type | Sender | Receiver | Purpose |
|---|---|---|---|
| `START_RECORDING` | Popup | Service Worker | Request tab capture stream & start recording |
| `OFFSCREEN_START_CAPTURE` | Service Worker | Offscreen | Instruct offscreen recorder to acquire stream & begin MediaRecorder |
| `PAUSE_RECORDING` | Popup | Service Worker / Offscreen | Freeze timer & pause MediaRecorder |
| `RESUME_RECORDING` | Popup | Service Worker / Offscreen | Resume timer & resume MediaRecorder |
| `STOP_RECORDING` | Popup | Service Worker / Offscreen | Finalize recording, flush remaining chunks, update meeting status |
| `CAPTION_UPDATE` | Content Script | Service Worker / Popup | Stream real-time speaker dialogue into DB & UI |
| `GET_STATUS` | Popup | Service Worker | Hydrate popup state upon initial mount |
| `DELETE_MEETING` | Popup | Storage Layer / Service Worker | Wipe all DB records for a meeting |

---

## 5. Storage Architecture & IndexedDB Schema

Database Name: `meet_recorder_db`  
Version: `1`

### 5.1 Object Store: `meetings`
- **Key Path**: `id` (string, UUID)
- **Indexes**:
  - `status`: Index on `status` (for finding active or interrupted meetings)
  - `startedAt`: Index on `startedAt` (for chronological listing)

### 5.2 Object Store: `transcripts`
- **Key Path**: `id` (string, UUID)
- **Indexes**:
  - `meetingId`: Index on `meetingId` (for fast batch retrieval of meeting dialogues)
  - `meetingId_timestamp`: Compound index on `[meetingId, timestamp]`

### 5.3 Object Store: `recordingChunks`
- **Key Path**: `id` (auto-increment integer)
- **Indexes**:
  - `meetingId`: Index on `meetingId`
  - `meetingId_chunkIndex`: Compound index on `[meetingId, chunkIndex]` for ordered binary assembly.

---

## 6. Execution Lifecycles

### 6.1 Recording Lifecycle State Machine

```text
               ┌──────────────┐
               │     IDLE     │
               └──────┬───────┘
                      │ User clicks "Start Recording"
                      ▼
               ┌──────────────┐
               │   STARTING   │  (Obtaining Tab StreamId, Creating Offscreen)
               └──────┬───────┘
                      │ Stream acquired & MediaRecorder started
                      ▼
        ┌──────► ┌──────────┐ ◄──────┐
        │        │RECORDING │        │ User clicks "Resume"
        │        └────┬─────┘        │
User clicks "Pause"   │              │
        │             ▼              │
        └──────── ┌──────────┐ ──────┘
                  │  PAUSED  │
                  └────┬─────┘
                       │ User clicks "Stop" / Meet tab navigates away
                       ▼
                 ┌──────────┐
                 │ STOPPING │ (Flush final chunks to IndexedDB)
                 └─────┬────┘
                       │ Chunks finalized
                       ▼
                 ┌───────────┐
                 │ COMPLETED │
                 └───────────┘
```

### 6.2 Export & Purge Lifecycle

```text
┌─────────────────────────┐
│ Meeting Status: Completed│
└────────────┬────────────┘
             │ User triggers "Export All & Delete" or specific format
             ▼
┌─────────────────────────┐
│ Retrieve DB Records     │ (Fetch meeting metadata, transcripts, chunks)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Generate Target Blob    │ (PDF via jsPDF / DOCX via docx / TXT / WebM)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Trigger Browser Download│ (Via chrome.downloads or Blob URL anchor trigger)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Verify Download Success │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Purge IndexedDB Records │ (Delete chunks, transcripts, and meeting metadata)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ UI: Confirmed Purged    │
└─────────────────────────┘
```

---

## 7. Security & Privacy Guarantees

1. **Absolute Local Isolation**: The Manifest V3 Content Security Policy enforces:
   ```json
   "content_security_policy": {
     "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'none';"
   }
   ```
   No network connections (`connect-src 'none'`) are permitted from extension pages.
2. **Local Audio Loopback**: Captured tab audio is explicitly re-routed to the user's audio output within the Offscreen `AudioContext`, ensuring zero disruption to live meeting conversation.
3. **Safe Memory Thresholds**: By writing slices to IndexedDB every 3000ms, the extension keeps RAM consumption bounded regardless of meeting duration.
