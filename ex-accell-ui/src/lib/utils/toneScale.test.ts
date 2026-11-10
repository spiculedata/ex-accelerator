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
});

// The portals and pages that once held their own traffic-light scale now take it from colorUtils.
const TONE_SCALE_FILES = [
  'src/lib/components/investigation/portals/ActorsPortal.svelte',
  'src/lib/components/investigation/portals/GeographyPortal.svelte',
  'src/lib/components/investigation/portals/CorrelationPortal.svelte',
  'src/routes/gdelt/+page.svelte',
  'src/lib/services/overviewDb.ts',
  'src/lib/services/radioAnalyticsDb.ts'
];

const GOOD_BAD_LINE = /tone|goldstein|sentiment|positive|negative|agreement/i;
const GREEN_OR_RED = /CHART\.(catGreen|danger\d{3})/;

describe('tone and agreement scales', () => {
  it.each(TONE_SCALE_FILES)('%s does not colour good and bad green and red', (path) => {
    // Other lines may still use these hues for a category or a state; a line about tone or sentiment may not
    const offending = readFileSync(path, 'utf8').split('\n').filter((line) => GOOD_BAD_LINE.test(line) && GREEN_OR_RED.test(line));
    expect(offending).toEqual([]);
  });
});
