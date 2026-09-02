import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getActiveTabInfo, openGoogleMeetTab } from '../shared/utils/tab';

describe('Tab & Google Meet Detection Utilities', () => {
  const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
  });

  it('returns safe fallback when chrome API is not defined', async () => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    const tabInfo = await getActiveTabInfo();
    expect(tabInfo.tabId).toBe(-1);
    expect(tabInfo.isMeet).toBe(false);
    expect(tabInfo.meetCode).toBeNull();
  });

  it('detects a standard Google Meet URL correctly', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 101,
            url: 'https://meet.google.com/abc-defg-hij',
            title: 'Design Review - Google Meet',
          },
        ]),
      },
    };

    const tabInfo = await getActiveTabInfo();
    expect(tabInfo.tabId).toBe(101);
    expect(tabInfo.isMeet).toBe(true);
    expect(tabInfo.meetCode).toBe('abc-defg-hij');
    expect(tabInfo.title).toBe('Design Review - Google Meet');
  });

  it('detects Google Meet URL with query parameters', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 102,
            url: 'https://meet.google.com/xyz-uvwx-rst?authuser=1&pli=1',
            title: '',
          },
        ]),
      },
    };

    const tabInfo = await getActiveTabInfo();
    expect(tabInfo.tabId).toBe(102);
    expect(tabInfo.isMeet).toBe(true);
    expect(tabInfo.meetCode).toBe('xyz-uvwx-rst');
    expect(tabInfo.title).toBe('Google Meet (xyz-uvwx-rst)');
  });

  it('identifies non-Meet URLs as not Meet tabs', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 103,
            url: 'https://github.com/mytranscript',
            title: 'GitHub',
          },
        ]),
      },
    };

    const tabInfo = await getActiveTabInfo();
    expect(tabInfo.tabId).toBe(103);
    expect(tabInfo.isMeet).toBe(false);
    expect(tabInfo.meetCode).toBeNull();
  });

  it('opens a new Google Meet tab using chrome.tabs when available', () => {
    const createMock = vi.fn();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        create: createMock,
      },
    };

    openGoogleMeetTab();
    expect(createMock).toHaveBeenCalledWith({ url: 'https://meet.google.com/new' });
  });
});
