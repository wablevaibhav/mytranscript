/**
 * PDF Exporter using jsPDF
 * Generates formatted, paginated transcripts with meeting metadata and speaker dialogues.
 */

import { jsPDF } from 'jspdf';
import { Meeting, TranscriptEntry } from '../types';
import { formatDuration, formatFullDate, formatTimestamp } from '../utils/formatters';

export async function generatePdfBlob(meeting: Meeting, transcripts: TranscriptEntry[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(margin, y, contentWidth, 18, 'F');

  doc.setTextColor(248, 250, 252); // Slate 50
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Google Meet Transcript', margin + 6, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Privacy-First Local Export', pageWidth - margin - 6, y + 11, { align: 'right' });

  y += 24;

  // Metadata Card
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85); // Slate 700

  doc.setFont('helvetica', 'bold');
  doc.text('Meeting:', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.title || meeting.meetCode, margin + 22, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 4, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(formatFullDate(meeting.startedAt), margin + 22, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Duration:', margin + 4, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDuration(meeting.duration), margin + 22, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('URL:', margin + 90, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(meeting.url || `https://meet.google.com/${meeting.meetCode}`, margin + 102, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Entries:', margin + 90, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${transcripts.length} dialogue entries`, margin + 106, y + 12);

  y += 30;

  // Transcript Section Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Transcript', margin, y);
  y += 6;

  // Divider line
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  if (transcripts.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No live captions were recorded during this session.', margin, y + 6);
  } else {
    for (const entry of transcripts) {
      const timeStr = formatTimestamp(entry.timestamp);
      const speakerStr = entry.speaker || 'Unknown Speaker';

      // Estimate height needed for this entry
      const textLines = doc.splitTextToSize(entry.text, contentWidth - 4);
      const entryHeight = 6 + textLines.length * 4.5 + 4;

      checkPageBreak(entryHeight);

      // Speaker & Timestamp Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(37, 99, 235); // Blue 600
      doc.text(speakerStr, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // Slate 500
      const speakerWidth = doc.getTextWidth(speakerStr);
      doc.text(`[${timeStr}]`, margin + speakerWidth + 3, y);

      y += 4.5;

      // Dialogue Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text(textLines, margin, y);

      y += textLines.length * 4.5 + 3;
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Page ${i} of ${totalPages} • Generated locally by Google Meet Recorder`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}
