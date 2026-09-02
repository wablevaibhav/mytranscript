# Google Meet Recorder & Local Transcript 🎙️🛡️

> **Privacy-First, Local-First Google Chrome Extension for Google Meet.**  
> Record meetings locally, capture live speaker transcripts from closed captions in real time, and export directly to PDF, DOCX, TXT, and WebM without sending a single byte of data to the cloud.

---

## 🔒 Core Privacy Guarantee

This extension is built on an uncompromising **local-first, privacy-first** principle:

* ❌ **No Cloud Servers & No Backends**
* ❌ **No Firebase / Supabase / Remote DBs**
* ❌ **No External Speech-to-Text or AI APIs** (No Whisper, Google STT, AWS Transcribe)
* ❌ **No Telemetry, Analytics, or Tracking SDKs**
* ❌ **No User Accounts, Sign-in, or Passwords**
* ❌ **No Remote Code Execution** (`connect-src 'none'` CSP enforced)

**All video, audio, and transcript processing occurs 100% inside your local browser.**

---

## ✨ Features

- **🎥 Local Video & Audio Recording**: High-fidelity WebM recording using native `chrome.tabCapture` and `MediaRecorder` running inside a Manifest V3 Offscreen Document.
- **🔊 Tab Audio Loopback**: Audio routing via Web Audio API ensures the meeting remains completely audible through your speakers while recording.
- **📝 Real-Time Live Captions Transcript**: Ingests Google Meet's native closed captions using a high-performance `MutationObserver`, attributing dialogue to speakers with timestamps.
- **⚡ Live Transcript UI**: Real-time dialogue feed with auto-scroll pinning, speaker badges, and quick search.
- **💾 Low-RAM Timeslice Storage**: Flushes 3-second binary chunks directly to IndexedDB to keep browser memory footprint minimal during multi-hour meetings.
- **📄 Multi-Format Document Export**:
  - **PDF**: Formatted document with meeting metadata header, speaker-colored badges, timestamps, and page numbers via `jsPDF`.
  - **DOCX**: Formatted Microsoft Word document with structured metadata tables and dialogue sections via `docx`.
  - **TXT**: Clean, chronological plain-text transcript with standardized headers.
  - **WebM**: Assembled full-quality video/audio recording file.
- **🚀 Verified "Export All & Delete"**: Downloads all files to your workstation and automatically purges all temporary IndexedDB data once downloads are confirmed.
- **🗑️ Manual Data Purge**: Permanently wipe all meeting records on demand.
- **🔄 Interrupted Session Recovery**: Recovers unfinalized recordings in the event of an unexpected browser crash or closed tab.
- **🛡️ Background Resiliency**: Closing or reopening the popup has zero impact on ongoing recordings.

---

## 🏗️ Architecture

```text
Google Meet Tab (meet.google.com)
  │
  ├── [Content Script] (Isolated DOM MutationObserver for live captions)
  │         │ (chrome.runtime messaging)
  │         ▼
  ├── [Service Worker] (MV3 Lifecycle, Tab Capture Coordinator, State Machine)
  │         │
  │         ├── [Offscreen Document] (MediaRecorder, AudioContext loopback)
  │         │         │
  │         │         ▼
  │         └───► [IndexedDB Store] (meet_recorder_db: meetings, transcripts, recordingChunks)
  │                   │
  └─────────────► [React Popup UI] (Tailwind Design System, Live Transcript Feed, Export & Delete)
                      │
                      ├── PDF Export (jsPDF)
                      ├── DOCX Export (docx)
                      ├── TXT Export (UTF-8 Blob)
                      └── WebM Download (Concatenated MediaRecorder Chunks)
```

---

## 🛠️ Tech Stack

- **Framework**: React 18, TypeScript (Strict Mode)
- **Extension Standard**: Chrome Manifest V3
- **Bundler & Tooling**: Vite 6, Tailwind CSS
- **Local Storage**: IndexedDB (Native Promisified Layer)
- **Document Generation**: `jspdf`, `docx`
- **Icons**: `lucide-react`
- **Testing**: `vitest`

---

## 🚀 Getting Started

### Prerequisites

- **Google Chrome** (or Chromium-based browser: Brave, Edge, Opera)
- **Node.js** v18+ and **npm** v9+

### 1. Clone & Install

```bash
git clone https://github.com/your-username/google-meet-local-recorder.git
cd google-meet-local-recorder
npm install
```

### 2. Run Tests

```bash
npm test
```

### 3. Build the Extension

```bash
npm run build
```

This compiles TypeScript, bundles React, and outputs production assets into the `dist/` folder.

---

## 📦 Loading the Extension into Chrome

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. In the top-right corner, turn on **Developer mode**.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `dist` folder inside the project directory:
   ```text
   /path/to/google-meet-local-recorder/dist
   ```
5. The extension icon will now appear in your Chrome toolbar. Pin it for quick access!

---

## 📖 How to Use

1. **Join Google Meet**: Open or join any meeting on [`https://meet.google.com`](https://meet.google.com).
2. **Turn on Captions**: Click the **Turn on captions** button in the Google Meet toolbar (or press <kbd>c</kbd>).
3. **Open Extension Popup**: Click the **Meet Recorder** extension icon.
4. **Start Recording**: Click **● Start Recording**.
5. **Monitor Live Speech**: As participants speak, their words appear in real-time in the Live Transcript feed with speaker labels and timestamps.
6. **Popup Freedom**: You can safely close the popup during the meeting. The recording will continue in the background.
7. **Pause / Stop**: Click **Pause** or **Stop** at any time.
8. **Export Files**:
   - Click individual format buttons (**PDF**, **DOCX**, **TXT**, **WebM**).
   - Or click **Export All & Delete Local Data** to download your files and immediately purge local browser storage.

---

## 📁 Repository Structure

```text
├── prd.md                     # Product Requirements Document
├── rules.md                   # Engineering Rules & Guidelines
├── design.md                  # UX/UI Design Specification
├── architecture.md            # Technical Architecture
├── phases.md                  # Development Roadmap & Milestones
├── index.html                 # Extension Popup HTML
├── offscreen.html             # Offscreen Document HTML
├── public/
│   ├── manifest.json          # Chrome Manifest V3 configuration
│   └── icons/                 # Extension Icons
├── src/
│   ├── background/
│   │   └── serviceWorker.ts   # MV3 background coordinator
│   ├── content/
│   │   ├── contentScript.ts   # Google Meet injected script
│   │   ├── captionObserver.ts # DOM MutationObserver for live captions
│   │   ├── selectors.ts       # Isolated Google Meet DOM selectors
│   │   └── contentLogger.ts   # Isolated content logger
│   ├── offscreen/
│   │   ├── offscreen.ts       # Offscreen message router
│   │   └── mediaRecorderEngine.ts # MediaRecorder & Audio Loopback
│   ├── popup/
│   │   ├── App.tsx            # Main React UI Coordinator
│   │   ├── main.tsx           # React Mount
│   │   ├── index.css          # Tailwind CSS styles & animations
│   │   ├── components/        # Atomic UI components
│   │   └── hooks/             # React Custom Hooks
│   ├── shared/
│   │   ├── types.ts           # Shared TypeScript models
│   │   ├── messages.ts        # Strongly-typed runtime message contracts
│   │   ├── db.ts              # Promisified IndexedDB storage
│   │   ├── export/            # PDF, DOCX, TXT, WebM exporters
│   │   └── utils/             # Formatters, tab queries, logger
│   └── __tests__/             # Unit tests
└── dist/                      # Production build output
```

---

## 🔐 Security & Permissions

This extension requests only the minimum required permissions in `manifest.json`:

| Permission | Justification |
|---|---|
| `tabCapture` | Capture video and audio streams of the active Google Meet tab. |
| `offscreen` | Host `MediaRecorder` in a background sandbox to persist recording when the popup is closed. |
| `storage` | Save lightweight session flags (`activeMeetingId`, recording status). |
| `activeTab` | Detect Google Meet URL and tab context. |
| `downloads` | Trigger native client-side file downloads for exported files. |

### Strict Content Security Policy (CSP)

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'none';"
}
```
`connect-src 'none'` guarantees at the browser engine level that no outbound network requests (HTTP, WebSocket, WebRTC peer connections) can be made by extension pages.

---

## 🗺️ Roadmap (Post-MVP)

- [ ] **V2**: Local full-text search across historical offline transcripts & multi-language categorization.
- [ ] **V3**: In-browser client-side WebAssembly / WebGPU AI summarization (Transformers.js / WebLLM) with 0 cloud dependencies.
- [ ] **V4**: Optional self-hosted WebDAV / local folder syncing.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
