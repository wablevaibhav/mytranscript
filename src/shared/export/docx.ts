/**
 * DOCX Exporter using docx package
 * Generates structured Microsoft Word document with metadata table and dialogues.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { Meeting, TranscriptEntry } from '../types';
import { formatDuration, formatFullDate, formatTimestamp } from '../utils/formatters';

export async function generateDocxBlob(meeting: Meeting, transcripts: TranscriptEntry[]): Promise<Blob> {
  const metadataRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Meeting Title:', bold: true, size: 20 })] })],
        }),
        new TableCell({
          width: { size: 75, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: meeting.title || meeting.meetCode, size: 20 })] })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Date & Time:', bold: true, size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: formatFullDate(meeting.startedAt), size: 20 })] })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Duration:', bold: true, size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: formatDuration(meeting.duration), size: 20 })] })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Google Meet URL:', bold: true, size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: meeting.url || `https://meet.google.com/${meeting.meetCode}`, size: 20 })] })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Total Entries:', bold: true, size: 20 })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${transcripts.length} dialogue entries`, size: 20 })] })],
        }),
      ],
    }),
  ];

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: metadataRows,
  });

  const dialogueParagraphs: Paragraph[] = [];

  if (transcripts.length === 0) {
    dialogueParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No live captions were recorded during this session.',
            italics: true,
            color: '64748B',
            size: 20,
          }),
        ],
        spacing: { before: 200 },
      })
    );
  } else {
    for (const entry of transcripts) {
      const timeStr = formatTimestamp(entry.timestamp);
      const speakerStr = entry.speaker || 'Unknown Speaker';

      dialogueParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: speakerStr,
              bold: true,
              color: '2563EB',
              size: 21,
            }),
            new TextRun({
              text: `  [${timeStr}]`,
              color: '64748B',
              size: 18,
            }),
          ],
          spacing: { before: 240, after: 60 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: entry.text,
              color: '1E293B',
              size: 20,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'Google Meet Transcript',
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Generated locally by Google Meet Recorder • Privacy-First',
                color: '64748B',
                size: 18,
              }),
            ],
            spacing: { after: 200 },
          }),
          metadataTable,
          new Paragraph({
            text: 'Transcript Dialogue',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 120 },
          }),
          ...dialogueParagraphs,
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
