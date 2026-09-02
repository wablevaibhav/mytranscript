/**
 * WebM Media Exporter
 * Assembles binary chunks from IndexedDB into a unified WebM media Blob.
 */

import { Meeting } from '../types';
import { getRecordingChunks } from '../db';

export async function assembleWebmBlob(meeting: Meeting): Promise<Blob> {
  const chunks = await getRecordingChunks(meeting.id);

  if (chunks.length === 0) {
    throw new Error('No recording video/audio chunks found in local database.');
  }

  const mimeType = meeting.recordingMimeType || 'video/webm';
  const binaryParts: (ArrayBuffer | Blob)[] = chunks.map((c) => c.data);

  return new Blob(binaryParts, { type: mimeType });
}
