import type { WavePulseConfig } from './types';

const DEFAULT_SLOT = { start: '08:00', end: '18:00' };

/** Config with one more, empty radio stream. */
export function addRadioStream(config: WavePulseConfig): WavePulseConfig {
  return {
    ...config,
    radioStreams: [
      ...config.radioStreams,
      { url: '', radioName: '', state: '', timeSlots: [{ ...DEFAULT_SLOT }] }
    ]
  };
}

export function removeRadioStream(config: WavePulseConfig, index: number): WavePulseConfig {
  return { ...config, radioStreams: config.radioStreams.filter((_, i) => i !== index) };
}

export function addTimeSlot(config: WavePulseConfig, streamIndex: number): WavePulseConfig {
  return {
    ...config,
    radioStreams: config.radioStreams.map((stream, i) =>
      i === streamIndex ? { ...stream, timeSlots: [...stream.timeSlots, { ...DEFAULT_SLOT }] } : stream
    )
  };
}

export function removeTimeSlot(config: WavePulseConfig, streamIndex: number, slotIndex: number): WavePulseConfig {
  return {
    ...config,
    radioStreams: config.radioStreams.map((stream, i) =>
      i === streamIndex ? { ...stream, timeSlots: stream.timeSlots.filter((_, s) => s !== slotIndex) } : stream
    )
  };
}

/** The message to show when a required key is missing for an enabled component, else null. */
export function getWavePulseStartError(config: WavePulseConfig): string | null {
  if (!config.huggingFaceToken && config.enableDiarization) {
    return 'Hugging Face token is required for speaker diarization';
  }
  if (!config.geminiApiKey && config.enableClassification) {
    return 'Google Gemini API key is required for content classification';
  }
  return null;
}

/** What the WavePulse tab reports once it has started. */
export function buildWavePulseResults(config: WavePulseConfig, now: Date = new Date()) {
  return {
    status: 'Started WavePulse radio stream analysis',
    streamsConfigured: config.radioStreams.length,
    componentsEnabled: {
      recording: config.enableRecording,
      transcription: config.enableTranscription,
      classification: config.enableClassification,
      diarization: config.enableDiarization
    },
    startTime: now.toISOString()
  };
}
