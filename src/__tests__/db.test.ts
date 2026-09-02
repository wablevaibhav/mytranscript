import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveMeeting,
  getMeeting,
  updateMeeting,
  getActiveOrInterruptedMeeting,
  saveTranscriptEntry,
  getTranscripts,
  saveRecordingChunk,
  getRecordingChunks,
  deleteMeetingData,
} from '../shared/db';
import { Meeting, TranscriptEntry, RecordingChunk } from '../shared/types';

describe('IndexedDB Persistence Layer', () => {
  // In-memory data store for IndexedDB mock
  let meetingsTable: Map<string, Meeting>;
  let transcriptsTable: Map<string, TranscriptEntry>;
  let chunksTable: Map<number, RecordingChunk>;
  let autoIncrementChunkId: number;

  beforeEach(() => {
    meetingsTable = new Map();
    transcriptsTable = new Map();
    chunksTable = new Map();
    autoIncrementChunkId = 1;

    // Build functional IndexedDB mock
    const mockDB: unknown = {
      objectStoreNames: {
        contains: () => true,
      },
      createObjectStore: vi.fn(),
      transaction: () => {
        const txObj = {
          oncomplete: null as (() => void) | null,
          onerror: null as ((e: unknown) => void) | null,
          objectStore: (storeName: string) => {
            return {
              put: (item: unknown) => {
                const req = { onsuccess: null as (() => void) | null, onerror: null, result: undefined };
                setTimeout(() => {
                  if (storeName === 'meetings') {
                    const m = item as Meeting;
                    meetingsTable.set(m.id, { ...m });
                  } else if (storeName === 'transcripts') {
                    const t = item as TranscriptEntry;
                    transcriptsTable.set(t.id, { ...t });
                  }
                  if (req.onsuccess) req.onsuccess();
                  if (txObj.oncomplete) txObj.oncomplete();
                }, 0);
                return req;
              },
              add: (item: unknown) => {
                const req = { onsuccess: null as (() => void) | null, onerror: null, result: undefined };
                setTimeout(() => {
                  if (storeName === 'recordingChunks') {
                    const c = item as Omit<RecordingChunk, 'id'>;
                    const id = autoIncrementChunkId++;
                    chunksTable.set(id, { ...c, id });
                  }
                  if (req.onsuccess) req.onsuccess();
                  if (txObj.oncomplete) txObj.oncomplete();
                }, 0);
                return req;
              },
              get: (id: string) => {
                const req = { onsuccess: null as (() => void) | null, onerror: null, result: undefined as unknown };
                setTimeout(() => {
                  if (storeName === 'meetings') {
                    req.result = meetingsTable.get(id);
                  }
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
              delete: (id: string | number) => {
                if (storeName === 'meetings') {
                  meetingsTable.delete(id as string);
                } else if (storeName === 'transcripts') {
                  transcriptsTable.delete(id as string);
                } else if (storeName === 'recordingChunks') {
                  chunksTable.delete(id as number);
                }
              },
              clear: () => {
                if (storeName === 'meetings') meetingsTable.clear();
                if (storeName === 'transcripts') transcriptsTable.clear();
                if (storeName === 'recordingChunks') chunksTable.clear();
              },
              index: (indexName: string) => ({
                getAll: (query: string) => {
                  const req = { onsuccess: null as (() => void) | null, onerror: null, result: [] as unknown[] };
                  setTimeout(() => {
                    if (storeName === 'transcripts' && indexName === 'meetingId') {
                      req.result = Array.from(transcriptsTable.values()).filter((t) => t.meetingId === query);
                    } else if (storeName === 'recordingChunks' && indexName === 'meetingId') {
                      req.result = Array.from(chunksTable.values()).filter((c) => c.meetingId === query);
                    }
                    if (req.onsuccess) req.onsuccess();
                  }, 0);
                  return req;
                },
                openKeyCursor: (range: { lower?: string }) => {
                  const req = { onsuccess: null as ((e: { target: { result: unknown } }) => void) | null };
                  setTimeout(() => {
                    if (storeName === 'transcripts') {
                      const keys = Array.from(transcriptsTable.entries())
                        .filter(([_, t]) => t.meetingId === range.lower)
                        .map(([k]) => k);
                      let idx = 0;
                      const iterate = () => {
                        if (idx < keys.length) {
                          const key = keys[idx++];
                          const cursor = {
                            primaryKey: key,
                            continue: () => iterate(),
                          };
                          if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
                        } else {
                          if (req.onsuccess) req.onsuccess({ target: { result: null } });
                          if (txObj.oncomplete) txObj.oncomplete();
                        }
                      };
                      iterate();
                    } else if (storeName === 'recordingChunks') {
                      const keys = Array.from(chunksTable.entries())
                        .filter(([_, c]) => c.meetingId === range.lower)
                        .map(([k]) => k);
                      let idx = 0;
                      const iterate = () => {
                        if (idx < keys.length) {
                          const key = keys[idx++];
                          const cursor = {
                            primaryKey: key,
                            continue: () => iterate(),
                          };
                          if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
                        } else {
                          if (req.onsuccess) req.onsuccess({ target: { result: null } });
                          if (txObj.oncomplete) txObj.oncomplete();
                        }
                      };
                      iterate();
                    }
                  }, 0);
                  return req;
                },
              }),
              openCursor: (_query: unknown, _direction: string) => {
                const req = { onsuccess: null as ((e: { target: { result: unknown } }) => void) | null };
                setTimeout(() => {
                  const values = Array.from(meetingsTable.values());
                  let idx = values.length - 1;
                  const iterate = () => {
                    if (idx >= 0) {
                      const val = values[idx--];
                      const cursor = {
                        value: val,
                        continue: () => iterate(),
                      };
                      if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
                    } else {
                      if (req.onsuccess) req.onsuccess({ target: { result: null } });
                    }
                  };
                  iterate();
                }, 0);
                return req;
              },
            };
          },
        };
        return txObj;
      },
    };

    (globalThis as unknown as { IDBKeyRange: unknown }).IDBKeyRange = {
      only: (val: string) => ({ lower: val, upper: val }),
    };

    (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
      open: () => {
        const req = {
          onsuccess: null as (() => void) | null,
          onerror: null,
          result: mockDB,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and retrieves meeting metadata', async () => {
    const meeting: Meeting = {
      id: 'meet-101',
      meetCode: 'abc-defg-hij',
      title: 'Weekly Standup',
      url: 'https://meet.google.com/abc-defg-hij',
      tabId: 5,
      startedAt: Date.now(),
      duration: 120,
      status: 'completed',
    };

    await saveMeeting(meeting);
    const retrieved = await getMeeting('meet-101');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('meet-101');
    expect(retrieved?.title).toBe('Weekly Standup');
    expect(retrieved?.duration).toBe(120);
  });

  it('updates meeting status and duration seamlessly', async () => {
    const meeting: Meeting = {
      id: 'meet-102',
      meetCode: 'xyz-uvwx-rst',
      title: 'Sprint Planning',
      url: 'https://meet.google.com/xyz-uvwx-rst',
      tabId: 6,
      startedAt: Date.now(),
      duration: 10,
      status: 'recording',
    };

    await saveMeeting(meeting);
    await updateMeeting('meet-102', { duration: 45, status: 'paused' });

    const updated = await getMeeting('meet-102');
    expect(updated?.status).toBe('paused');
    expect(updated?.duration).toBe(45);
  });

  it('retrieves active or interrupted meetings correctly', async () => {
    const interruptedMeeting: Meeting = {
      id: 'meet-103',
      meetCode: 'rec-over-now',
      title: 'Interrupted Session',
      url: 'https://meet.google.com/rec-over-now',
      tabId: 7,
      startedAt: Date.now() - 50000,
      duration: 50,
      status: 'interrupted',
    };

    await saveMeeting(interruptedMeeting);
    const active = await getActiveOrInterruptedMeeting();

    expect(active).toBeDefined();
    expect(active?.id).toBe('meet-103');
    expect(active?.status).toBe('interrupted');
  });

  it('saves transcript entries and retrieves them chronologically sorted', async () => {
    const meetingId = 'meet-trans-test';
    const entry2: TranscriptEntry = {
      id: 't-2',
      meetingId,
      timestamp: 2000,
      relativeTime: 2,
      speaker: 'Speaker 2',
      text: 'Second utterance',
      isFinal: true,
    };
    const entry1: TranscriptEntry = {
      id: 't-1',
      meetingId,
      timestamp: 1000,
      relativeTime: 1,
      speaker: 'Speaker 1',
      text: 'First utterance',
      isFinal: true,
    };

    // Insert out of chronological order
    await saveTranscriptEntry(entry2);
    await saveTranscriptEntry(entry1);

    const transcripts = await getTranscripts(meetingId);
    expect(transcripts.length).toBe(2);
    expect(transcripts[0].id).toBe('t-1');
    expect(transcripts[1].id).toBe('t-2');
  });

  it('saves and returns recording chunks sorted by chunkIndex', async () => {
    const meetingId = 'meet-chunks-test';
    const chunk2 = {
      meetingId,
      chunkIndex: 1,
      timestamp: 2000,
      data: new Blob(['chunk2']),
      byteLength: 6,
    };
    const chunk1 = {
      meetingId,
      chunkIndex: 0,
      timestamp: 1000,
      data: new Blob(['chunk1']),
      byteLength: 6,
    };

    // Insert out of index order
    await saveRecordingChunk(chunk2);
    await saveRecordingChunk(chunk1);

    const chunks = await getRecordingChunks(meetingId);
    expect(chunks.length).toBe(2);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it('cascades deletion across meetings, transcripts, and recording chunks', async () => {
    const meetingId = 'meet-delete-all';
    await saveMeeting({
      id: meetingId,
      meetCode: 'del-code-123',
      title: 'To Be Deleted',
      url: 'https://meet.google.com/del-code-123',
      tabId: 9,
      startedAt: Date.now(),
      duration: 30,
      status: 'completed',
    });
    await saveTranscriptEntry({
      id: 'del-t-1',
      meetingId,
      timestamp: 1000,
      relativeTime: 1,
      speaker: 'Speaker',
      text: 'To be deleted text',
      isFinal: true,
    });
    await saveRecordingChunk({
      meetingId,
      chunkIndex: 0,
      timestamp: 1000,
      data: new Blob(['data']),
      byteLength: 4,
    });

    // Delete meeting data
    await deleteMeetingData(meetingId);

    const meetingAfter = await getMeeting(meetingId);
    const transcriptsAfter = await getTranscripts(meetingId);
    const chunksAfter = await getRecordingChunks(meetingId);

    expect(meetingAfter).toBeUndefined();
    expect(transcriptsAfter.length).toBe(0);
    expect(chunksAfter.length).toBe(0);
  });
});
