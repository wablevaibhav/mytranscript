/**
 * Content Script for Google Meet Tabs
 * Injected automatically into https://meet.google.com/*
 */

import { captionObserver } from './captionObserver';
import { ExtensionMessage } from '../shared/messages';
import { contentLogger } from './contentLogger';

function extractMeetCode(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (match) return match[1];

  // Try extracting from URL params or generic path
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && !parts[0].startsWith('_')) {
    return parts[0];
  }
  return null;
}

function initContentScript() {
  const meetCode = extractMeetCode();
  contentLogger.info('Google Meet content script initialized. Meeting code:', meetCode);

  if (meetCode) {
    try {
      chrome.runtime.sendMessage({
        type: 'MEET_PAGE_DETECTED',
        payload: {
          meetCode,
          url: window.location.href,
        },
      });
    } catch (e) {
      contentLogger.debug('Extension context not ready yet:', e);
    }
  }

  // Listen for recording commands from Background Service Worker
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'RECORDING_STATE_CHANGED': {
        const { meeting, status } = message.payload;
        if (status === 'recording') {
          captionObserver.start(meeting.id, (entry) => {
            try {
              chrome.runtime.sendMessage({
                type: 'CAPTION_UPDATE',
                payload: {
                  meetingId: meeting.id,
                  entry,
                },
              });
            } catch (err) {
              contentLogger.debug('Failed sending caption update:', err);
            }
          });
        } else if (status === 'paused') {
          // Keep observer attached but don't finalize
        } else if (status === 'completed' || status === 'idle' || status === 'error') {
          captionObserver.stop();
        }
        sendResponse({ success: true });
        break;
      }

      default:
        break;
    }
    return false;
  });

  // Handle page unloading / meeting leave
  window.addEventListener('beforeunload', () => {
    captionObserver.stop();
    if (meetCode) {
      try {
        chrome.runtime.sendMessage({
          type: 'MEET_PAGE_LEFT',
          payload: { meetCode },
        });
      } catch {
        // Ignored on window unload
      }
    }
  });
}

initContentScript();
