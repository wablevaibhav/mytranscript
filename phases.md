# Project Implementation Phases (`phases.md`)

This roadmap defines the sequential, phased implementation plan for the **Google Meet Recorder & Local Transcript** Chrome Extension.

---

## Phase 0 — Documentation First (Current)
- [x] Create `prd.md` (Product Requirements Document)
- [x] Create `rules.md` (Engineering Rules & Guidelines)
- [x] Create `design.md` (UX/UI Design Specification)
- [x] Create `architecture.md` (Technical Architecture)
- [x] Create `phases.md` (Phased Roadmap)
- [x] Cross-document consistency review and alignment.

---

## Phase 1 — Project Setup & Build Infrastructure
- Initialize `package.json` with dependencies (`react`, `react-dom`, `jspdf`, `docx`, `lucide-react`, `clsx`, `tailwind-merge`).
- Setup dev dependencies (`vite`, `@vitejs/plugin-react`, `typescript`, `@types/chrome`, `@types/react`, `@types/react-dom`, `tailwindcss`, `postcss`, `autoprefixer`).
- Configure `tsconfig.json` with strict mode, DOM types, and Chrome types.
- Configure `vite.config.ts` with multi-entry build outputs for:
  1. `popup` (`index.html`)
  2. `offscreen` (`offscreen.html`)
  3. `background` (`src/background/serviceWorker.ts`)
  4. `content` (`src/content/contentScript.ts`)
- Configure `public/manifest.json` (MV3, permissions, icons, action, offscreen, CSP).
- Create SVG icon assets (16x16, 32x32, 48x48, 128x128).
- **Acceptance Criteria**: `npm install` and `npm run build` succeed and generate a clean `dist/` directory ready for Chrome.

---

## Phase 2 — Meet Detection & Tab Context
- Implement tab query utilities in `src/shared/utils/tab.ts` to inspect active tab URL.
- Implement regex matching for `https://meet.google.com/[a-z]{3}-[a-z]{4}-[a-z]{3}` and `https://meet.google.com/*`.
- Connect detection state to React popup to toggle between **Screen 1 (Not on Meet)** and **Screen 2 (Ready to Record)**.
- **Acceptance Criteria**: Extension immediately updates UI when switching between a non-Meet tab and a Google Meet tab.

---

## Phase 3 — Extension Messaging Backbone
- Implement typed message bus in `src/shared/messages.ts`.
- Implement background service worker in `src/background/serviceWorker.ts` with message router.
- Implement popup communication hooks (`useExtensionMessages`, `useMeetingState`).
- Establish two-way communication verification between popup and background.
- **Acceptance Criteria**: Popup can dispatch `GET_STATUS` and receive typed responses from the Service Worker.

---

## Phase 4 — Offscreen Tab Capture & Audio Loopback
- Create `src/offscreen/offscreen.html` and `src/offscreen/offscreen.ts`.
- Implement service worker offscreen document lifecycle manager (`ensureOffscreenDocument()`).
- Implement stream acquisition via `chrome.tabCapture.getMediaStreamId()`.
- Implement `MediaRecorder` pipeline with runtime MIME detection (`video/webm;codecs=vp9,opus` fallback to `vp8`).
- Implement Web Audio API loopback (`AudioContext` -> `audioContext.destination`) to keep meeting audio audible to the user.
- Implement pause, resume, and stop controls.
- **Acceptance Criteria**: Tab stream is captured without muting user audio; MediaRecorder emits valid chunks on timeslice intervals.

---

## Phase 5 — IndexedDB Local Storage Layer
- Implement `src/shared/db.ts` with typed stores: `meetings`, `transcripts`, `recordingChunks`.
- Implement binary chunk serialization, sequential indexing, and batch reading.
- Implement session creation, status updates, and transaction error handling.
- **Acceptance Criteria**: Chunks from MediaRecorder write into IndexedDB; closing and reopening the popup preserves all meeting state and accumulated chunks.

---

## Phase 6 — Google Meet Live Caption Observer
- Implement isolated selector configuration in `src/content/selectors.ts`.
- Implement `MutationObserver` in `src/content/captionObserver.ts` targeting Google Meet caption containers.
- Implement speaker name extraction, timestamp attachment, and incremental text debouncer.
- Implement deduplication logic to prevent repeat phrases while capturing continuous speech.
- Dispatch `CAPTION_UPDATE` messages to the service worker and IndexedDB.
- **Acceptance Criteria**: Real-time captions in a live Google Meet call are accurately parsed into discrete `TranscriptEntry` objects with correct speaker attribution.

---

## Phase 7 — Live Transcript UI & Real-Time Feedback
- Implement live transcript viewport component (`src/popup/components/TranscriptFeed.tsx`).
- Implement auto-scroll to bottom with user manual scroll override detection.
- Implement speaker color badges, relative timestamps (`00:14:32`), and empty state when captions are not yet turned on.
- Implement recording duration timer with pause awareness.
- **Acceptance Criteria**: Live transcript updates smoothly in the popup as people speak in the Meet call.

---

## Phase 8 — Multi-Format Exporters
- Implement `src/shared/export/pdf.ts` (jsPDF formatted document with title, metadata table, styled dialogue blocks, and page numbers).
- Implement `src/shared/export/docx.ts` (docx document with formal typography, heading hierarchy, metadata, and dialogue sections).
- Implement `src/shared/export/txt.ts` (Plain text exporter with UTF-8 encoding).
- Implement `src/shared/export/webm.ts` (Concatenate IndexedDB chunks into cohesive WebM Blob and trigger download).
- Implement filename sanitization: `Meet_[MeetCode]_[YYYY-MM-DD_HHmm].[ext]`.
- **Acceptance Criteria**: All 4 export formats generate clean, uncorrupted files for both short and multi-hour meetings.

---

## Phase 9 — Safe "Export & Delete" and Manual Deletion
- Implement download confirmation verification before executing database purges.
- Implement "Export & Delete" workflow in popup.
- Implement manual "Delete Meeting Data" with confirmation dialog (Screen 7).
- Implement post-deletion confirmation screen (Screen 6).
- **Acceptance Criteria**: If export fails, data is untouched in IndexedDB. If export succeeds, IndexedDB data is completely wiped.

---

## Phase 10 — Interruption Recovery & Edge Cases
- Implement startup check for unfinalized sessions (`status: 'recording'` or `status: 'interrupted'`).
- Render **Screen 8 (Interrupted Session Recovery)** allowing user to export captured portions or discard.
- Handle edge cases: Meet tab closed while recording, navigation away from call, microphone permissions, storage quota checks.
- **Acceptance Criteria**: Forcefully terminating a Meet tab preserves all recorded chunks up to that second and allows full export upon reopening extension.

---

## Phase 11 — Design Polish, Animations & Accessibility
- Implement design tokens from `design.md` using Tailwind CSS.
- Add recording pulse animation and smooth state transitions.
- Ensure WCAG AA color contrast, full keyboard navigation, ARIA live regions, and focus outlines.
- **Acceptance Criteria**: UI is pixel-perfect, responsive, and passes accessibility checks.

---

## Phase 12 — Testing & Validation
- Unit test coverage for caption deduplication, storage operations, and export assemblers.
- Manual test checklist for full end-to-end Google Meet recording workflow.
- **Acceptance Criteria**: All test suites pass.

---

## Phase 13 — Production Build & Packaging
- Run `npm run build` and resolve all TypeScript, lint, or packaging errors.
- Verify `dist/` contains valid `manifest.json`, bundled scripts, HTML entrypoints, and assets.
- Provide clear instructions for loading unpacked extension in `chrome://extensions`.
