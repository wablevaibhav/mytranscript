/**
 * Isolated Google Meet DOM Selectors
 * Keeping selectors in a dedicated module ensures easy updates when Meet DOM changes.
 */

export const MEET_SELECTORS = {
  // Main caption parent container
  CAPTION_CONTAINERS: [
    'div[jsname="ds3Trf"]',                      // Standard live captions container
    'div[aria-live="polite"]',                    // Accessibility caption region
    'div[aria-live="assertive"]',
    'div[class*="caption"]',
    'div[class*="Caption"]',
    '.a4bIc',                                    // Legacy / Current Meet caption root
    '.iTTPOb',                                   // Alternate Meet caption container
  ],

  // Speaker name element inside a caption block
  SPEAKER_ELEMENTS: [
    'div[class*="speaker"]',
    'span[class*="speaker"]',
    '.zs75Ib',                                   // Speaker name container in Meet
    '.NWXrdb',                                   // Speaker name text
    'div[class*="T4LgNb"]',
    'span[class*="jxFHg"]',
  ],

  // Spoken text / dialogue spans
  TEXT_ELEMENTS: [
    'span[class*="caption"]',
    'span[class*="Caption"]',
    '.VbkSUe',                                   // Caption dialogue span
    '.bh44bd',                                   // Caption sentence span
    'span[jsname="YS01Ge"]',
    'span',
  ],

  // Call status / meeting room indicators
  MEETING_ROOM_INDICATORS: [
    'div[data-meeting-title]',
    'div[data-unresolved-meeting-id]',
    'button[aria-label*="Leave call" i]',
    'button[aria-label*="leave" i]',
    'button[jsname="CQylAd"]',
    'div[class*="u6vdEc"]',
  ],

  // Closed caption toggle button in Meet toolbar
  CAPTION_BUTTONS: [
    'button[aria-label*="turn on caption" i]',
    'button[aria-label*="caption" i]',
    'button[aria-label*="subtítulo" i]',
    'button[data-tooltip*="caption" i]',
    'button[jsname="r8qRAd"]',
  ],

  // Leave call button selectors
  LEAVE_CALL_BUTTONS: [
    'button[aria-label*="Leave call" i]',
    'button[aria-label*="Salir de la llamada" i]',
    'button[data-tooltip*="Leave call" i]',
    'button[jsname="CQylAd"]',
  ],

  // End of call / Left meeting screens
  CALL_ENDED_CONTAINERS: [
    'div[data-call-ended="true"]',
    '.jh07Ec',
    'div[class*="leave-screen"]',
    'div[class*="left-meeting"]',
  ],
};
