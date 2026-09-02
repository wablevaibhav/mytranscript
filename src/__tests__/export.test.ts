import { describe, it, expect } from 'vitest';
import { generateTxtBlob } from '../shared/export/txt';
import { generateDocxBlob } from '../shared/export/docx';
import { generatePdfBlob } from '../shared/export/pdf';
import { Meeting, TranscriptEntry } from '../shared/types';

describe('Export Generation', () => {
  const mockMeeting: Meeting = {
    id: 'meet-test-123',
    meetCode: 'test-code',
    title: 'Test Google Meet Call',
    url: 'https://meet.google.com/test-code',
    tabId: 1,
    startedAt: 1725280000000,
    duration: 125,
    status: 'completed',
  };

  const mockTranscripts: TranscriptEntry[] = [
    {
      id: 'entry-1',
      meetingId: 'meet-test-123',
      timestamp: 1725280010000,
      relativeTime: 10,
      speaker: 'Rahul Wable',
      text: 'Hello everyone, welcome to the architecture sync.',
      isFinal: true,
    },
    {
      id: 'entry-2',
      meetingId: 'meet-test-123',
      timestamp: 1725280025000,
      relativeTime: 25,
      speaker: 'Vaibhav Wable',
      text: 'Hi Rahul, we have completed the local-first offscreen recording engine.',
      isFinal: true,
    },
  ];

  it('generates a valid plain text transcript blob', async () => {
    const blob = generateTxtBlob(mockMeeting, mockTranscripts);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/plain;charset=utf-8');

    const text = await blob.text();
    expect(text).toContain('Google Meet Transcript: Test Google Meet Call');
    expect(text).toContain('Rahul Wable');
    expect(text).toContain('Hello everyone, welcome to the architecture sync.');
    expect(text).toContain('Vaibhav Wable');
  });

  it('generates a valid DOCX blob', async () => {
    const blob = await generateDocxBlob(mockMeeting, mockTranscripts);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });

  it('generates a valid PDF blob', async () => {
    const blob = await generatePdfBlob(mockMeeting, mockTranscripts);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });
});
