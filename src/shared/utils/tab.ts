/**
 * Chrome Tab and Google Meet detection utilities
 */

import { TabInfo } from '../types';

const MEET_REGEX = /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i;
const MEET_GENERIC_REGEX = /^https:\/\/meet\.google\.com\/(.*)/i;

export async function getActiveTabInfo(): Promise<TabInfo> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return {
      tabId: -1,
      url: '',
      isMeet: false,
      meetCode: null,
      title: 'Browser Tab',
    };
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab || !activeTab.id || !activeTab.url) {
    return {
      tabId: -1,
      url: '',
      isMeet: false,
      meetCode: null,
      title: 'No Active Tab',
    };
  }

  const url = activeTab.url;
  const match = url.match(MEET_REGEX);
  const genericMatch = url.match(MEET_GENERIC_REGEX);

  let meetCode: string | null = null;
  let isMeet = false;

  if (match && match[1]) {
    meetCode = match[1];
    isMeet = true;
  } else if (genericMatch && genericMatch[1] && !genericMatch[1].startsWith('_meet/')) {
    const rawPath = genericMatch[1].split('?')[0].split('#')[0];
    if (rawPath.length > 0) {
      meetCode = rawPath;
      isMeet = true;
    }
  }

  return {
    tabId: activeTab.id,
    url,
    isMeet,
    meetCode,
    title: activeTab.title || (meetCode ? `Google Meet (${meetCode})` : 'Google Meet'),
  };
}

export function openGoogleMeetTab(): void {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: 'https://meet.google.com/new' });
  } else {
    window.open('https://meet.google.com/new', '_blank');
  }
}
