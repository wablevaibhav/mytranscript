import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CaptionObserver } from '../content/captionObserver';
import { TranscriptEntry } from '../shared/types';

describe('CaptionObserver Parsing & Deduplication', () => {
  let observer: CaptionObserver;
  let emittedEntries: TranscriptEntry[];

  // Helper to create mock DOM elements
  function createMockElement(tag: string, text: string, className = '', attributes: Record<string, string> = {}) {
    const el = {
      tagName: tag.toUpperCase(),
      className,
      innerText: text,
      textContent: text,
      getAttribute: (name: string) => attributes[name] || null,
      querySelector: (selector: string) => {
        if (selector.includes('speaker') || selector.includes('TBMuR') || selector.includes('zs7s8d') || selector.includes('nMx7V')) {
          if (attributes['speaker']) {
            return createMockElement('div', attributes['speaker']);
          }
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('span') || selector.includes('VbkSUe') || selector.includes('ygGdYd')) {
          return [createMockElement('span', text)];
        }
        return [];
      },
    };
    return el;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    emittedEntries = [];
    observer = new CaptionObserver();

    // Mock MutationObserver
    globalThis.MutationObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      trigger: callback,
    })) as unknown as typeof MutationObserver;

    // Mock document
    (globalThis as unknown as { document: unknown }).document = {
      body: {},
      querySelectorAll: vi.fn().mockReturnValue([]),
    };

    // Mock HTMLElement
    (globalThis as unknown as { HTMLElement: { prototype: object } }).HTMLElement = class HTMLElement {} as unknown as { prototype: object };
  });

  afterEach(() => {
    observer.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes and starts observing closed caption mutations', () => {
    const callback = vi.fn();
    observer.start('meet-123', callback);

    expect(globalThis.MutationObserver).toHaveBeenCalled();
  });

  it('extracts speaker and continuous text correctly from caption containers', () => {
    const mockContainer = createMockElement(
      'div',
      'Rahul: We are building the local transcript engine.',
      'bh44bd',
      { speaker: 'Rahul Wable' }
    );
    Object.setPrototypeOf(mockContainer, (globalThis as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype);

    (document.querySelectorAll as unknown as ReturnType<typeof vi.fn>).mockReturnValue([mockContainer]);

    observer.start('meet-test', (entry) => {
      emittedEntries.push(entry);
    });

    (observer as unknown as { handleMutations: () => void }).handleMutations();
    vi.advanceTimersByTime(200);

    expect(emittedEntries.length).toBeGreaterThanOrEqual(1);
    const lastEntry = emittedEntries[emittedEntries.length - 1];
    expect(lastEntry.speaker).toBe('Rahul Wable');
    expect(lastEntry.text).toContain('We are building the local transcript engine.');
    expect(lastEntry.isFinal).toBe(false);
  });

  it('finalizes previous speaker entry when a new speaker begins speaking', () => {
    const firstContainer = createMockElement('div', 'First utterance by Vaibhav', 'bh44bd', {
      speaker: 'Vaibhav Wable',
    });
    Object.setPrototypeOf(firstContainer, (globalThis as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype);

    (document.querySelectorAll as unknown as ReturnType<typeof vi.fn>).mockReturnValue([firstContainer]);

    observer.start('meet-test', (entry) => {
      emittedEntries.push(entry);
    });

    (observer as unknown as { handleMutations: () => void }).handleMutations();
    vi.advanceTimersByTime(200);

    expect(emittedEntries.length).toBe(1);
    expect(emittedEntries[0].speaker).toBe('Vaibhav Wable');
    expect(emittedEntries[0].isFinal).toBe(false);

    // Second speaker appears
    const secondContainer = createMockElement('div', 'Second utterance by Alice', 'bh44bd', {
      speaker: 'Alice Smith',
    });
    Object.setPrototypeOf(secondContainer, (globalThis as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype);
    (document.querySelectorAll as unknown as ReturnType<typeof vi.fn>).mockReturnValue([secondContainer]);

    (observer as unknown as { handleMutations: () => void }).handleMutations();
    vi.advanceTimersByTime(200);

    // Should have finalized first entry (isFinal: true) and emitted new entry for second speaker
    expect(emittedEntries.length).toBe(3);
    expect(emittedEntries[1].speaker).toBe('Vaibhav Wable');
    expect(emittedEntries[1].isFinal).toBe(true);
    expect(emittedEntries[2].speaker).toBe('Alice Smith');
    expect(emittedEntries[2].isFinal).toBe(false);
  });

  it('flushes pending speech as final when stopped', () => {
    const container = createMockElement('div', 'Final speech sentence before ending', 'bh44bd', {
      speaker: 'Vaibhav Wable',
    });
    Object.setPrototypeOf(container, (globalThis as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype);
    (document.querySelectorAll as unknown as ReturnType<typeof vi.fn>).mockReturnValue([container]);

    observer.start('meet-test', (entry) => {
      emittedEntries.push(entry);
    });

    (observer as unknown as { handleMutations: () => void }).handleMutations();
    vi.advanceTimersByTime(200);

    expect(emittedEntries.length).toBe(1);

    // Stop observer
    observer.stop();

    // Last emitted should be finalized
    expect(emittedEntries.length).toBe(2);
    expect(emittedEntries[1].isFinal).toBe(true);
    expect(emittedEntries[1].text).toBe('Final speech sentence before ending');
  });
});
