# Engineering Rules & Guidelines (`rules.md`)

This document establishes the mandatory engineering standards, architectural constraints, and implementation rules for the **Google Meet Recorder & Local Transcript** Chrome Extension. All code contributions must strictly adhere to these rules.

---

## 1. Architecture Rules

- **R-ARCH-01: Manifest V3 Compliance**: The extension must be built exclusively for Chrome Manifest V3. No legacy Manifest V2 APIs or background page patterns are permitted.
- **R-ARCH-02: Separation of Concerns**:
  - **Popup**: Strictly UI presentation, user interactions, local state observation, and triggering export actions. The popup must NOT execute long-running background tasks.
  - **Service Worker**: Acts as the central event broker, lifecycle manager, tab listener, and coordinator between the popup, content script, and offscreen document.
  - **Offscreen Document**: Dedicated sandboxed DOM environment exclusively for media stream ingestion, `AudioContext` routing, `MediaRecorder` execution, and streaming binary chunks to IndexedDB.
  - **Content Script**: Strictly responsible for Google Meet tab environment detection, observing live closed caption DOM mutations, and forwarding sanitized caption events.
- **R-ARCH-03: Asynchronous Message Passing**: All inter-component communication (Popup ↔ Service Worker ↔ Offscreen ↔ Content Script) must use strongly-typed, discriminated union message schemas via `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`.
- **R-ARCH-04: Storage Hierarchy**:
  - `IndexedDB` (`meet_recorder_db`): Exclusively used for binary recording chunks, transcript history records, and comprehensive meeting metadata.
  - `chrome.storage.local`: Exclusively used for lightweight runtime state flags (e.g., `activeMeetingId`, `recordingState`, user preferences).
  - Never store binary blobs or large transcript arrays in `chrome.storage.local` or `chrome.storage.sync`.

---

## 2. React & TypeScript Rules

- **R-REACT-01: Strict TypeScript**: `strict: true` must be enabled in `tsconfig.json`. No `any` types without explicit, justified comments. All props, state objects, hooks, and message handlers must have formal TypeScript interfaces or type aliases.
- **R-REACT-02: Functional Components Only**: Use React functional components with standard React Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`). Class components are prohibited.
- **R-REACT-03: Zero Business Logic in UI**: UI components must receive data and callbacks via custom hooks or props. Complex state transformations, IndexedDB queries, and message dispatching must reside in dedicated service/utility modules.
- **R-REACT-04: Component Modularity**: Keep components focused and concise (<150 lines per component where possible). Extract reusable UI elements (e.g., Badges, Buttons, Modal Dialogs, Transcript Items) into atomic components.
- **R-REACT-05: Predictable State Updates**: Avoid deep prop drilling or redundant global state stores. Rely on custom React hooks that subscribe to `chrome.runtime` message broadcasts and `chrome.storage.onChanged` events.

---

## 3. Chrome Extension & Security Rules

- **R-SEC-01: Principle of Least Privilege**: Only declare strictly necessary permissions in `manifest.json`:
  - `tabCapture`: Tab stream acquisition.
  - `offscreen`: Offscreen document management.
  - `storage`: Runtime session pointers and settings.
  - `activeTab`: Target Meet tab contextual actions.
  - `downloads`: Client-side file saving.
- **R-SEC-02: Strict Content Security Policy (CSP)**:
  - `script-src 'self'`: No inline scripts, remote CDN scripts, or dynamically evaluated code.
  - `connect-src 'none'`: Absolute network isolation. Prevent any outbound HTTP/WebSocket requests.
- **R-SEC-03: Zero `eval()`**: Never use `eval()`, `new Function()`, `setTimeout(string)`, or any dynamic string code execution.
- **R-SEC-04: Sanitize External DOM Input**: Caption text extracted from the Google Meet DOM must be sanitized and treated as untrusted text strings before rendering in React or injecting into documents.

---

## 4. Recording & Media Rules

- **R-REC-01: Offscreen Execution**: The `MediaRecorder` MUST run in an offscreen document (`chrome.offscreen`). Because extension popups unmount when closed or unfocused, running a recorder in the popup will abruptly terminate recording.
- **R-REC-02: Stream Acquisition**: Use `chrome.tabCapture.getMediaStreamId({ targetTabId })` from the service worker, pass the stream ID to the offscreen document, and invoke `navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }, video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } })`.
- **R-REC-03: Audio Loopback Preservation**: Capturing a tab’s audio stream can silence speaker output. The offscreen document MUST route the audio track into an `AudioContext` and connect it to `audioContext.destination` so the user can continue hearing meeting audio uninterrupted.
- **R-REC-04: Codec & MIME Selection**: Check supported codecs at runtime using `MediaRecorder.isTypeSupported()`. Priority:
  1. `video/webm;codecs=vp9,opus`
  2. `video/webm;codecs=vp8,opus`
  3. `video/webm`
- **R-REC-05: Timeslice Chunking**: Always call `mediaRecorder.start(3000)` with a 3-second timeslice. In the `ondataavailable` callback, immediately write the incoming chunk to IndexedDB rather than accumulating blobs in browser RAM.
- **R-REC-06: Pause & Resume Synchronization**: When paused, invoke `mediaRecorder.pause()` and record pause timestamps. When resumed, invoke `mediaRecorder.resume()`. The elapsed duration counter must account for paused intervals.

---

## 5. Transcript & Caption Extraction Rules

- **R-TRANS-01: Zero External AI / STT**: Speech-to-text must NEVER invoke external AI or cloud speech APIs. All transcripts are extracted from Google Meet’s native closed captioning DOM.
- **R-TRANS-02: Isolated Selectors Module**: All Google Meet CSS class names, container selectors, and DOM navigation helpers must reside in a single dedicated configuration file (`selectors.ts`).
- **R-TRANS-03: Robust MutationObserver**: Content script must attach a `MutationObserver` to caption container parents. The observer must watch for `childList` and `characterData` mutations and debounce processing with a microtask queue.
- **R-TRANS-04: Deduplication & Text Normalization**:
  - Google Meet updates active speaker caption nodes word-by-word. The extractor must track the `lastSpeaker` and `currentTextBuffer`.
  - Incremental updates from the same speaker within a short threshold (<5 seconds) update the active entry.
  - When the speaker changes or silence elapses, commit the previous entry and begin a new `TranscriptEntry`.
- **R-TRANS-05: Graceful Caption Absence**: If closed captions are disabled in Google Meet, the extension must display a friendly notice reminding the user to turn on captions (via the `c` shortcut or Meet toolbar).

---

## 6. Storage & IndexedDB Rules

- **R-STORE-01: Dedicated Object Stores**:
  - `meetings`: Primary meeting records (`id`, `title`, `url`, `startedAt`, `endedAt`, `duration`, `status`, `recordingMimeType`). Key: `id`.
  - `transcripts`: Chronological dialogue entries (`id`, `meetingId`, `timestamp`, `speaker`, `text`). Index: `meetingId`, `timestamp`.
  - `recordingChunks`: Binary slices (`id`, `meetingId`, `chunkIndex`, `data: ArrayBuffer/Blob`, `timestamp`). Index: `meetingId`, `chunkIndex`.
  - `settings`: User preferences.
- **R-STORE-02: Transaction Safety**: Always perform atomic IndexedDB transactions with error propagation. Never leave incomplete transactions open.
- **R-STORE-03: Retention Guarantee**: Never overwrite or discard meeting records during an active recording. If a recording is interrupted, mark `status: 'interrupted'` so it can be recovered.

---

## 7. Export & Deletion Rules

- **R-EXP-01: Client-Side Generation**:
  - PDF: Generated via `jsPDF` using vector text, clean typography, headers, and footer page numbering (`Page X of Y`).
  - DOCX: Generated via `docx` utilizing formal `Document`, `Paragraph`, `TextRun`, `Table`, and heading styles.
  - TXT: Assembled as standard UTF-8 text with structured headers:
    ```text
    ==================================================
    Google Meet Transcript: [Meeting Title]
    Date: [YYYY-MM-DD HH:mm:ss]
    Duration: [HH:MM:SS]
    URL: [https://meet.google.com/xxx-xxxx-xxx]
    ==================================================

    [HH:MM:SS] Speaker Name:
    Dialogue text...
    ```
  - WebM: Assembled by concatenating stored `recordingChunks` ordered by `chunkIndex` into a unified `Blob([chunks], { type: mimeType })`.
- **R-EXP-02: Filename Sanitization**: Sanitize all illegal OS filename characters (`/ \ : * ? " < > |`) and replace spaces with underscores. Pattern: `Meet_[MeetingCode]_[YYYY-MM-DD_HHmm].[ext]`.
- **R-EXP-03: Export & Delete Atomic Verification**:
  - Step 1: Generate export artifact blob.
  - Step 2: Trigger browser download via `chrome.downloads.download` or anchor click.
  - Step 3: Verify download dispatch / complete event.
  - Step 4: ONLY after verification, delete meeting records from IndexedDB.
  - NEVER execute deletion prior to successful export dispatch.
- **R-EXP-04: Manual Delete Confirmation**: Provide an explicit modal warning before executing manual meeting deletions.

---

## 8. Error Handling & Privacy Rules

- **R-ERR-01: Graceful Failure**: If permissions are denied (e.g., tab capture rejection), display a descriptive explanation and actionable remediation steps in the UI.
- **R-ERR-02: Safe Logging**: Use a centralized `logger` utility. Never log private transcript dialogues or audio buffers to the browser console.
- **R-PRIV-01: Zero Telemetry**: Absolutely no tracking, analytics, remote error reporting, or pingback libraries.
- **R-PRIV-02: Complete Data Quarantine**: No audio, video, transcript, or metadata shall ever be transmitted over any network socket, HTTP request, or external message port.
