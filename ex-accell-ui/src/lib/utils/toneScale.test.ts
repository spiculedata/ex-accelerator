import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAgreementColor, getSentimentColor, getToneColor, getToneLabel, getToneLevel } from './colorUtils';

// GDELT tone and Goldstein values are a sentiment, so they take the brand sentiment scale (blue to orange), never a
// red/amber/green traffic light that many people cannot tell apart.
describe('getToneLevel', () => {
  it.each([
    [7, 'very positive'],
    [5.01, 'very positive'],
    [5, 'positive'],
    [1.5, 'positive'],
    [1, 'neutral'],
    [0, 'neutral'],
    [-1, 'neutral'],
    [-1.01, 'negative'],
    [-5, 'negative'],
    [-5.01, 'very negative'],
    [-9, 'very negative']
  ])('places a tone of %s at "%s"', (tone, level) => {
    expect(getToneLevel(tone)).toBe(level);
  });

  it('collapses to three bands when asked', () => {
    expect(getToneLevel(7, 3)).toBe('positive');
    expect(getToneLevel(0, 3)).toBe('neutral');
    expect(getToneLevel(-7, 3)).toBe('negative');
  });

  it('treats a missing tone as neutral', () => {
    expect(getToneLevel(Number.NaN)).toBe('neutral');
    expect(getToneLevel(undefined as unknown as number)).toBe('neutral');
  });
});

describe('getToneColor', () => {
  it('is the sentiment colour of the tone level', () => {
    expect(getToneColor(7)).toBe(getSentimentColor('very positive'));
    expect(getToneColor(2, 3)).toBe(getSentimentColor('positive'));
    expect(getToneColor(-2, 3)).toBe(getSentimentColor('negative'));
    expect(getToneColor(0)).toBe(getSentimentColor('neutral'));
  });
});

describe('getToneLabel', () => {
  it('reads as a word so colour is never the only cue', () => {
    expect(getToneLabel(2)).toBe('Positive');
    expect(getToneLabel(-7)).toBe('Very negative');
    expect(getToneLabel(-7, 3)).toBe('Negative');
  });
});

describe('getAgreementColor', () => {
  it('runs blue (sources agree) to orange (they disagree)', () => {
    expect(getAgreementColor(0.9)).toBe(getSentimentColor('positive'));
    expect(getAgreementColor(0.5)).toBe(getSentimentColor('neutral'));
    expect(getAgreementColor(0.2)).toBe(getSentimentColor('negative'));
  });

  it('changes band just above 0.7 and 0.4, matching the consensus line in the portal', () => {
    expect(getAgreementColor(0.71)).toBe(getSentimentColor('positive'));
    expect(getAgreementColor(0.7)).toBe(getSentimentColor('neutral'));
    expect(getAgreementColor(0.41)).toBe(getSentimentColor('neutral'));
    expect(getAgreementColor(0.4)).toBe(getSentimentColor('negative'));
  });
});

// The portals and services that once held their own traffic-light scale now call the shared one, and the green of
// that scale is gone from the file. (overviewDb still colours the YouTube platform with danger500; that is a
// platform colour, not a tone, and is handled with the other hue-only categories.)
const TONE_SCALE_FILES: [string, string][] = [
  ['src/lib/components/investigation/portals/ActorsPortal.svelte', 'getToneColor('],
  ['src/lib/components/investigation/portals/GeographyPortal.svelte', 'getToneColor('],
  ['src/lib/components/investigation/portals/CorrelationPortal.svelte', 'getAgreementColor('],
  ['src/lib/services/overviewDb.ts', 'getSentimentColor('],
  ['src/lib/services/radioAnalyticsDb.ts', 'getSentimentColor(']
];

describe('tone and agreement scales', () => {
  it.each(TONE_SCALE_FILES)('%s takes its scale from colorUtils', (path, call) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain(call);
    expect(source).not.toMatch(/CHART\.catGreen/);
  });

  it.each(['ActorsPortal', 'GeographyPortal', 'CorrelationPortal'])('%s no longer pairs green with red', (name) => {
    expect(readFileSync(`src/lib/components/investigation/portals/${name}.svelte`, 'utf8')).not.toMatch(/CHART\.danger\d{3}/);
  });
});
