# Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 What the Product Is
**Google Meet Recorder & Local Transcript** is a privacy-first, local-first Google Chrome Extension (Manifest V3) designed to record video and audio from Google Meet sessions, capture live closed captions as real-time structured transcripts, display live transcripts to the user during the meeting, and export transcripts (PDF, DOCX, TXT) and recording media (WebM) entirely on the client side.

### 1.2 Who It Is For
This product is built for professionals, students, researchers, developers, interviewers, legal/compliance personnel, and privacy-conscious individuals who regularly use Google Meet and need accurate records of their calls without compromising organizational or personal confidentiality by streaming audio/video or meeting transcripts to third-party servers.

### 1.3 The Core Problem
Most existing meeting recording and transcription extensions operate as "bots" or cloud services that ingest raw audio/video streams, send them to remote cloud providers for speech-to-text processing, and store meeting logs on third-party servers. This architecture poses severe risks:
- **Data Privacy & Compliance Violations**: Violates GDPR, HIPAA, SOC-2, and internal enterprise non-disclosure policies.
- **Latency & Reliability Issues**: Requires stable high-bandwidth uplinks for audio streaming to external transcription services.
- **Cost & Lock-in**: Imposes subscription fees, account creations, and cloud storage quotas.
- **Intrusiveness**: Meeting bots join calls as virtual participants, distracting attendees and often requiring meeting host approval.

### 1.4 The Proposed Solution
The proposed solution utilizes Google Meet’s built-in live captioning engine and Chrome's native `chrome.tabCapture` / `MediaRecorder` APIs inside a sandbox/offscreen environment. Meeting audio and video are captured locally in memory chunks and indexed into the browser's IndexedDB. Captions are parsed directly from the client DOM using a high-performance `MutationObserver` and structured into timestamped speaker dialogues. Files can be exported instantly to PDF, DOCX, TXT, or WebM, after which all locally cached temporary data can be securely purged.

### 1.5 Why Local-First Matters
- **Zero Data Leakage**: Meeting recordings, speech, and metadata never cross the local network boundary.
- **Zero External Dependencies**: Operates offline/locally without requiring third-party API keys, logins, or cloud infrastructure.
- **Instant Processing**: Document export and WebM generation occur instantly via client-side JavaScript libraries (`jsPDF`, `docx`).
- **Immediate Data Sovereignty**: Users retain 100% control over retention, storage, and deletion of their records.

---

## 2. Product Vision
**Vision Statement**: *A seamless, unobtrusive, privacy-first meeting recorder and transcript companion that empowers users to capture, review, and export their Google Meet sessions without ever sending a single byte of meeting data to the cloud.*

### Roadmap Boundaries
- **Current MVP Scope**: 100% client-side recording, DOM caption extraction, live UI preview, local storage, multi-format export, download-and-delete, and interrupted recording recovery.
- **Future Roadmap (Post-MVP)**:
  - V2: Multi-language transcript categorization, local full-text search, persistent offline archive manager.
  - V3: Client-side local WebAssembly/WebGPU LLM summarization (e.g., Transformers.js / WebLLM running locally in the browser with 0 cloud calls), local action-item extraction.
  - V4: Optional self-hosted WebDAV / local folder file syncing.

---

## 3. MVP Goals
The Minimum Viable Product (MVP) must fulfill the following operational goals:
1. **Google Meet Detection**: Automatically identify active Google Meet tabs (`https://meet.google.com/[a-z]{3}-[a-z]{4}-[a-z]{3}` or `https://meet.google.com/*`) and dynamically transition UI states between *Not on Meet*, *Ready to Record*, *Recording*, *Paused*, and *Completed*.
2. **Local Video/Audio Recording**: Utilize `chrome.tabCapture` and `chrome.offscreen` to capture meeting video and audio into a standard WebM container.
3. **Loopback Audio Preservation**: Ensure tab capture does not mute the meeting audio for the user.
4. **Live Transcript Capture**: Observe Google Meet's DOM live captions in real time, extract speaker identities and timestamps, deduplicate incremental updates, and construct structured transcript entries.
5. **Real-time Live Transcript Viewer**: Display updating transcript entries in the extension popup with speaker attribution, timestamps, and auto-scroll controls.
6. **Local Temporary Storage**: Persist recording chunks and transcript entries inside IndexedDB to survive popup closures or accidental tab reloads.
7. **Multi-Format Export**:
   - **PDF**: Formatted document with title, meeting metadata, speaker badges, timestamps, and proper page breaks.
   - **DOCX**: Formatted Microsoft Word document with headers, metadata tables, and dialogue paragraphs.
   - **TXT**: Plain-text transcript with clean chronological timestamps and speaker labels.
   - **WebM**: Downloadable full-fidelity recording file.
8. **Export & Delete Workflow**: Automatically purge all temporary IndexedDB records for a meeting immediately after successful export download confirmation.
9. **Manual Delete Option**: Allow users to explicitly purge meeting data at any stage.
10. **Crash & Interruption Recovery**: Detect unfinished or interrupted recordings upon popup reopening and allow users to recover or export captured data.
11. **Privacy Transparency**: Provide explicit inline indicators confirming that zero external requests or telemetry are active.

---

## 4. Non-Goals (Explicit Exclusions)
To maintain strict architectural purity and security, the MVP explicitly excludes:
- **No AI Transcription**: No Whisper API, Google Speech-to-Text API, AWS Transcribe, or Deepgram.
- **No AI Summarization**: No OpenAI, Anthropic, Gemini, or remote LLM API calls.
- **No Cloud Recording or Storage**: No AWS S3, Google Cloud Storage, Dropbox, or Firebase.
- **No Backends / Databases**: No Node.js backend, Supabase, Firebase Firestore, PostgreSQL, or REST endpoints.
- **No User Accounts / Authentication**: No Sign-in with Google, OAuth, email/password login, or user profiles.
- **No Telemetry / Analytics SDKs**: No Google Analytics, Mixpanel, Sentry, PostHog, or Segment.
- **No Collaboration Features**: No multi-user shared workspace, real-time cloud sync, or link sharing.
- **No Meeting Bots**: No automated bots joining the Google Meet call as a guest participant.
- **No Payments or Subscriptions**: No Stripe, billing tiers, or paywalls.

---

## 5. User Personas

### Persona 1: The Remote Software Engineer (Alex)
- **Role**: Senior Frontend Engineer in a distributed team.
- **Needs**: Captures technical architecture reviews and sprint planning decisions on Google Meet.
- **Pain Point**: Company NDA strictly forbids third-party bot recorders and cloud transcription services. Needs a reliable local transcript to review technical action items.

### Persona 2: The Independent Consultant / Researcher (Dr. Elena)
- **Role**: Qualitative user researcher conducting participant interviews.
- **Needs**: Needs verbatim transcripts and audio recordings for qualitative coding.
- **Pain Point**: Institutional Review Board (IRB) and GDPR compliance require participant speech data to remain exclusively on local encrypted workstations.

### Persona 3: The University Student (Liam)
- **Role**: Undergraduate attending online lectures and group study sessions.
- **Needs**: Exports lecture notes in DOCX/PDF to study offline and search through key explanations.
- **Pain Point**: Paid cloud transcription tools are prohibitively expensive and limited by monthly minute quotas.

### Persona 4: The HR Interviewer / Recruiter (Maya)
- **Role**: Talent acquisition specialist conducting candidate screening calls.
- **Needs**: Quick transcript export to attach candidate notes into local applicant tracking files.
- **Pain Point**: Candidate privacy regulations prevent uploading candidate audio/video to external transcription servers.

---

## 6. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-1 | Privacy-conscious user | Record my Google Meet session locally | I can review discussions without exposing confidential data to cloud servers. |
| US-2 | Meeting participant | View live transcript text inside the extension | I can verify that closed captions are being accurately captured in real time. |
| US-3 | Meeting attendee | See speaker names and timestamps alongside dialogue | I know exactly who said what and when during the meeting. |
| US-4 | Student / Researcher | Export the meeting transcript as PDF or DOCX | I can format, annotate, and share notes with my team offline. |
| US-5 | Developer / Analyst | Export the meeting transcript as TXT | I can paste plain text into my personal notes or local text editor. |
| US-6 | User | Download the full meeting recording as a WebM video | I have an archive of the screen share and audio for future reference. |
| US-7 | Security-conscious user | Have all local meeting data deleted automatically after successful export | No sensitive recordings or transcripts linger in browser storage. |
| US-8 | User | Manually discard or delete a recorded session at any time | I can easily discard test recordings or unwanted files. |
| US-9 | User who experienced a browser crash | Recover an interrupted recording session upon reopening the extension | I don't lose vital meeting content if a tab or window closes unexpectedly. |
| US-10 | User | Close the extension popup while recording continues uninterrupted | I can focus on my meeting without keeping the extension popup open. |

---

## 7. Functional Requirements

### 7.1 Meet Detection & Session Management
- **FR-001**: The extension shall detect whether the current active Chrome tab is a valid Google Meet call (`https://meet.google.com/[a-z]{3}-[a-z]{4}-[a-z]{3}` or `https://meet.google.com/*`).
- **FR-002**: If the active tab is not Google Meet, the popup UI shall display an informational state with an action button to navigate to Google Meet.
- **FR-003**: When a valid Google Meet tab is detected, the extension shall query the background service worker to check for an active recording session or initialize readiness state.
- **FR-004**: The extension shall detect when a Google Meet call ends or navigates away, transitioning the recording session to a completed state gracefully.

### 7.2 Media & Audio Recording
- **FR-005**: The extension shall initiate tab stream capture using `chrome.tabCapture.getMediaStreamId()` targeting the active Google Meet tab.
- **FR-006**: Tab capture stream processing and `MediaRecorder` execution shall reside in a dedicated Manifest V3 Offscreen Document (`chrome.offscreen`) to ensure recording persists when the popup is closed.
- **FR-007**: The offscreen recording pipeline shall split the captured stream into an `AudioContext` loopback destination to maintain audible output through the user’s speakers/headphones.
- **FR-008**: The `MediaRecorder` shall dynamically detect and select the best supported container and codec (e.g., `video/webm;codecs=vp9,opus`, falling back to `video/webm;codecs=vp8,opus` or `video/webm`).
- **FR-009**: The `MediaRecorder` shall emit chunks at a configured timeslice (e.g., every 3000ms) to stream binary data directly to IndexedDB, avoiding memory exhaustion during long meetings.
- **FR-010**: The user shall be able to Pause, Resume, and Stop the active recording at any time via the popup UI.

### 7.3 Transcript & Caption Extraction
- **FR-011**: The Content Script injected into the Google Meet tab shall observe the DOM for live caption containers using a configured `MutationObserver`.
- **FR-012**: Caption DOM selectors shall be isolated in a dedicated configuration module to facilitate seamless updates when Google Meet modifies class names or DOM structures.
- **FR-013**: The Content Script shall extract the speaker name, raw text content, and local timestamp for each caption node.
- **FR-014**: The caption processor shall deduplicate incremental real-time speech updates, merging continuous speech chunks from the same speaker while creating new entries upon speaker change or natural pauses (>5s).
- **FR-015**: Caption extraction shall operate with 0 network calls and 0 third-party speech recognition APIs, relying exclusively on Google Meet's native caption display.
- **FR-016**: If closed captions are turned off in Google Meet, the popup UI shall display a clear hint prompting the user to enable captions (`Turn on captions` / `c` key).

### 7.4 Local Storage & Persistence
- **FR-017**: All meeting metadata, transcript entries, and binary recording chunks shall be stored in client-side IndexedDB (`meet_recorder_db`).
- **FR-018**: Lightweight operational state (e.g., active meeting ID, recording state) shall be tracked in `chrome.storage.local` and memory.
- **FR-019**: Binary recording chunks shall be stored sequentially indexed by `chunkIndex` and `meetingId` to allow reliable concatenation upon export.
- **FR-020**: No meeting data, transcript text, or binary audio/video shall ever be saved into `chrome.storage.sync` or transmitted externally.

### 7.5 Export & Deletion
- **FR-021**: The extension shall export transcripts to PDF using client-side `jsPDF`, formatted with document title, meeting URL, duration, date/time, speaker badges, and timestamps.
- **FR-022**: The extension shall export transcripts to DOCX using client-side `docx`, containing formal typography, metadata tables, and dialogue sections.
- **FR-023**: The extension shall export transcripts to plain UTF-8 TXT files with clear timestamp headers.
- **FR-024**: The extension shall assemble stored recording chunks into a cohesive `Blob` and trigger a native WebM file download.
- **FR-025**: Filenames for all exports shall be sanitized and follow the structured pattern: `Meet_[MeetingTitle/Code]_[YYYY-MM-DD_HHmm].[ext]`.
- **FR-026**: The extension shall provide an **Export & Delete** action that triggers the selected export file download and, upon successful download dispatch/confirmation, purges all associated records from IndexedDB.
- **FR-027**: The extension shall provide a **Delete Meeting** action with a confirmation dialog to permanently wipe stored meeting data without exporting.
- **FR-028**: Under no circumstances shall data be deleted if an export generation fails.

### 7.6 Crash & Interruption Recovery
- **FR-029**: If an active recording was abruptly halted due to browser crash, tab closure, or system shutdown, the extension shall identify orphaned/unfinalized sessions upon launch.
- **FR-030**: The user shall be presented with a recovery banner allowing them to review captured transcripts, download the partial WebM recording, or clear the stale session.

---

## 8. Non-Functional Requirements

### 8.1 Privacy & Security (NFR-001 - NFR-005)
- **Zero-Exfiltration**: Content Security Policy (CSP) and manifest permissions shall strictly restrict network connections (`connect-src 'none'`).
- **No Remote Code**: No `eval()`, `new Function()`, or remotely hosted scripts (`script-src 'self'`).
- **Minimal Manifest Permissions**: Only request necessary permissions: `tabCapture`, `offscreen`, `storage`, `activeTab`, `downloads`.
- **Local Isolation**: Each meeting's data is isolated in IndexedDB and wiped upon user command.

### 8.2 Performance & Resource Management (NFR-006 - NFR-010)
- **Memory Efficiency**: Offscreen recorder flushes binary chunks every 3 seconds to IndexedDB, maintaining steady RAM usage (<50MB) even on 2+ hour recordings.
- **CPU & Render Footprint**: DOM MutationObserver debounces updates with requestAnimationFrame/microtasks to ensure zero frame drops in Google Meet video rendering.
- **Popup Load Time**: React popup initialization shall render within 100ms.

### 8.3 Reliability & Fault Tolerance (NFR-011 - NFR-014)
- **Offscreen Lifecycle**: Service worker monitors offscreen document health and recreates it if unexpectedly terminated.
- **IndexedDB Transactions**: Atomic read/write transactions prevent partial writes or corrupted binary blobs.
- **Graceful Degradation**: If Google Meet DOM caption classes shift, the observer falls back to generic aria/role-based caption selectors.

### 8.4 Usability & Accessibility (NFR-015 - NFR-018)
- **Keyboard Navigable**: All interactive buttons, modals, and export triggers are focusable with visible focus rings and WCAG 2.1 AA contrast compliance.
- **Screen Reader Support**: Standard ARIA landmarks, status announcements for recording state transitions, and accessible dialogs.

---

## 9. Privacy Requirements Matrix

| Vector | Requirement | Enforcement Mechanism |
|---|---|---|
| Audio / Video Stream | Must never leave the device | Processed strictly inside Offscreen Document MediaRecorder -> IndexedDB. |
| Closed Captions | Must never be sent to external STT | Captured exclusively via Content Script DOM inspection of native Meet captions. |
| User Analytics | Zero telemetry / tracking | No analytics SDKs bundled; no pingbacks or beacons in codebase. |
| Data Retention | Zero persistent cloud footprint | Client-side IndexedDB only; auto-deleted upon "Export & Delete" or manual wipe. |
| Network CSP | No external network communication | Strict `default-src 'self'` in Manifest V3 CSP. |

---

## 10. Acceptance Criteria

| Criteria ID | Category | Acceptance Condition |
|---|---|---|
| **AC-001** | Detection | When opened on non-Meet page, displays "Not on Google Meet" with launch button. When opened on `meet.google.com/xxx-xxxx-xxx`, displays "Google Meet detected" and "Start Recording". |
| **AC-002** | Audio/Video Capture | Starting recording captures both tab video and tab audio into WebM format while user can still hear live call audio clearly. |
| **AC-003** | Popup Lifecycle | Closing and reopening the popup during an active recording does NOT stop or interrupt the recording session; timer and live transcript synchronize instantly upon reopen. |
| **AC-004** | Live Transcript | With Meet captions enabled, spoken dialogue appears in popup live transcript within 500ms of appearance in Meet DOM, attributing correct speaker name and timestamp. |
| **AC-005** | Pause & Resume | Pausing halts chunk accumulation and freezes timer; resuming continues recording and appends new chunks seamlessly. |
| **AC-006** | PDF Export | Exporting to PDF generates a valid, beautifully formatted `.pdf` with title, metadata, speaker entries, and correct page numbers. |
| **AC-007** | DOCX Export | Exporting to DOCX generates a valid `.docx` opening cleanly in Microsoft Word / Google Docs with metadata table and formatted dialogue paragraphs. |
| **AC-008** | TXT Export | Exporting to TXT produces clean UTF-8 text with timestamped speaker logs. |
| **AC-009** | WebM Download | Clicking "Download Recording" yields a playable WebM file containing synchronized audio and video. |
| **AC-010** | Export & Delete | Clicking "Export & Delete" downloads selected files and confirms complete deletion of all records for that meeting from IndexedDB. |
| **AC-011** | Interruption Recovery | Simulating abrupt tab closure preserves all chunks and transcript entries recorded up to that second, offering full export upon extension launch. |
| **AC-012** | Privacy Guarantee | Zero outbound network requests occur during any phase of recording, transcription, storage, or export. |
