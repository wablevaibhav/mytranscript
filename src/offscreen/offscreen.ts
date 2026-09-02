/**
 * Offscreen Document Script
 * Runs in chrome.offscreen sandboxed window to handle media capture and recording.
 */

import { mediaRecorderEngine } from './mediaRecorderEngine';
import { ExtensionMessage, MessageResponse } from '../shared/messages';
import { logger } from '../shared/utils/logger';

logger.info('Offscreen document initialized.');

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleOffscreenMessage(message)
    .then((response) => sendResponse(response))
    .catch((err) => {
      logger.error('Error handling offscreen message:', err);
      sendResponse({ success: false, error: String(err) });
    });

  return true; // Keep channel open for async response
});

async function handleOffscreenMessage(message: ExtensionMessage): Promise<MessageResponse> {
  switch (message.type) {
    case 'OFFSCREEN_START_CAPTURE': {
      const { streamId, meetingId, timesliceMs } = message.payload;
      try {
        const mimeType = await mediaRecorderEngine.startCapture(streamId, meetingId, timesliceMs);

        // Notify service worker that recording started
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_RECORDING_STARTED',
          payload: { meetingId, mimeType },
        });

        return { success: true, data: { mimeType } };
      } catch (err) {
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_RECORDING_ERROR',
          payload: { meetingId, error: String(err) },
        });
        return { success: false, error: String(err) };
      }
    }

    case 'OFFSCREEN_PAUSE_CAPTURE': {
      mediaRecorderEngine.pauseCapture();
      return { success: true };
    }

    case 'OFFSCREEN_RESUME_CAPTURE': {
      mediaRecorderEngine.resumeCapture();
      return { success: true };
    }

    case 'OFFSCREEN_STOP_CAPTURE': {
      const { meetingId } = message.payload;
      const result = await mediaRecorderEngine.stopCapture();

      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_RECORDING_STOPPED',
        payload: {
          meetingId,
          totalChunks: result.totalChunks,
          totalBytes: result.totalBytes,
        },
      });

      return { success: true, data: result };
    }

    default:
      return { success: false, error: 'Unknown message type for offscreen document' };
  }
}
