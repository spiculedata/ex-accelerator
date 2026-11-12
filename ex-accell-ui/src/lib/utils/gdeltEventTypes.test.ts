import { describe, expect, it } from 'vitest';
import { CHART } from './chartColors';
import { GDELT_EVENT_TYPES, getEventType, getEventTypeColor } from './gdeltEventTypes';

describe('getEventType', () => {
  it('matches the code by prefix', () => {
    expect(getEventType('40')).toBe('support');
    expect(getEventType('043')).toBe('other');
    expect(getEventType('80')).toBe('military');
    expect(getEventType('1031')).toBe('verbal_cooperation');
  });

  it('takes the first type in declaration order when prefixes overlap', () => {
    // 14 is both verbal cooperation and protests, 190 is both material conflict and violence
    expect(getEventType('14')).toBe('verbal_cooperation');
    expect(getEventType('190')).toBe('material_conflict');
    // Every verbal conflict code starts with a verbal cooperation one, so that type is never chosen
    expect(getEventType('120')).toBe('verbal_cooperation');
  });

  it('is other when nothing matches', () => {
    expect(getEventType('99')).toBe('other');
    expect(getEventType('')).toBe('other');
  });
});

describe('getEventTypeColor', () => {
  it('uses the colour of the type', () => {
    expect(getEventTypeColor('40')).toBe(CHART.catGreen);
    expect(getEventTypeColor('80')).toBe(CHART.ink900);
  });

  it('falls back to a neutral grey for other', () => {
    expect(getEventTypeColor('99')).toBe(CHART.ink500);
  });
});

describe('GDELT_EVENT_TYPES', () => {
  it('gives every type a label, a description and a colour', () => {
    for (const config of Object.values(GDELT_EVENT_TYPES)) {
      expect(config.label).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.codes.length).toBeGreaterThan(0);
    }
  });
});
