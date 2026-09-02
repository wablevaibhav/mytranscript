/**
 * Google Meet Live Caption Observer
 * Uses MutationObserver to parse real-time speech from Google Meet closed captions DOM.
 */

import { TranscriptEntry } from '../shared/types';
import { MEET_SELECTORS } from './selectors';
import { contentLogger } from './contentLogger';

export type CaptionCallback = (entry: TranscriptEntry) => void;

export class CaptionObserver {
  private observer: MutationObserver | null = null;
  private isObserving = false;
  private meetingId: string = '';
  private callback: CaptionCallback | null = null;

  // Active utterance state tracking
  private currentEntryId: string = '';
  private currentSpeaker: string = '';
  private currentText: string = '';
  private currentTimestamp: number = 0;
  private lastUpdateTime: number = 0;
  private debounceTimer: number | null = null;

  constructor() {
    this.handleMutations = this.handleMutations.bind(this);
  }

  public start(meetingId: string, callback: CaptionCallback): void {
    if (this.isObserving) {
      this.stop();
    }

    this.meetingId = meetingId;
    this.callback = callback;
    this.isObserving = true;
    this.resetState();

    contentLogger.info('Starting CaptionObserver for meeting:', meetingId);

    this.observer = new MutationObserver(this.handleMutations);
    this.attachObserver();
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Flush any pending entry
    if (this.currentText.trim() && this.callback) {
      this.emitEntry(true);
    }

    this.isObserving = false;
    this.resetState();
    contentLogger.info('Stopped CaptionObserver.');
  }

  private resetState(): void {
    this.currentEntryId = '';
    this.currentSpeaker = '';
    this.currentText = '';
    this.currentTimestamp = 0;
    this.lastUpdateTime = 0;
  }

  private attachObserver(): void {
    if (!this.observer) return;

    // Observe document.body with subtree and characterData to catch dynamically mounted caption wrappers
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private handleMutations(): void {
    if (!this.isObserving) return;

    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    // Debounce to batch rapid characterData mutations
    this.debounceTimer = window.setTimeout(() => {
      this.parseCaptions();
    }, 150);
  }

  private parseCaptions(): void {
    // 1. Locate caption blocks across known container selectors
    const captionContainers = this.findCaptionContainers();

    if (captionContainers.length === 0) {
      return;
    }

    for (const container of captionContainers) {
      const speaker = this.extractSpeaker(container);
      const text = this.extractText(container);

      if (!text || text.trim().length === 0) {
        continue;
      }

      const cleanText = text.trim();
      const cleanSpeaker = speaker.trim() || 'Speaker';
      const now = Date.now();

      // Determine if this is a continuation of current utterance or a new speaker/sentence
      const isSameSpeaker = cleanSpeaker.toLowerCase() === this.currentSpeaker.toLowerCase();
      const isRecent = now - this.lastUpdateTime < 4500; // within 4.5 seconds

      if (isSameSpeaker && isRecent && this.currentEntryId) {
        // Continuous update: only update if text expanded or changed
        if (cleanText !== this.currentText) {
          this.currentText = cleanText;
          this.lastUpdateTime = now;
          this.emitEntry(false);
        }
      } else {
        // Speaker changed or speech paused: finalize previous entry if non-empty
        if (this.currentText.trim() && this.currentEntryId) {
          this.emitEntry(true);
        }

        // Start new entry
        this.currentEntryId = `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        this.currentSpeaker = cleanSpeaker;
        this.currentText = cleanText;
        this.currentTimestamp = now;
        this.lastUpdateTime = now;

        this.emitEntry(false);
      }
    }
  }

  private emitEntry(isFinal: boolean): void {
    if (!this.callback || !this.currentText.trim()) return;

    const entry: TranscriptEntry = {
      id: this.currentEntryId,
      meetingId: this.meetingId,
      timestamp: this.currentTimestamp || Date.now(),
      relativeTime: Math.floor((Date.now() - (this.currentTimestamp || Date.now())) / 1000),
      speaker: this.currentSpeaker || 'Speaker',
      text: this.currentText.trim(),
      isFinal,
    };

    this.callback(entry);
  }

  private findCaptionContainers(): HTMLElement[] {
    const results: HTMLElement[] = [];

    for (const selector of MEET_SELECTORS.CAPTION_CONTAINERS) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((node) => {
        if (node instanceof HTMLElement && node.innerText && node.innerText.trim().length > 0) {
          results.push(node);
        }
      });
    }

    // Fallback: search for any elements with class containing 'caption' or aria-live='polite'
    if (results.length === 0) {
      const genericNodes = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]');
      genericNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.innerText && node.innerText.trim().length > 0) {
          results.push(node);
        }
      });
    }

    return results;
  }

  private extractSpeaker(container: HTMLElement): string {
    for (const selector of MEET_SELECTORS.SPEAKER_ELEMENTS) {
      const el = container.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > 0) {
        return el.textContent.trim();
      }
    }

    // Fallback: Check for previous sibling or data-sender attribute
    const senderAttr = container.getAttribute('data-sender-name') || container.getAttribute('aria-label');
    if (senderAttr) return senderAttr;

    return 'Speaker';
  }

  private extractText(container: HTMLElement): string {
    // If specific text spans exist, gather text from them
    for (const selector of MEET_SELECTORS.TEXT_ELEMENTS) {
      const spans = container.querySelectorAll(selector);
      if (spans.length > 0) {
        const text = Array.from(spans)
          .map((s) => s.textContent || '')
          .join(' ')
          .trim();
        if (text.length > 0) return text;
      }
    }

    // Fallback: gather all innerText minus speaker text
    const fullText = container.innerText || container.textContent || '';
    const speaker = this.extractSpeaker(container);
    if (speaker && speaker !== 'Speaker' && fullText.startsWith(speaker)) {
      return fullText.replace(speaker, '').trim();
    }

    return fullText.trim();
  }
}

export const captionObserver = new CaptionObserver();
