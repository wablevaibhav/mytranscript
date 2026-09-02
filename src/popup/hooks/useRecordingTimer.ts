/**
 * Custom React Hook: useRecordingTimer
 * Maintains synchronized duration counter across recording and paused states.
 */

import { useState, useEffect } from 'react';
import { MeetingStatus } from '../../shared/types';
import { formatDuration } from '../../shared/utils/formatters';

export function useRecordingTimer(initialDuration = 0, status: MeetingStatus) {
  const [seconds, setSeconds] = useState<number>(initialDuration);

  useEffect(() => {
    setSeconds(initialDuration);
  }, [initialDuration]);

  useEffect(() => {
    if (status !== 'recording') return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  return {
    seconds,
    formattedTime: formatDuration(seconds),
  };
}
