/**
 * Background Service Worker (Manifest V3)
 * Central orchestrator managing Offscreen Documents, Tab Streams,
 * Message Routing, and Meeting Lifecycles.
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
} from '../shared/db';
import { logger } from '../shared/utils/logger';

let activeMeeting: Meeting | null = null;
let lastTimerCheck = Date.now();
let durationInterval: number | null = null;

// Initialize on service worker startup
async function initServiceWorker() {
  logger.info('Service Worker initialized.');

  // Check for any unfinalized meetings in storage or DB
  try {
    const existing = await getActiveOrInterruptedMeeting();
    if (existing && (existing.status === 'recording' || existing.status === 'paused')) {
      // If service worker restarted during an active recording, flag as interrupted so user can recover
      existing.status = 'interrupted';
      await updateMeeting(existing.id, { status: 'interrupted' });
      activeMeeting = existing;
      logger.warn(`Recovered unfinalized meeting ${existing.id} marked as interrupted.`);
    }
  } catch (err) {
    logger.error('Error during startup DB check:', err);
  }
}

initServiceWorker();

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
      // If we don't have an active meeting in memory, check IndexedDB
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

        // 1. Get tab capture stream ID for the target Meet tab
        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
            if (chrome.runtime.lastError || !id) {
              reject(new Error(chrome.runtime.lastError?.message || 'Could not obtain tab stream ID.'));
            } else {
              resolve(id);
            }
          });
        });

        // 2. Ensure Offscreen Document is loaded
        await ensureOffscreenDocument();

        // 3. Dispatch stream capture command to offscreen document
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_START_CAPTURE',
          payload: {
            streamId,
            meetingId,
            timesliceMs: 3000,
          },
        });

        // 4. Update status to recording
        activeMeeting.status = 'recording';
        await updateMeeting(meetingId, { status: 'recording' });
        await chrome.storage.local.set({ recordingStatus: 'recording' });
        startDurationTracking();

        // 5. Notify Google Meet content script to begin caption observation
        try {
          chrome.tabs.sendMessage(tabId, {
            type: 'RECORDING_STATE_CHANGED',
            payload: { meeting: activeMeeting, status: 'recording' },
          });
        } catch (e) {
          logger.debug('Tab message send failed (content script might be initializing):', e);
        }

        // Broadcast state change
        broadcastMessage({
          type: 'RECORDING_STATE_CHANGED',
          payload: { meeting: activeMeeting, status: 'recording' },
        });

        return { success: true, data: activeMeeting };
      } catch (err) {
        logger.error('START_RECORDING failed:', err);
        if (activeMeeting) {
          activeMeeting.status = 'error';
          activeMeeting.errorMessage = String(err);
          await updateMeeting(activeMeeting.id, { status: 'error', errorMessage: String(err) });
        }
        await closeOffscreenDocument();
        return { success: false, error: String(err) };
      }
    }

    case 'PAUSE_RECORDING': {
      if (!activeMeeting || activeMeeting.status !== 'recording') {
        return { success: false, error: 'No active recording to pause.' };
      }

      activeMeeting.status = 'paused';
      await updateMeeting(activeMeeting.id, { status: 'paused' });
      await chrome.storage.local.set({ recordingStatus: 'paused' });

      // Notify offscreen document
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_PAUSE_CAPTURE',
        payload: { meetingId: activeMeeting.id },
      });

      // Notify content script
      if (activeMeeting.tabId) {
        chrome.tabs.sendMessage(activeMeeting.tabId, {
          type: 'RECORDING_STATE_CHANGED',
          payload: { meeting: activeMeeting, status: 'paused' },
        }).catch(() => {});
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

      // Notify offscreen document
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_RESUME_CAPTURE',
        payload: { meetingId: activeMeeting.id },
      });

      // Notify content script
      if (activeMeeting.tabId) {
        chrome.tabs.sendMessage(activeMeeting.tabId, {
          type: 'RECORDING_STATE_CHANGED',
          payload: { meeting: activeMeeting, status: 'recording' },
        }).catch(() => {});
      }

      broadcastMessage({
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: activeMeeting, status: 'recording' },
      });

      return { success: true, data: activeMeeting };
    }

    case 'STOP_RECORDING': {
      if (!activeMeeting) {
        return { success: false, error: 'No active recording to stop.' };
      }

      const meetingId = activeMeeting.id;
      stopDurationTracking();

      // Signal offscreen document to finalize chunks and stop
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_STOP_CAPTURE',
        payload: { meetingId },
      });

      activeMeeting.status = 'completed';
      activeMeeting.endedAt = Date.now();
      await updateMeeting(meetingId, {
        status: 'completed',
        endedAt: activeMeeting.endedAt,
        duration: activeMeeting.duration,
      });

      await chrome.storage.local.set({ recordingStatus: 'completed' });

      // Notify content script
      if (activeMeeting.tabId) {
        chrome.tabs.sendMessage(activeMeeting.tabId, {
          type: 'RECORDING_STATE_CHANGED',
          payload: { meeting: activeMeeting, status: 'completed' },
        }).catch(() => {});
      }

      broadcastMessage({
        type: 'RECORDING_STATE_CHANGED',
        payload: { meeting: activeMeeting, status: 'completed' },
      });

      await closeOffscreenDocument();
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

      // Relay to popup if open
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

    case 'MEET_PAGE_LEFT': {
      // If user navigated away or closed Google Meet while recording, finalize gracefully
      if (activeMeeting && activeMeeting.status === 'recording' && sender.tab?.id === activeMeeting.tabId) {
        logger.info('Google Meet tab left or closed during active recording. Finalizing session.');
        await handleRuntimeMessage({ type: 'STOP_RECORDING', payload: { meetingId: activeMeeting.id } }, sender);
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
      // Popup might be closed, which is completely normal and expected
    });
  } catch {
    // Suppress unhandled broadcast errors when no listeners are active
  }
}

// ---------------------------------------------------------------------------
// Tab Listeners (Detect closed tabs & navigation)
// ---------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (activeMeeting && activeMeeting.tabId === tabId && activeMeeting.status === 'recording') {
    logger.info(`Recorded Google Meet tab ${tabId} was closed. Finalizing recording gracefully.`);
    await handleRuntimeMessage(
      { type: 'STOP_RECORDING', payload: { meetingId: activeMeeting.id } },
      {} as chrome.runtime.MessageSender
    );
  }
});
