# UX/UI Design Specification (`design.md`)

This document defines the comprehensive user experience, design system, component hierarchy, and interface states for the **Google Meet Recorder & Local Transcript** Chrome Extension.

---

## 1. Design System

The visual design is modern, minimal, uncluttered, and professional, prioritizing privacy clarity, readability, and rapid control during meetings.

### 1.1 Dimensions
- **Popup Container**: Fixed width of `380px`, dynamic height between `480px` and `580px` with a maximum height of `600px` to fit comfortably in Chrome's extension window.
- **Scrollable Areas**: Transcript viewport constrained with smooth native scrollbars and sticky control headers.

### 1.2 Color Palette

| Token | Hex Value | Semantic Purpose |
|---|---|---|
| `--bg-base` | `#0F172A` (Slate 900) | Main application background |
| `--bg-surface` | `#1E293B` (Slate 800) | Cards, panels, container surfaces |
| `--bg-surface-elevated`| `#334155` (Slate 700) | Dropdowns, hover states, active badges |
| `--border-subtle` | `#334155` (Slate 700) | Subtle container separators |
| `--border-focus` | `#3B82F6` (Blue 500) | Accessible focus rings |
| `--text-primary` | `#F8FAFC` (Slate 50) | Main headings, dialogue body, buttons |
| `--text-secondary` | `#94A3B8` (Slate 400) | Timestamps, metadata, labels, captions |
| `--text-muted` | `#64748B` (Slate 500) | Placeholders, inactive hints |
| `--primary` | `#2563EB` (Blue 600) | Primary action buttons, active toggles |
| `--primary-hover` | `#1D4ED8` (Blue 700) | Primary button hover state |
| `--recording-red` | `#EF4444` (Red 500) | Active recording dot, stop button, danger actions |
| `--recording-pulse` | `rgba(239, 68, 68, 0.2)` | Pulsing ring during active recording |
| `--paused-amber` | `#F59E0B` (Amber 500) | Paused indicator, warning badges |
| `--success-emerald`| `#10B981` (Emerald 500)| Completed checkmarks, verified exports |

### 1.3 Typography

- **Primary Font Stack**: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- **Monospace Stack** (Timestamps & Timers): `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

| Scale | Size / Line Height | Weight | Usage |
|---|---|---|---|
| `text-xs` | 11px / 14px | 400, 500 | Timestamps, badge labels, metadata chips |
| `text-sm` | 13px / 18px | 400, 500 | Dialogue body, helper text, secondary buttons |
| `text-base` | 14px / 20px | 500, 600 | Primary buttons, speaker names, card headers |
| `text-lg` | 16px / 22px | 600 | Section titles, modal headers |
| `text-2xl` | 24px / 28px | 700 (Mono) | Live recording timer display |

### 1.4 Spacing Scale
- `2` (8px): Inner badge padding, tight icon spacing.
- `3` (12px): Standard element gaps, transcript bubble padding.
- `4` (16px): Card padding, screen margins.
- `6` (24px): Major section separators.

### 1.5 Radii & Shadows
- `radius-sm`: `4px` (Chips, mini buttons)
- `radius-md`: `8px` (Buttons, transcript items, inputs)
- `radius-lg`: `12px` (Cards, modal dialogs)
- `shadow-card`: `0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)`

---

## 2. Screen Specifications

### Screen 1: Not on Google Meet
**State**: Extension opened on a generic web page or new tab.

```text
┌──────────────────────────────────────────────┐
│  🎙️ Meet Recorder               [🛡️ Local]  │
├──────────────────────────────────────────────┤
│                                              │
│               [ 🌐 Meet Icon ]               │
│                                              │
│            Not on Google Meet                │
│   Open or join a Google Meet call to start   │
│   capturing local transcripts & recording.   │
│                                              │
│         ┌──────────────────────────┐         │
│         │   Open Google Meet  ↗    │  (Primary)
│         └──────────────────────────┘         │
│                                              │
├──────────────────────────────────────────────┤
│ 🔒 100% Local & Private • Zero Cloud Uploads │
└──────────────────────────────────────────────┘
```

---

### Screen 2: Google Meet Detected (Ready)
**State**: Active tab is on `meet.google.com/xxx-xxxx-xxx`, not yet recording.

```text
┌──────────────────────────────────────────────┐
│  🎙️ Meet Recorder               [🛡️ Local]  │
├──────────────────────────────────────────────┤
│  ✓ Google Meet Detected                      │
│  Call: meet.google.com/abc-defg-hij          │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 💡 Pro-tip: Turn on closed captions    │  │
│  │    in Google Meet (press 'c') to       │  │
│  │    capture live speaker transcripts.   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│         ┌──────────────────────────┐         │
│         │   ● Start Recording      │  (Primary, Blue/Red)
│         └──────────────────────────┘         │
│                                              │
├──────────────────────────────────────────────┤
│ 🔒 Audio, video & captions stay on device    │
└──────────────────────────────────────────────┘
```

---

### Screen 3: Recording Active
**State**: Capture stream running, live transcript accumulating.

```text
┌──────────────────────────────────────────────┐
│  🎙️ Meet Recorder          [● REC 00:14:32]  │
├──────────────────────────────────────────────┤
│  Live Transcript (14 entries)   [ Auto-scroll ☑ ] │
│ ┌──────────────────────────────────────────┐ │
│ │ [10:32:14] Rahul                         │ │
│ │ Let's review the API changes and schema. │ │
│ │                                          │ │
│ │ [10:32:28] Vaibhav                       │ │
│ │ Sure, I implemented the offscreen stream │ │
│ │ and IndexedDB timeslice chunks.          │ │
│ │                                          │ │
│ │ [10:32:45] Rahul                         │ │
│ │ Excellent! What about loopback audio?    │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────┐ ┌──────────────────┐ │
│  │   ⏸ Pause          │ │   ⏹ Stop        │ │ (Controls)
│  └────────────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────┘
```

---

### Screen 4: Recording Paused
**State**: MediaRecorder paused, timer halted.

```text
┌──────────────────────────────────────────────┐
│  🎙️ Meet Recorder        [⏸ PAUSED 00:14:32] │
├──────────────────────────────────────────────┤
│  Recording is currently paused.              │
│  Audio and caption capture are suspended.    │
│                                              │
│  ┌────────────────────┐ ┌──────────────────┐ │
│  │   ▶ Resume         │ │   ⏹ Stop        │ │
│  └────────────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────┘
```

---

### Screen 5: Meeting Completed / Review
**State**: Recording finished, data compiled in IndexedDB ready for export or deletion.

```text
┌──────────────────────────────────────────────┐
│  🎙️ Meet Recorder             [✓ Completed] │
├──────────────────────────────────────────────┤
│  Meeting Summary                             │
│  • Duration: 43m 21s                         │
│  • Transcript: 128 dialogue entries          │
│  • Recording: 342 MB (WebM)                  │
│                                              │
│  Export Transcript                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │ 📄 PDF    │  │ 📝 DOCX   │  │ 📃 TXT    │ │
│  └───────────┘  └───────────┘  └───────────┘ │
│                                              │
│  Export Media                                │
│  ┌─────────────────────────────────────────┐ │
│  │   🎥 Download WebM Recording            │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │   🚀 Export All & Delete Local Data     │ │ (Primary Action)
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │   🗑️ Delete Meeting Data                 │ │ (Ghost/Danger)
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

### Screen 6: Export Confirmation & Auto-Delete
**State**: Download triggered, verifying completion, purging IndexedDB.

```text
┌──────────────────────────────────────────────┐
│  🎙️ Meet Recorder             [✓ Downloaded]│
├──────────────────────────────────────────────┤
│                                              │
│             [ 🛡️ Green Shield ]              │
│                                              │
│         Export Complete & Data Purged        │
│   Your files were downloaded to your device. │
│   All temporary local recording data has     │
│   been permanently deleted from browser      │
│   storage.                                   │
│                                              │
│         ┌──────────────────────────┐         │
│         │       Done / Close       │         │
│         └──────────────────────────┘         │
└──────────────────────────────────────────────┘
```

---

### Screen 7: Manual Delete Confirmation Dialog
**State**: User clicked "Delete Meeting Data" on completed screen.

```text
┌──────────────────────────────────────────────┐
│  ⚠️ Delete Meeting Data?                     │
├──────────────────────────────────────────────┤
│  Are you sure you want to permanently delete │
│  this recording and transcript?              │
│                                              │
│  This action CANNOT be undone. No files have │
│  been exported yet.                          │
│                                              │
│  ┌────────────────────┐ ┌──────────────────┐ │
│  │      Cancel        │ │  🗑️ Confirm Wipe │ │ (Danger)
│  └────────────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────┘
```

---

### Screen 8: Interrupted Session Recovery
**State**: Extension opened after browser crash or unexpected tab close with orphaned recording.

```text
┌──────────────────────────────────────────────┐
│  ⚠️ Unsaved Recording Found                  │
├──────────────────────────────────────────────┤
│  A previous meeting recording was interrupted│
│  unexpectedly:                               │
│  • Date: Sep 2, 2026 13:45                   │
│  • Recovered Duration: ~18m 10s              │
│  • Captured Transcript: 54 entries           │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │   💾 Recover & Export Session           │ │ (Primary)
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │   🗑️ Discard Interrupted Data           │ │ (Secondary)
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

## 3. Interactive Components & States

### 3.1 Button Hierarchy
1. **Primary (`bg-blue-600` hover `bg-blue-700`)**: Key forward progress actions (`Start Recording`, `Export All & Delete`, `Recover`).
2. **Secondary (`bg-slate-700` hover `bg-slate-600`)**: Alternative export buttons (`PDF`, `DOCX`, `TXT`, `Download WebM`).
3. **Danger (`bg-red-600` hover `bg-red-700` or `text-red-400` border `border-red-500/30`)**: `Stop Recording`, `Confirm Delete`.
4. **Ghost / Tertiary**: `Dismiss`, `Cancel`, `Open Google Meet`.

### 3.2 Accessibility
- High contrast compliant (`4.5:1` minimum for body text, `3:1` for UI components).
- Keyboard tab indexes and ARIA roles (`role="dialog"`, `role="log"`, `aria-live="polite"` for transcript updates).
- Clear visual focus outlines (`focus-visible:ring-2 focus-visible:ring-blue-500`).
