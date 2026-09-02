import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatBytes,
  sanitizeFilename,
  generateExportFilename,
} from '../shared/utils/formatters';

describe('Formatters & Sanitization', () => {
  it('formats duration correctly', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(45)).toBe('00:45');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3665)).toBe('01:01:05');
  });

  it('formats bytes into readable human units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024 * 5.5)).toBe('5.5 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 1.2)).toBe('1.2 GB');
  });

  it('sanitizes illegal filename characters', () => {
    expect(sanitizeFilename('Meeting: Review/Plan *Draft*?')).toBe('Meeting_ReviewPlan_Draft');
    expect(sanitizeFilename('meet-abc-defg-hij')).toBe('meet-abc-defg-hij');
  });

  it('generates structured export filenames', () => {
    const startedAt = new Date('2026-09-02T14:30:00').getTime();
    const filename = generateExportFilename('abc-defg-hij', startedAt, 'pdf');
    expect(filename).toContain('Meet_abc-defg-hij_');
    expect(filename.endsWith('.pdf')).toBe(true);
  });
});
