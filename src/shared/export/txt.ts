/**
 * Plain Text (TXT) Exporter
 * Generates formatted UTF-8 plain text transcripts with timestamps and speaker labels.
 */

import { Meeting, TranscriptEntry } from '../types';
import { formatDuration, formatFullDate, formatTimestamp } from '../utils/formatters';

export function generateTxtBlob(meeting: Meeting, transcripts: TranscriptEntry[]): Blob {
  const divider = '='.repeat(60);
  const subDivider = '-'.repeat(60);

  const lines: string[] = [
    divider,
    `Google Meet Transcript: ${meeting.title || meeting.meetCode}`,
    divider,
    `Date & Time : ${formatFullDate(meeting.startedAt)}`,
    `Duration    : ${formatDuration(meeting.duration)}`,
    `Meeting URL : ${meeting.url || `https://meet.google.com/${meeting.meetCode}`}`,
    `Total Lines : ${transcripts.length}`,
    divider,
    '',
  ];

  if (transcripts.length === 0) {
    lines.push('(No live captions recorded during this session)');
  } else {
    for (const entry of transcripts) {
      const timeStr = formatTimestamp(entry.timestamp);
      const speakerStr = entry.speaker || 'Unknown Speaker';

      lines.push(`[${timeStr}] ${speakerStr}:`);
      lines.push(entry.text);
      lines.push('');
    }
  }

  lines.push(subDivider);
  lines.push('Exported locally via Google Meet Recorder (Privacy-First)');

  const content = lines.join('\n');
  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}
