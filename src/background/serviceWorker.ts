/**
 * Background Service Worker (Manifest V3)
 * Central orchestrator managing Offscreen Documents, Tab Capture Streams,
 * Message Routing, Auto-Recording, and 6-Hour Lifecycles.
 */

import { Meeting } from '../shared/types';
import { ExtensionMessage, MessageResponse } from '../shared/messages';
import {
  saveMeeting,
  updateMeeting,
  getMeeting,
  getActiveOrInterruptedMeeting,
  saveTranscriptEntry,
  deleteMeetingData,
  cleanupExpiredMeetings,
} from '../shared/db';
import { logger } from '../shared/utils/logger';

let activeMeeting: Meeting | null = null;
let lastTimerCheck = Date.now();
let durationInterval: number | null = null;
let isStartingRecording = false;

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Initialize on service worker startup
async function initServiceWorker() {
  logger.info('Service Worker initialized.');

  // Set up 1-minute heartbeat alarm for 6-hour long recordings & retention maintenance
  try {
    chrome.alarms.create('meet_recorder_heartbeat', { periodInMinutes: 1 });
  } catch (err) {
    logger.debug('Alarms setup notice:', err);
  }

  // Check for any unfinalized meetings in storage or DB
  try {
    const existing = await getActiveOrInterruptedMeeting();
    if (existing) {
      if (existing.status === 'recording' || existing.status === 'paused') {
        // If service worker restarted during an active recording, mark as interrupted for recovery
        existing.status = 'interrupted';
        await updateMeeting(existing.id, { status: 'interrupted' });
        activeMeeting = existing;
        logger.warn(`Recovered unfinalized meeting ${existing.id} marked as interrupted.`);
      } else if (existing.status === 'completed') {
        const age = Date.now() - (existing.endedAt || existing.startedAt);
        if (age < SIX_HOURS_MS) {
          activeMeeting = existing;
        }
      }
    }

    // Clean up any historical sessions older than 6 hours
    await cleanupExpiredMeetings(SIX_HOURS_MS);
  } catch (err) {
    logger.error('Error during startup DB check:', err);
  }
}

initServiceWorker();

// Alarm listener for service worker keep-alive and maintenance
chrome.alarms?.onAlarm?.addListener(async (alarm) => {
  if (alarm.name === 'meet_recorder_heartbeat') {
    if (activeMeeting && activeMeeting.status === 'recording') {
      const now = Date.now();
      const deltaSec = (now - lastTimerCheck) / 1000;
      lastTimerCheck = now;
      activeMeeting.duration += deltaSec;

      await updateMeeting(activeMeeting.id, { duration: activeMeeting.duration });
      await chrome.storage.local.set({ activeMeetingDuration: activeMeeting.duration });
    }

    // Run 6-hour retention cleanup
    await cleanupExpiredMeetings(SIX_HOURS_MS);
  }
});

// ---------------------------------------------------------------------------
// Offscreen Document Manager
// ---------------------------------------------------------------------------

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = 'offscreen.html';

  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Recording Google Meet tab audio and video streams locally without cloud upload',
    });
    logger.info('Offscreen document created successfully.');
  } catch (err) {
    logger.error('Failed to create offscreen document:', err);
    throw err;
  }
}

async function closeOffscreenDocument(): Promise<void> {
  try {
    if (chrome.offscreen && chrome.offscreen.closeDocument) {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) {
        await chrome.offscreen.closeDocument();
        logger.info('Offscreen document closed.');
      }
    }
  } catch (err) {
    logger.warn('Error closing offscreen document:', err);
  }
}

// ---------------------------------------------------------------------------
// Stream Acquisition with Collision Protection
// ---------------------------------------------------------------------------

async function acquireTabStreamId(tabId: number): Promise<string> {
  const getStreamPromise = () =>
    new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
        if (chrome.runtime.lastError || !id) {
          reject(new Error(chrome.runtime.lastError?.message || 'Could not obtain tab stream ID.'));
        } else {
          resolve(id);
        }
      });
    });

  try {
    return await getStreamPromise();
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes('Cannot capture a tab with an active stream')) {
      logger.warn('Active stream collision detected. Resetting offscreen document and retrying...');
      await closeOffscreenDocument();
      await new Promise((r) => setTimeout(r, 400));
      return await getStreamPromise();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Timer Management
// ---------------------------------------------------------------------------

function startDurationTracking() {
  if (durationInterval !== null) {
    clearInterval(durationInterval);
  }
  lastTimerCheck = Date.now();

  durationInterval = setInterval(async () => {
    if (activeMeeting && activeMeeting.status === 'recording') {
      const now = Date.now();
      const deltaSec = (now - lastTimerCheck) / 1000;
      lastTimerCheck = now;

      activeMeeting.duration += deltaSec;
      await updateMeeting(activeMeeting.id, { duration: activeMeeting.duration });
      await chrome.storage.local.set({ activeMeetingDuration: activeMeeting.duration });
    } else {
      lastTimerCheck = Date.now();
    }
  }, 1000) as unknown as number;
}

function stopDurationTracking() {
  if (durationInterval !== null) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Recording Operations
// ---------------------------------------------------------------------------

async function startRecordingSession(
  tabId: number,
  meetCode: string,
  url: string
): Promise<MessageResponse<Meeting>> {
  // Prevent duplicate concurrent start calls
  if (isStartingRecording) {
    if (activeMeeting) return { success: true, data: activeMeeting };
  }

  // If already recording for this meeting / tab, do not re-capture
  if (activeMeeting && activeMeeting.status === 'recording') {
    if (activeMeeting.meetCode === meetCode || activeMeeting.tabId === tabId) {
      logger.info('Meeting is already actively recording:', meetCode);
      return { success: true, data: activeMeeting };
    }
    // Finalize previous session if new one starts
    await stopRecordingSession();
  }

  isStartingRecording = true;

  try {
    const meetingId = `meet-${meetCode}-${Date.now()}`;
    const newMeeting: Meeting = {
      id: meetingId,
      meetCode,
      title: `Google Meet (${meetCode})`,
      url,
      tabId,
      startedAt: Date.now(),
      duration: 0,
      status: 'starting',
    };

    activeMeeting = newMeeting;
    await saveMeeting(newMeeting);
    await chrome.storage.local.set({ activeMeetingId: meetingId, recordingStatus: 'starting' });

    // 1. Acquire Stream ID with fallback handling
    let streamId: string | null = null;
    try {
      streamId = await acquireTabStreamId(tabId);
    } catch (streamErr) {
      logger.warn('Tab media stream capture failed (proceeding in transcript-only mode):', streamErr);
    }

    // 2. Start Offscreen Audio/Video Capture if stream was acquired
    if (streamId) {
      await ensureOffscreenDocument();
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_START_CAPTURE',
        payload: {
          streamId,
          meetingId,
          timesliceMs: 3000,
        },
      });
    }

    // 3. Mark session active
    activeMeeting.status = 'recording';
    await updateMeeting(meetingId, { status: 'recording' });
    await chrome.storage.local.set({ recordingStatus: 'recording' });
    startDurationTracking();

    // 4. Notify Meet content script to begin live caption parsing
    try {
      chrome.tabs.sendMessage(tabId, {
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: activeMeeting, status: 'recording' },
      });
    } catch (e) {
      logger.debug('Tab message send notice:', e);
    }

    // 5. Broadcast state to popup
    broadcastMessage({
      type: 'RECORDING_STATE_CHANGED',
      payload: { meeting: activeMeeting, status: 'recording' },
    });

    isStartingRecording = false;
    return { success: true, data: activeMeeting };
  } catch (err) {
    isStartingRecording = false;
    logger.error('startRecordingSession failed:', err);
    if (activeMeeting) {
      activeMeeting.status = 'error';
      activeMeeting.errorMessage = String(err);
      await updateMeeting(activeMeeting.id, { status: 'error', errorMessage: String(err) });
    }
    await closeOffscreenDocument();
    return { success: false, error: String(err) };
  }
}

async function stopRecordingSession(meetingId?: string): Promise<MessageResponse<Meeting>> {
  if (!activeMeeting) {
    const existing = await getActiveOrInterruptedMeeting();
    if (!existing) {
      return { success: false, error: 'No active recording to stop.' };
    }
    activeMeeting = existing;
  }

  const targetId = meetingId || activeMeeting.id;
  stopDurationTracking();

  // Signal offscreen document to finalize chunks and stop
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_STOP_CAPTURE',
    payload: { meetingId: targetId },
  });

  activeMeeting.status = 'completed';
  activeMeeting.endedAt = Date.now();
  await updateMeeting(targetId, {
    status: 'completed',
    endedAt: activeMeeting.endedAt,
    duration: activeMeeting.duration,
  });

  await chrome.storage.local.set({ recordingStatus: 'completed' });

  // Notify content script
  if (activeMeeting.tabId) {
    chrome.tabs
      .sendMessage(activeMeeting.tabId, {
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: activeMeeting, status: 'completed' },
      })
      .catch(() => {});
  }

  broadcastMessage({
    type: 'RECORDING_STATE_CHANGED',
    payload: { meeting: activeMeeting, status: 'completed' },
  });

  await closeOffscreenDocument();
  return { success: true, data: activeMeeting };
}

// ---------------------------------------------------------------------------
// Message Router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleRuntimeMessage(message, sender)
    .then((res) => sendResponse(res))
    .catch((err) => {
      logger.error('Error handling runtime message:', err);
      sendResponse({ success: false, error: String(err) });
    });

  return true; // Asynchronous response channel
});

async function handleRuntimeMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'GET_STATUS': {
      if (!activeMeeting) {
        const found = await getActiveOrInterruptedMeeting();
        if (found) {
          activeMeeting = found;
        }
      }

      return {
        success: true,
        data: {
          meeting: activeMeeting,
          status: activeMeeting ? activeMeeting.status : 'idle',
        },
      };
    }

    case 'START_RECORDING': {
      const { tabId, meetCode, url } = message.payload;
      return await startRecordingSession(tabId, meetCode, url);
    }

    case 'AUTO_START_RECORDING': {
      const { meetCode, url } = message.payload;
      const tabId = message.payload.tabId || sender.tab?.id;
      if (!tabId) {
        return { success: false, error: 'Cannot auto-start: tab ID missing.' };
      }
      return await startRecordingSession(tabId, meetCode, url);
    }

    case 'STOP_RECORDING': {
      const meetingId = message.payload?.meetingId;
      return await stopRecordingSession(meetingId);
    }

    case 'PAUSE_RECORDING': {
      if (!activeMeeting || activeMeeting.status !== 'recording') {
        return { success: false, error: 'No active recording to pause.' };
      }

      activeMeeting.status = 'paused';
      await updateMeeting(activeMeeting.id, { status: 'paused' });
      await chrome.storage.local.set({ recordingStatus: 'paused' });

      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_PAUSE_CAPTURE',
        payload: { meetingId: activeMeeting.id },
      });

      if (activeMeeting.tabId) {
        chrome.tabs
          .sendMessage(activeMeeting.tabId, {
            type: 'RECORDING_STATE_CHANGED',
            payload: { meeting: activeMeeting, status: 'paused' },
          })
          .catch(() => {});
      }

      broadcastMessage({
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: activeMeeting, status: 'paused' },
      });

      return { success: true, data: activeMeeting };
    }

    case 'RESUME_RECORDING': {
      if (!activeMeeting || activeMeeting.status !== 'paused') {
        return { success: false, error: 'No paused recording to resume.' };
      }

      activeMeeting.status = 'recording';
      lastTimerCheck = Date.now();
      await updateMeeting(activeMeeting.id, { status: 'recording' });
      await chrome.storage.local.set({ recordingStatus: 'recording' });

      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_RESUME_CAPTURE',
        payload: { meetingId: activeMeeting.id },
      });

      if (activeMeeting.tabId) {
        chrome.tabs
          .sendMessage(activeMeeting.tabId, {
            type: 'RECORDING_STATE_CHANGED',
            payload: { meeting: activeMeeting, status: 'recording' },
          })
          .catch(() => {});
      }

      broadcastMessage({
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: activeMeeting, status: 'recording' },
      });

      return { success: true, data: activeMeeting };
    }

    case 'DELETE_MEETING': {
      const { meetingId } = message.payload;
      await deleteMeetingData(meetingId);

      if (activeMeeting && activeMeeting.id === meetingId) {
        activeMeeting = null;
        await chrome.storage.local.remove(['activeMeetingId', 'recordingStatus', 'activeMeetingDuration']);
      }

      stopDurationTracking();
      await closeOffscreenDocument();

      broadcastMessage({
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: { id: meetingId, status: 'idle' } as Meeting, status: 'idle' },
      });

      return { success: true };
    }

    case 'RECOVER_MEETING': {
      const { meetingId } = message.payload;
      const meeting = await getMeeting(meetingId);
      if (meeting) {
        meeting.status = 'completed';
        await updateMeeting(meetingId, { status: 'completed' });
        activeMeeting = meeting;
        return { success: true, data: meeting };
      }
      return { success: false, error: 'Meeting not found for recovery.' };
    }

    case 'CAPTION_UPDATE': {
      const { meetingId, entry } = message.payload;
      await saveTranscriptEntry(entry);

      broadcastMessage({
        type: 'CAPTION_UPDATE',
        payload: { meetingId, entry },
      });

      return { success: true };
    }

    case 'OFFSCREEN_RECORDING_STARTED': {
      const { meetingId, mimeType } = message.payload;
      if (activeMeeting && activeMeeting.id === meetingId) {
        activeMeeting.recordingMimeType = mimeType;
        await updateMeeting(meetingId, { recordingMimeType: mimeType });
      }
      return { success: true };
    }

    case 'OFFSCREEN_RECORDING_STOPPED': {
      const { meetingId, totalBytes } = message.payload;
      if (activeMeeting && activeMeeting.id === meetingId) {
        activeMeeting.recordingSize = totalBytes;
        await updateMeeting(meetingId, { recordingSize: totalBytes });
      }
      return { success: true };
    }

    case 'OFFSCREEN_RECORDING_ERROR': {
      const { meetingId, error } = message.payload;
      logger.error('Offscreen recording error received:', error);
      if (activeMeeting && activeMeeting.id === meetingId) {
        activeMeeting.status = 'error';
        activeMeeting.errorMessage = error;
        await updateMeeting(meetingId, { status: 'error', errorMessage: error });
      }
      broadcastMessage({
        type: 'RECORDING_ERROR',
        payload: { meetingId, error },
      });
      return { success: true };
    }

    case 'MEET_PAGE_DETECTED': {
      // If we are not recording and Meet is detected, auto-start if tab is available
      if ((!activeMeeting || activeMeeting.status === 'idle') && sender.tab?.id) {
        return await startRecordingSession(sender.tab.id, message.payload.meetCode, message.payload.url);
      }
      return { success: true };
    }

    case 'MEET_CALL_ENDED':
    case 'MEET_PAGE_LEFT': {
      if (activeMeeting && (activeMeeting.status === 'recording' || activeMeeting.status === 'paused')) {
        if (!sender.tab || sender.tab.id === activeMeeting.tabId) {
          logger.info('Google Meet call ended or page left. Automatically finalizing recording session.');
          return await stopRecordingSession();
        }
      }
      return { success: true };
    }

    default:
      return { success: false, error: 'Unhandled message type' };
  }
}

function broadcastMessage(message: ExtensionMessage) {
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup may be closed, which is normal
    });
  } catch {
    // Suppress unhandled broadcast errors
  }
}

// ---------------------------------------------------------------------------
// Tab Listeners (Detect closed tabs & navigation)
// ---------------------------------------------------------------------------

chrome.tabs?.onRemoved?.addListener(async (tabId) => {
  if (activeMeeting && activeMeeting.tabId === tabId && activeMeeting.status === 'recording') {
    logger.info(`Recorded Google Meet tab ${tabId} was closed. Auto-finalizing session.`);
    await stopRecordingSession();
  }
});

chrome.tabs?.onUpdated?.addListener(async (tabId, changeInfo) => {
  if (
    activeMeeting &&
    activeMeeting.tabId === tabId &&
    activeMeeting.status === 'recording' &&
    changeInfo.url &&
    !changeInfo.url.includes('meet.google.com')
  ) {
    logger.info(`Recorded tab navigated away from Google Meet to ${changeInfo.url}. Auto-finalizing.`);
    await stopRecordingSession();
  }
});
