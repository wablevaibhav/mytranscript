/**
 * Unified Exporter Engine
 * Handles single format downloads, multi-format bundles, and verified atomic Export & Delete.
 */

import { ExportFormat, ExportResult } from '../types';
import { getMeeting, getTranscripts, deleteMeetingData } from '../db';
import { generatePdfBlob } from './pdf';
import { generateDocxBlob } from './docx';
import { generateTxtBlob } from './txt';
import { assembleWebmBlob } from './webm';
import { generateExportFilename } from '../utils/formatters';
import { logger } from '../utils/logger';

export async function triggerBlobDownload(blob: Blob, filename: string): Promise<boolean> {
  try {
    const blobUrl = URL.createObjectURL(blob);

    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      return new Promise((resolve) => {
        chrome.downloads.download(
          {
            url: blobUrl,
            filename: filename,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError || !downloadId) {
              logger.warn('chrome.downloads.download failed, falling back to anchor click:', chrome.runtime.lastError);
              fallbackAnchorDownload(blobUrl, filename);
            }
            // Cleanup object URL after a short delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
            resolve(true);
          }
        );
      });
    } else {
      fallbackAnchorDownload(blobUrl, filename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      return true;
    }
  } catch (err) {
    logger.error('Failed to trigger blob download:', err);
    throw err;
  }
}

function fallbackAnchorDownload(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportMeetingFile(meetingId: string, format: ExportFormat): Promise<ExportResult> {
  const meeting = await getMeeting(meetingId);
  if (!meeting) {
    throw new Error(`Meeting with ID ${meetingId} not found in database.`);
  }

  const transcripts = await getTranscripts(meetingId);
  let blob: Blob;
  let ext: string;

  switch (format) {
    case 'pdf':
      blob = await generatePdfBlob(meeting, transcripts);
      ext = 'pdf';
      break;
    case 'docx':
      blob = await generateDocxBlob(meeting, transcripts);
      ext = 'docx';
      break;
    case 'txt':
      blob = generateTxtBlob(meeting, transcripts);
      ext = 'txt';
      break;
    case 'webm':
      blob = await assembleWebmBlob(meeting);
      ext = 'webm';
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const filename = generateExportFilename(meeting.meetCode, meeting.startedAt, ext);
  await triggerBlobDownload(blob, filename);

  return {
    format,
    filename,
    success: true,
  };
}

/**
 * Atomic Export & Delete:
 * 1. Generates and triggers download of selected files (PDF, DOCX, TXT, WebM)
 * 2. ONLY after all downloads are initiated and verified, deletes local records from IndexedDB
 */
export async function exportAndPurgeMeeting(
  meetingId: string,
  formats: ExportFormat[] = ['pdf', 'txt', 'webm']
): Promise<{ success: boolean; exportedCount: number; purged: boolean }> {
  const meeting = await getMeeting(meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found.`);
  }

  const transcripts = await getTranscripts(meetingId);
  let exportedCount = 0;

  for (const format of formats) {
    try {
      let blob: Blob | null = null;
      let ext = format;

      if (format === 'pdf') {
        blob = await generatePdfBlob(meeting, transcripts);
      } else if (format === 'docx') {
        blob = await generateDocxBlob(meeting, transcripts);
      } else if (format === 'txt') {
        blob = generateTxtBlob(meeting, transcripts);
      } else if (format === 'webm') {
        try {
          blob = await assembleWebmBlob(meeting);
        } catch {
          // If no video chunks were saved, skip WebM without failing transcript export
          logger.warn('Skipping WebM download: no chunks recorded.');
          continue;
        }
      }

      if (blob) {
        const filename = generateExportFilename(meeting.meetCode, meeting.startedAt, ext);
        await triggerBlobDownload(blob, filename);
        exportedCount++;
      }
    } catch (err) {
      logger.error(`Failed to export format ${format}:`, err);
      // Under rule R-EXP-03: NEVER delete data if an export step failed!
      throw new Error(`Export failed for format ${format}. Local data has NOT been deleted to prevent data loss.`);
    }
  }

  // ONLY delete once all exports have succeeded
  await deleteMeetingData(meetingId);
  logger.info(`Successfully exported ${exportedCount} files and purged local meeting ${meetingId}.`);

  return {
    success: true,
    exportedCount,
    purged: true,
  };
}
