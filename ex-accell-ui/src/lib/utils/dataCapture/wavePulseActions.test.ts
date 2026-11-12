import { describe, it, expect } from 'vitest';
import {
  addRadioStream,
  addTimeSlot,
  buildWavePulseResults,
  getWavePulseStartError,
  removeRadioStream,
  removeTimeSlot
} from './wavePulseActions';
import { createDefaultWavePulseConfig } from './configDefaults';

describe('radio stream editing', () => {
  const config = createDefaultWavePulseConfig();

  it('adds an empty stream with one default slot without changing the input', () => {
    const next = addRadioStream(config);
    expect(next.radioStreams).toHaveLength(2);
    expect(next.radioStreams[1]).toEqual({
      url: '',
      radioName: '',
      state: '',
      timeSlots: [{ start: '08:00', end: '18:00' }]
    });
    expect(config.radioStreams).toHaveLength(1);
  });

  it('removes a stream by index', () => {
    const two = addRadioStream(config);
    expect(removeRadioStream(two, 0).radioStreams).toEqual([two.radioStreams[1]]);
  });

  it('adds and removes time slots on the chosen stream only', () => {
    const two = addRadioStream(config);
    const added = addTimeSlot(two, 0);
    expect(added.radioStreams[0].timeSlots).toHaveLength(3);
    expect(added.radioStreams[1].timeSlots).toHaveLength(1);
    expect(two.radioStreams[0].timeSlots).toHaveLength(2);

    const removed = removeTimeSlot(added, 0, 0);
    expect(removed.radioStreams[0].timeSlots.map((s) => s.start)).toEqual(['17:00', '08:00']);
  });
});

describe('getWavePulseStartError', () => {
  const base = { ...createDefaultWavePulseConfig(), enableDiarization: false, enableClassification: false };

  it('requires a Hugging Face token for diarization, checked first', () => {
    const config = { ...base, enableDiarization: true, enableClassification: true };
    expect(getWavePulseStartError(config)).toBe('Hugging Face token is required for speaker diarization');
  });

  it('requires a Gemini key for classification', () => {
    const config = { ...base, enableClassification: true };
    expect(getWavePulseStartError(config)).toBe('Google Gemini API key is required for content classification');
  });

  it('passes when keys are present or components are off', () => {
    expect(getWavePulseStartError(base)).toBeNull();
    expect(getWavePulseStartError({ ...base, enableClassification: true, geminiApiKey: 'k' })).toBeNull();
  });
});

describe('buildWavePulseResults', () => {
  it('summarises the started run', () => {
    const results = buildWavePulseResults(createDefaultWavePulseConfig(), new Date('2026-01-01T00:00:00Z'));
    expect(results).toEqual({
      status: 'Started WavePulse radio stream analysis',
      streamsConfigured: 1,
      componentsEnabled: { recording: true, transcription: true, classification: true, diarization: false },
      startTime: '2026-01-01T00:00:00.000Z'
    });
  });
});
