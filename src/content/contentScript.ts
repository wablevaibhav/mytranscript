/**
 * Content Script for Google Meet Tabs
 * Injected automatically into https://meet.google.com/*
 * Handles automatic meeting detection, caption auto-enablement, and end-of-call detection.
 */

import { captionObserver } from './captionObserver';
import { ExtensionMessage } from '../shared/messages';
import { MEET_SELECTORS } from './selectors';
import { contentLogger } from './contentLogger';

let currentMeetingId: string | null = null;
let hasRequestedAutoStart = false;
let callEndObserver: MutationObserver | null = null;
let captionCheckInterval: number | null = null;

function extractMeetCode(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (match) return match[1];

  // Try extracting from URL path if valid code format
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && !parts[0].startsWith('_') && parts[0].length >= 9) {
    return parts[0];
  }
  return null;
}

function isInsideMeetingRoom(): boolean {
  for (const selector of MEET_SELECTORS.MEETING_ROOM_INDICATORS) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  return false;
}

function isCallEnded(): boolean {
  for (const selector of MEET_SELECTORS.CALL_ENDED_CONTAINERS) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  // Check page text for "You left the meeting" or "Return to home screen"
  const bodyText = document.body ? document.body.innerText || '' : '';
  if (
    bodyText.includes('You left the meeting') ||
    bodyText.includes('Return to home screen') ||
    bodyText.includes('You have left the meeting')
  ) {
    return true;
  }

  return false;
}

function autoEnableCaptions() {
  for (const selector of MEET_SELECTORS.CAPTION_BUTTONS) {
    const btn = document.querySelector(selector) as HTMLButtonElement | null;
    if (btn) {
      const isPressed = btn.getAttribute('aria-pressed');
      // If caption button is present and not yet pressed/active, click it
      if (isPressed === 'false' || isPressed === null) {
        contentLogger.info('Automatically enabling Google Meet closed captions...');
        btn.click();
        return;
      }
    }
  }
}

function triggerAutoStart(meetCode: string) {
  if (hasRequestedAutoStart) return;
  hasRequestedAutoStart = true;

  contentLogger.info('Triggering automatic recording for meeting:', meetCode);

  try {
    chrome.runtime.sendMessage(
      {
        type: 'AUTO_START_RECORDING',
        payload: {
          meetCode,
          url: window.location.href,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          contentLogger.debug('Auto-start response warning:', chrome.runtime.lastError.message);
        } else if (response?.data?.id) {
          currentMeetingId = response.data.id;
        }
      }
    );
  } catch (err) {
    contentLogger.warn('Error dispatching AUTO_START_RECORDING:', err);
  }
}

function triggerAutoStop(reason: string) {
  contentLogger.info(`Triggering automatic recording stop (Reason: ${reason})...`);
  captionObserver.stop();

  try {
    chrome.runtime.sendMessage({
      type: 'STOP_RECORDING',
      payload: {
        meetingId: currentMeetingId || undefined,
      },
    });
  } catch (err) {
    contentLogger.debug('Error sending STOP_RECORDING:', err);
  }
}

function setupCallEndObserver() {
  if (callEndObserver) return;

  callEndObserver = new MutationObserver(() => {
    if (isCallEnded()) {
      triggerAutoStop('Call ended screen detected');
      if (callEndObserver) {
        callEndObserver.disconnect();
        callEndObserver = null;
      }
    }
  });

  if (document.body) {
    callEndObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

function initContentScript() {
  const meetCode = extractMeetCode();
  contentLogger.info('Google Meet content script initialized. Meeting code:', meetCode);

  if (!meetCode) return;

  // 1. Listen for recording commands from Background Service Worker
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'RECORDING_STATE_CHANGED': {
        const { meeting, status } = message.payload;
        currentMeetingId = meeting.id;

        if (status === 'recording') {
          // Ensure captions are active
          autoEnableCaptions();

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

  // 2. Periodic check to auto-start when joining room and auto-enable captions
  let attempts = 0;
  captionCheckInterval = window.setInterval(() => {
    attempts++;

    // Try auto-enabling captions and auto-starting once in meeting room
    if (isInsideMeetingRoom() || attempts > 2) {
      autoEnableCaptions();
      triggerAutoStart(meetCode);
      setupCallEndObserver();

      if (attempts > 15) {
        if (captionCheckInterval !== null) {
          clearInterval(captionCheckInterval);
          captionCheckInterval = null;
        }
      }
    }
  }, 1000);

  // 3. Listen for Leave Call button clicks
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const leaveBtn = target.closest('button[aria-label*="Leave call" i], button[jsname="CQylAd"], button[data-tooltip*="Leave" i]');
      if (leaveBtn) {
        contentLogger.info('User clicked Leave Call button.');
        // Give a brief 300ms window for any final utterance then stop
        setTimeout(() => {
          triggerAutoStop('Leave call button clicked');
        }, 300);
      }
    },
    true
  );

  // 4. Handle page unloading / tab close
  window.addEventListener('beforeunload', () => {
    captionObserver.stop();
    triggerAutoStop('Page unload / tab closed');
  });

  window.addEventListener('pagehide', () => {
    captionObserver.stop();
    triggerAutoStop('Page hidden');
  });
}

// Start content script
initContentScript();
