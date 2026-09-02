/**
 * Offscreen MediaRecorder Engine with Web Audio Loopback
 * Captures tab video/audio streams, maintains user speaker loopback,
 * and flushes binary slices directly to IndexedDB.
 */

import { saveRecordingChunk } from '../shared/db';
import { logger } from '../shared/utils/logger';

export class MediaRecorderEngine {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  private meetingId: string = '';
  private chunkIndex: number = 0;
  private totalBytes: number = 0;
  private selectedMimeType: string = '';

  public async startCapture(streamId: string, meetingId: string, timesliceMs = 3000): Promise<string> {
    this.meetingId = meetingId;
    this.chunkIndex = 0;
    this.totalBytes = 0;

    logger.info(`Acquiring userMedia for streamId: ${streamId}, meeting: ${meetingId}`);

    try {
      // 1. Acquire Tab Capture Stream via getUserMedia with chromeMediaSource
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-expect-error chromeMediaSource is a Chrome-specific constraint
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
        },
        video: {
          // @ts-expect-error chromeMediaSource is a Chrome-specific constraint
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30,
          },
        },
      });

      this.mediaStream = stream;

      // 2. Audio Loopback Pipeline (Crucial for Meet: prevents tab capture from silencing audio)
      this.setupAudioLoopback(stream);

      // 3. Detect Optimal Codec / MIME
      this.selectedMimeType = this.detectSupportedMimeType();
      logger.info(`Using MediaRecorder MIME type: ${this.selectedMimeType}`);

      // 4. Initialize MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: this.selectedMimeType,
      };

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          await this.handleChunk(event.data);
        }
      };

      this.mediaRecorder.onerror = (event: Event) => {
        logger.error('MediaRecorder error:', event);
      };

      this.mediaRecorder.onstop = () => {
        logger.info(`MediaRecorder stopped. Total chunks: ${this.chunkIndex}, Total bytes: ${this.totalBytes}`);
      };

      // 5. Start MediaRecorder with timeslice chunking
      this.mediaRecorder.start(timesliceMs);

      return this.selectedMimeType;
    } catch (err) {
      logger.error('Failed to start tab stream capture:', err);
      this.cleanup();
      throw err;
    }
  }

  public pauseCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      logger.info('MediaRecorder paused.');
    }
  }

  public resumeCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      logger.info('MediaRecorder resumed.');
    }
  }

  public async stopCapture(): Promise<{ totalChunks: number; totalBytes: number }> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const result = { totalChunks: this.chunkIndex, totalBytes: this.totalBytes };
        this.cleanup();
        resolve(result);
        return;
      }

      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const result = { totalChunks: this.chunkIndex, totalBytes: this.totalBytes };
        this.cleanup();
        resolve(result);
      };

      try {
        recorder.stop();
      } catch (err) {
        logger.warn('Error during recorder.stop():', err);
        const result = { totalChunks: this.chunkIndex, totalBytes: this.totalBytes };
        this.cleanup();
        resolve(result);
      }
    });
  }

  private setupAudioLoopback(stream: MediaStream): void {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.audioSource = this.audioContext.createMediaStreamSource(stream);
        // Connect directly to audioContext destination to ensure user still hears tab audio
        this.audioSource.connect(this.audioContext.destination);
        logger.info('Audio loopback connected successfully.');
      }
    } catch (err) {
      logger.warn('Failed to set up audio loopback graph:', err);
    }
  }

  private async handleChunk(blob: Blob): Promise<void> {
    const currentIndex = this.chunkIndex++;
    const size = blob.size;
    this.totalBytes += size;

    try {
      // Direct write to IndexedDB
      await saveRecordingChunk({
        meetingId: this.meetingId,
        chunkIndex: currentIndex,
        data: blob,
        timestamp: Date.now(),
        byteLength: size,
      });

      logger.debug(`Saved recording chunk #${currentIndex} (${size} bytes) for ${this.meetingId}`);
    } catch (err) {
      logger.error(`Failed to save recording chunk #${currentIndex}:`, err);
    }
  }

  private detectSupportedMimeType(): string {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'audio/webm;codecs=opus',
      'audio/webm',
    ];

    for (const candidate of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return 'video/webm';
  }

  private cleanup(): void {
    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
      } catch {
        // Ignored
      }
      this.audioSource = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // Ignored
      }
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
  }
}

export const mediaRecorderEngine = new MediaRecorderEngine();
