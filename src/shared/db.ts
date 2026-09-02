/**
 * IndexedDB persistence layer for Google Meet Recorder & Local Transcript
 * Stores meetings metadata, real-time transcripts, and binary recording chunks.
 */

import { Meeting, TranscriptEntry, RecordingChunk } from './types';

const DB_NAME = 'meet_recorder_db';
const DB_VERSION = 1;

const STORES = {
  MEETINGS: 'meetings',
  TRANSCRIPTS: 'transcripts',
  RECORDING_CHUNKS: 'recordingChunks',
  SETTINGS: 'settings',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Meetings Store
      if (!db.objectStoreNames.contains(STORES.MEETINGS)) {
        const meetingStore = db.createObjectStore(STORES.MEETINGS, { keyPath: 'id' });
        meetingStore.createIndex('status', 'status', { unique: false });
        meetingStore.createIndex('startedAt', 'startedAt', { unique: false });
      }

      // 2. Transcripts Store
      if (!db.objectStoreNames.contains(STORES.TRANSCRIPTS)) {
        const transcriptStore = db.createObjectStore(STORES.TRANSCRIPTS, { keyPath: 'id' });
        transcriptStore.createIndex('meetingId', 'meetingId', { unique: false });
        transcriptStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 3. Recording Chunks Store
      if (!db.objectStoreNames.contains(STORES.RECORDING_CHUNKS)) {
        const chunkStore = db.createObjectStore(STORES.RECORDING_CHUNKS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        chunkStore.createIndex('meetingId', 'meetingId', { unique: false });
        chunkStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
      }

      // 4. Settings Store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Meetings Store Operations
// ---------------------------------------------------------------------------

export async function saveMeeting(meeting: Meeting): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEETINGS, 'readwrite');
    const store = tx.objectStore(STORES.MEETINGS);
    const request = store.put(meeting);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEETINGS, 'readonly');
    const store = tx.objectStore(STORES.MEETINGS);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateMeeting(id: string, updates: Partial<Meeting>): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEETINGS, 'readwrite');
    const store = tx.objectStore(STORES.MEETINGS);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as Meeting | undefined;
      if (!existing) {
        resolve();
        return;
      }
      const updated: Meeting = { ...existing, ...updates };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEETINGS, 'readonly');
    const store = tx.objectStore(STORES.MEETINGS);
    const request = store.openCursor(null, 'prev');
    const results: Meeting[] = [];

    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        results.push(cursor.value as Meeting);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export interface DatabaseStats {
  totalMeetings: number;
  totalDurationSec: number;
  totalTranscripts: number;
  totalRecordingBytes: number;
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.MEETINGS, STORES.TRANSCRIPTS, STORES.RECORDING_CHUNKS], 'readonly');
    const meetingStore = tx.objectStore(STORES.MEETINGS);
    const transcriptStore = tx.objectStore(STORES.TRANSCRIPTS);
    const chunkStore = tx.objectStore(STORES.RECORDING_CHUNKS);

    let totalDurationSec = 0;
    let totalRecordingBytes = 0;
    let totalMeetings = 0;
    let totalTranscripts = 0;

    const mReq = meetingStore.openCursor();
    mReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const m = cursor.value as Meeting;
        totalMeetings++;
        totalDurationSec += m.duration || 0;
        cursor.continue();
      }
    };

    const tReq = transcriptStore.count();
    tReq.onsuccess = () => {
      totalTranscripts = tReq.result || 0;
    };

    const cReq = chunkStore.openCursor();
    cReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const c = cursor.value as RecordingChunk;
        totalRecordingBytes += c.byteLength || 0;
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      resolve({
        totalMeetings,
        totalDurationSec,
        totalTranscripts,
        totalRecordingBytes,
      });
    };

    tx.onerror = () => reject(tx.error);
  });
}

export async function getActiveOrInterruptedMeeting(): Promise<Meeting | undefined> {
  const db = await getDB();
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEETINGS, 'readonly');
    const store = tx.objectStore(STORES.MEETINGS);
    const request = store.openCursor(null, 'prev');

    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const meeting = cursor.value as Meeting;
        // Keep active, paused, interrupted, or completed meetings within the 6-hour retention window
        if (
          meeting.status === 'recording' ||
          meeting.status === 'paused' ||
          meeting.status === 'interrupted' ||
          meeting.status === 'completed'
        ) {
          if (meeting.status === 'completed') {
            const age = now - (meeting.endedAt || meeting.startedAt);
            if (age < SIX_HOURS_MS) {
              resolve(meeting);
              return;
            }
          } else {
            resolve(meeting);
            return;
          }
        }
        cursor.continue();
      } else {
        resolve(undefined);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Automatically purges meeting recordings and transcripts older than 6 hours
 */
export async function cleanupExpiredMeetings(maxAgeMs = 6 * 60 * 60 * 1000): Promise<number> {
  const db = await getDB();
  const now = Date.now();
  let purgedCount = 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEETINGS, 'readonly');
    const store = tx.objectStore(STORES.MEETINGS);
    const request = store.openCursor();

    const expiredIds: string[] = [];

    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const meeting = cursor.value as Meeting;
        const meetingEnd = meeting.endedAt || meeting.startedAt;
        if (meeting.status === 'completed' && now - meetingEnd > maxAgeMs) {
          expiredIds.push(meeting.id);
        }
        cursor.continue();
      } else {
        // Delete all expired
        Promise.all(expiredIds.map((id) => deleteMeetingData(id)))
          .then(() => {
            purgedCount = expiredIds.length;
            resolve(purgedCount);
          })
          .catch(reject);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Transcripts Store Operations
// ---------------------------------------------------------------------------

export async function saveTranscriptEntry(entry: TranscriptEntry): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRANSCRIPTS, 'readwrite');
    const store = tx.objectStore(STORES.TRANSCRIPTS);
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getTranscripts(meetingId: string): Promise<TranscriptEntry[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRANSCRIPTS, 'readonly');
    const store = tx.objectStore(STORES.TRANSCRIPTS);
    const index = store.index('meetingId');
    const request = index.getAll(meetingId);

    request.onsuccess = () => {
      const results = (request.result as TranscriptEntry[]) || [];
      // Sort chronologically by timestamp
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Recording Chunks Operations
// ---------------------------------------------------------------------------

export async function saveRecordingChunk(chunk: Omit<RecordingChunk, 'id'>): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDING_CHUNKS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDING_CHUNKS);
    const request = store.add(chunk);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordingChunks(meetingId: string): Promise<RecordingChunk[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RECORDING_CHUNKS, 'readonly');
    const store = tx.objectStore(STORES.RECORDING_CHUNKS);
    const index = store.index('meetingId');
    const request = index.getAll(meetingId);

    request.onsuccess = () => {
      const results = (request.result as RecordingChunk[]) || [];
      // Sort strictly by chunkIndex to ensure seamless concatenation
      results.sort((a, b) => a.chunkIndex - b.chunkIndex);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Deletion & Purge Operations
// ---------------------------------------------------------------------------

export async function deleteMeetingData(meetingId: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [STORES.MEETINGS, STORES.TRANSCRIPTS, STORES.RECORDING_CHUNKS],
      'readwrite'
    );

    // 1. Delete meeting record
    tx.objectStore(STORES.MEETINGS).delete(meetingId);

    // 2. Delete transcripts for meetingId
    const transcriptStore = tx.objectStore(STORES.TRANSCRIPTS);
    const transcriptIndex = transcriptStore.index('meetingId');
    const transcriptReq = transcriptIndex.openKeyCursor(IDBKeyRange.only(meetingId));
    transcriptReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursor>).result;
      if (cursor) {
        transcriptStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    // 3. Delete recording chunks for meetingId
    const chunkStore = tx.objectStore(STORES.RECORDING_CHUNKS);
    const chunkIndex = chunkStore.index('meetingId');
    const chunkReq = chunkIndex.openKeyCursor(IDBKeyRange.only(meetingId));
    chunkReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursor>).result;
      if (cursor) {
        chunkStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [STORES.MEETINGS, STORES.TRANSCRIPTS, STORES.RECORDING_CHUNKS],
      'readwrite'
    );
    tx.objectStore(STORES.MEETINGS).clear();
    tx.objectStore(STORES.TRANSCRIPTS).clear();
    tx.objectStore(STORES.RECORDING_CHUNKS).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
