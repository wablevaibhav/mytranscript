/**
 * Custom React Hook: useMeetingState
 * Manages active tab detection, meeting recording lifecycle, and service worker synchronization.
 */

import { useState, useEffect, useCallback } from 'react';
import { Meeting, MeetingStatus, TabInfo } from '../../shared/types';
import { ExtensionMessage } from '../../shared/messages';
import { getActiveTabInfo } from '../../shared/utils/tab';
import { logger } from '../../shared/utils/logger';

export function useMeetingState() {
  const [tabInfo, setTabInfo] = useState<TabInfo>({
    tabId: -1,
    url: '',
    isMeet: false,
    meetCode: null,
    title: '',
  });
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [status, setStatus] = useState<MeetingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Initial State Fetch
  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
      const tab = await getActiveTabInfo();
      setTabInfo(tab);

      // Query Background Service Worker
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
          if (response && response.success && response.data) {
            const currentMeeting = response.data.meeting as Meeting | null;
            const currentStatus = (response.data.status as MeetingStatus) || 'idle';
            setActiveMeeting(currentMeeting);
            setStatus(currentStatus);
            if (currentMeeting?.errorMessage) {
              setErrorMessage(currentMeeting.errorMessage);
            }
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      logger.error('Failed to load active meeting state:', err);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();

    // Listen for background state broadcasts
    const messageListener = (message: ExtensionMessage) => {
      if (message.type === 'RECORDING_STATE_CHANGED') {
        setActiveMeeting(message.payload.meeting);
        setStatus(message.payload.status);
      } else if (message.type === 'RECORDING_ERROR') {
        setErrorMessage(message.payload.error);
        setStatus('error');
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [refreshState]);

  // 2. Control Actions
  const startRecording = useCallback(async () => {
    if (!tabInfo.isMeet || !tabInfo.meetCode) {
      setErrorMessage('Please open a valid Google Meet tab first.');
      return;
    }

    setErrorMessage(null);
    setStatus('starting');

    chrome.runtime.sendMessage(
      {
        type: 'START_RECORDING',
        payload: {
          tabId: tabInfo.tabId,
          meetCode: tabInfo.meetCode,
          url: tabInfo.url,
        },
      },
      (response) => {
        if (!response?.success) {
          setStatus('error');
          setErrorMessage(response?.error || 'Failed to start recording tab.');
        } else if (response.data) {
          setActiveMeeting(response.data);
          setStatus('recording');
        }
      }
    );
  }, [tabInfo]);

  const pauseRecording = useCallback(() => {
    if (!activeMeeting) return;
    chrome.runtime.sendMessage({
      type: 'PAUSE_RECORDING',
      payload: { meetingId: activeMeeting.id },
    });
  }, [activeMeeting]);

  const resumeRecording = useCallback(() => {
    if (!activeMeeting) return;
    chrome.runtime.sendMessage({
      type: 'RESUME_RECORDING',
      payload: { meetingId: activeMeeting.id },
    });
  }, [activeMeeting]);

  const stopRecording = useCallback(() => {
    if (!activeMeeting) return;
    setStatus('stopping');
    chrome.runtime.sendMessage({
      type: 'STOP_RECORDING',
      payload: { meetingId: activeMeeting.id },
    });
  }, [activeMeeting]);

  const deleteMeeting = useCallback((meetingId: string) => {
    chrome.runtime.sendMessage(
      {
        type: 'DELETE_MEETING',
        payload: { meetingId },
      },
      () => {
        setActiveMeeting(null);
        setStatus('idle');
      }
    );
  }, []);

  const recoverMeeting = useCallback((meetingId: string) => {
    chrome.runtime.sendMessage(
      {
        type: 'RECOVER_MEETING',
        payload: { meetingId },
      },
      (response) => {
        if (response?.success && response.data) {
          setActiveMeeting(response.data);
          setStatus('completed');
        }
      }
    );
  }, []);

  return {
    tabInfo,
    activeMeeting,
    status,
    errorMessage,
    isLoading,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    deleteMeeting,
    recoverMeeting,
    refreshState,
  };
}
