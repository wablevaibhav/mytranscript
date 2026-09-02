/**
 * Custom React Hook: useLiveTranscript
 * Manages real-time live caption feed synchronization with IndexedDB and runtime messages.
 */

import { useState, useEffect, useCallback } from 'react';
import { TranscriptEntry } from '../../shared/types';
import { ExtensionMessage } from '../../shared/messages';
import { getTranscripts } from '../../shared/db';
import { logger } from '../../shared/utils/logger';

export function useLiveTranscript(meetingId: string | undefined) {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load existing transcripts from DB for this meeting
  const loadTranscripts = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const stored = await getTranscripts(id);
      setTranscripts(stored);
    } catch (err) {
      logger.error('Failed to load transcripts from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!meetingId) {
      setTranscripts([]);
      return;
    }

    loadTranscripts(meetingId);

    // Listen for live CAPTION_UPDATE events
    const messageListener = (message: ExtensionMessage) => {
      if (message.type === 'CAPTION_UPDATE') {
        const { meetingId: msgMeetingId, entry } = message.payload;
        if (msgMeetingId === meetingId) {
          setTranscripts((prev) => {
            const existingIndex = prev.findIndex((item) => item.id === entry.id);
            if (existingIndex >= 0) {
              // Update in place
              const next = [...prev];
              next[existingIndex] = entry;
              return next;
            } else {
              // Append new entry
              return [...prev, entry];
            }
          });
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [meetingId, loadTranscripts]);

  return {
    transcripts,
    isLoading,
    refreshTranscripts: () => meetingId && loadTranscripts(meetingId),
  };
}
