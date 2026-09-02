/**
 * Main Popup React Application
 * Coordinates Screen 1 through Screen 8 based on Meet detection and recording lifecycle.
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { PrivacyBadge } from './components/PrivacyBadge';
import { MeetStatusCard } from './components/MeetStatusCard';
import { RecordingControls } from './components/RecordingControls';
import { TranscriptFeed } from './components/TranscriptFeed';
import { CompletedView } from './components/CompletedView';
import { DeleteModal } from './components/DeleteModal';
import { RecoveryBanner } from './components/RecoveryBanner';
import { useMeetingState } from './hooks/useMeetingState';
import { useLiveTranscript } from './hooks/useLiveTranscript';

export const App: React.FC = () => {
  const {
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
  } = useMeetingState();

  const { transcripts, isLoading: isTranscriptsLoading } = useLiveTranscript(activeMeeting?.id);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const getStatusBadge = () => {
    switch (status) {
      case 'recording':
        return 'Recording';
      case 'paused':
        return 'Paused';
      case 'starting':
        return 'Starting...';
      case 'stopping':
        return 'Finalizing...';
      case 'completed':
        return 'Recorded';
      case 'interrupted':
        return 'Recovery';
      default:
        return tabInfo.isMeet ? 'Ready' : undefined;
    }
  };

  return (
    <div className="flex flex-col h-[560px] max-h-[600px] bg-base text-slate-100 antialiased select-none">
      <Header statusText={getStatusBadge()} />

      <main className="flex-1 flex flex-col min-h-0 relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-40 bg-base/80 flex items-center justify-center text-xs text-slate-400">
            Checking Google Meet session...
          </div>
        )}

        {/* Screen 8: Interrupted Session Recovery */}
        {status === 'interrupted' && activeMeeting && (
          <RecoveryBanner
            meeting={activeMeeting}
            onRecover={(id) => recoverMeeting(id)}
            onDiscard={(id) => deleteMeeting(id)}
          />
        )}

        {/* Screen 5: Meeting Completed View */}
        {status === 'completed' && activeMeeting && (
          <CompletedView
            meeting={activeMeeting}
            transcripts={transcripts}
            onDeleteRequest={() => setIsDeleteModalOpen(true)}
            onDone={() => {
              deleteMeeting(activeMeeting.id);
              refreshState();
            }}
          />
        )}

        {/* Screen 3 & 4: Active Recording / Paused Stream */}
        {(status === 'recording' || status === 'paused' || status === 'starting' || status === 'stopping') && activeMeeting && (
          <div className="flex-1 flex flex-col min-h-0">
            <RecordingControls
              status={status}
              initialDuration={activeMeeting.duration || 0}
              onPause={pauseRecording}
              onResume={resumeRecording}
              onStop={stopRecording}
            />
            <TranscriptFeed
              transcripts={transcripts}
              isLoading={isTranscriptsLoading}
            />
          </div>
        )}

        {/* Screen 1 & 2: Not on Meet or Ready to Record */}
        {(status === 'idle' || status === 'error' || (!activeMeeting && status !== 'interrupted' && status !== 'completed')) && (
          <MeetStatusCard
            tabInfo={tabInfo}
            onStartRecording={startRecording}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        )}

        {/* Screen 7: Delete Confirmation Modal */}
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onCancel={() => setIsDeleteModalOpen(false)}
          onConfirm={() => {
            if (activeMeeting) {
              deleteMeeting(activeMeeting.id);
            }
            setIsDeleteModalOpen(false);
          }}
        />
      </main>

      <PrivacyBadge />
    </div>
  );
};
