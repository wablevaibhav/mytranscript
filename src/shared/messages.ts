/**
 * Discriminated union types for Chrome runtime and tab messaging
 */

import { Meeting, MeetingStatus, TranscriptEntry } from './types';

export type ExtensionMessage =
  // Popup -> Service Worker
  | { type: 'START_RECORDING'; payload: { tabId: number; meetCode: string; url: string } }
  | { type: 'STOP_RECORDING'; payload: { meetingId: string } }
  | { type: 'PAUSE_RECORDING'; payload: { meetingId: string } }
  | { type: 'RESUME_RECORDING'; payload: { meetingId: string } }
  | { type: 'GET_STATUS' }
  | { type: 'DELETE_MEETING'; payload: { meetingId: string } }
  | { type: 'RECOVER_MEETING'; payload: { meetingId: string } }

  // Service Worker -> Offscreen Document
  | { type: 'OFFSCREEN_START_CAPTURE'; payload: { streamId: string; meetingId: string; timesliceMs: number } }
  | { type: 'OFFSCREEN_PAUSE_CAPTURE'; payload: { meetingId: string } }
  | { type: 'OFFSCREEN_RESUME_CAPTURE'; payload: { meetingId: string } }
  | { type: 'OFFSCREEN_STOP_CAPTURE'; payload: { meetingId: string } }

  // Offscreen -> Service Worker -> IndexedDB / Popup
  | { type: 'OFFSCREEN_RECORDING_STARTED'; payload: { meetingId: string; mimeType: string } }
  | { type: 'OFFSCREEN_CHUNK_AVAILABLE'; payload: { meetingId: string; chunkIndex: number; data: ArrayBuffer; byteLength: number } }
  | { type: 'OFFSCREEN_RECORDING_STOPPED'; payload: { meetingId: string; totalChunks: number; totalBytes: number } }
  | { type: 'OFFSCREEN_RECORDING_ERROR'; payload: { meetingId: string; error: string } }

  // Content Script -> Service Worker -> Popup
  | { type: 'CAPTION_UPDATE'; payload: { meetingId: string; entry: TranscriptEntry } }
  | { type: 'MEET_PAGE_DETECTED'; payload: { meetCode: string; url: string } }
  | { type: 'MEET_PAGE_LEFT'; payload: { meetCode: string } }

  // Broadcasts (Service Worker -> Popup)
  | { type: 'RECORDING_STATE_CHANGED'; payload: { meeting: Meeting; status: MeetingStatus } }
  | { type: 'RECORDING_ERROR'; payload: { meetingId?: string; error: string } };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
