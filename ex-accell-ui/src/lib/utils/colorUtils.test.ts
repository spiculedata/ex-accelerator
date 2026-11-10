import {
  getStatusColor, getStatusIcon,
  getSentimentColor, getSentimentIcon,
  getCategoryColor,
  getConfidenceColor, getHealthColor,
  getTrendColor, getTrendIcon
} from './colorUtils';

describe('getStatusColor', () => {
  it.each([
    ['active', 'bg-primary-100 text-primary-800'],
    ['running', 'bg-primary-100 text-primary-800'],
    ['success', 'bg-green-100 text-green-800'],
    ['completed', 'bg-green-100 text-green-800'],
    ['paused', 'bg-yellow-100 text-yellow-800'],
    ['pending', 'bg-yellow-100 text-yellow-800'],
    ['warning', 'bg-yellow-100 text-yellow-800'],
    ['error', 'bg-red-100 text-red-800'],
    ['failed', 'bg-red-100 text-red-800'],
    ['cancelled', 'bg-gray-100 text-gray-800'],
    ['archived', 'bg-gray-100 text-gray-800'],
    ['inactive', 'bg-gray-100 text-gray-800'],
    ['info', 'bg-primary-100 text-primary-800'],
  ])('returns correct color for "%s"', (status, expected) => {
    expect(getStatusColor(status)).toBe(expected);
  });

  it('returns default for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('bg-gray-100 text-gray-800');
  });

  it('returns default for null-ish input', () => {
    expect(getStatusColor(null as unknown as string)).toBe('bg-gray-100 text-gray-800');
    expect(getStatusColor(undefined as unknown as string)).toBe('bg-gray-100 text-gray-800');
  });
});

describe('getStatusIcon', () => {
  it.each([
    ['active', '🟢'], ['running', '🟢'],
    ['success', '✅'], ['completed', '✅'],
    ['paused', '🟡'], ['pending', '🟡'], ['warning', '⚠️'],
    ['error', '🔴'], ['failed', '🔴'],
    ['cancelled', '⚪'],
    ['info', 'ℹ️'],
  ])('returns correct icon for "%s"', (status, expected) => {
    expect(getStatusIcon(status)).toBe(expected);
  });

  it('returns bullet for unknown status', () => {
    expect(getStatusIcon('unknown')).toBe('●');
  });
});

describe('getSentimentColor', () => {
  // The brand sentiment scale: blue (positive) to orange (negative), safe for common colour blindness
  it.each([
    ['very positive', '#0072b2'],
    ['positive', '#56b4e9'],
    ['neutral', '#98a2ae'],
    ['negative', '#e69f00'],
    ['very negative', '#d55e00'],
  ])('returns correct hex for "%s"', (sentiment, expected) => {
    expect(getSentimentColor(sentiment)).toBe(expected);
  });

  it('returns the neutral hex for unknown sentiment', () => {
    expect(getSentimentColor('unknown')).toBe('#98a2ae');
  });

  it('keeps positive on the blue side and negative on the warm side, with no green anywhere', () => {
    const hexes = ['very positive', 'positive', 'neutral', 'negative', 'very negative'].map((s) => getSentimentColor(s));
    const isGreen = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return g > r + 20 && g > b + 20;
    };
    expect(hexes.some(isGreen)).toBe(false);

    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const level of ['very positive', 'positive']) {
      const [r, , b] = channels(getSentimentColor(level));
      expect(b).toBeGreaterThan(r);
    }
    for (const level of ['negative', 'very negative']) {
      const [r, , b] = channels(getSentimentColor(level));
      expect(r).toBeGreaterThan(b);
    }
  });

  it.each([
    ['very positive', 'bg-sentiment-very-positive/15 text-ink-900 ring-1 ring-sentiment-very-positive/40'],
    ['positive', 'bg-sentiment-positive/20 text-ink-900 ring-1 ring-sentiment-positive/50'],
    ['neutral', 'bg-sentiment-neutral/20 text-ink-900 ring-1 ring-sentiment-neutral/50'],
    ['negative', 'bg-sentiment-negative/20 text-ink-900 ring-1 ring-sentiment-negative/50'],
    ['very negative', 'bg-sentiment-very-negative/15 text-ink-900 ring-1 ring-sentiment-very-negative/40'],
  ])('returns correct tailwind for "%s"', (sentiment, expected) => {
    expect(getSentimentColor(sentiment, 'tailwind')).toBe(expected);
  });

  it('returns the neutral tailwind classes for unknown sentiment', () => {
    expect(getSentimentColor('unknown', 'tailwind')).toBe('bg-sentiment-neutral/20 text-ink-900 ring-1 ring-sentiment-neutral/50');
  });
});

describe('getSentimentIcon', () => {
  it.each([
    ['very positive', '😊'],
    ['positive', '🙂'],
    ['neutral', '😐'],
    ['negative', '🙁'],
    ['very negative', '😡'],
  ])('returns correct icon for "%s"', (sentiment, expected) => {
    expect(getSentimentIcon(sentiment)).toBe(expected);
  });

  it('returns neutral icon for unknown', () => {
    expect(getSentimentIcon('unknown')).toBe('😐');
  });
});

describe('getCategoryColor', () => {
  it('returns a categorical brand colour for known categories', () => {
    expect(getCategoryColor('health')).toBe('#009e73');
    expect(getCategoryColor('economy')).toBe('#f0e442');
    expect(getCategoryColor('technology')).toBe('#0f1926');
  });

  it('keeps conflict and politics apart without red and green', () => {
    expect(getCategoryColor('security & conflict')).not.toBe(getCategoryColor('politics'));
    expect(getCategoryColor('security & conflict')).not.toMatch(/^#(ef4444|dc2626)$/);
  });

  it('returns ink for an unknown category', () => {
    expect(getCategoryColor('unknown')).toBe('#667384');
  });
});

describe('getConfidenceColor', () => {
  it('returns green for >= 0.9', () => {
    expect(getConfidenceColor(0.95)).toBe('bg-green-100 text-green-800');
    expect(getConfidenceColor(0.9)).toBe('bg-green-100 text-green-800');
  });

  it('returns blue for >= 0.7', () => {
    expect(getConfidenceColor(0.8)).toBe('bg-blue-100 text-blue-800');
    expect(getConfidenceColor(0.7)).toBe('bg-blue-100 text-blue-800');
  });

  it('returns yellow for >= 0.5', () => {
    expect(getConfidenceColor(0.6)).toBe('bg-yellow-100 text-yellow-800');
    expect(getConfidenceColor(0.5)).toBe('bg-yellow-100 text-yellow-800');
  });

  it('returns red for < 0.5', () => {
    expect(getConfidenceColor(0.4)).toBe('bg-red-100 text-red-800');
    expect(getConfidenceColor(0.0)).toBe('bg-red-100 text-red-800');
  });
});

describe('getHealthColor', () => {
  it('returns green for >= 95', () => {
    expect(getHealthColor(95)).toBe('text-green-600');
    expect(getHealthColor(100)).toBe('text-green-600');
  });

  it('returns yellow for >= 90', () => {
    expect(getHealthColor(90)).toBe('text-signal-800');
    expect(getHealthColor(94)).toBe('text-signal-800');
  });

  it('returns red for < 90', () => {
    expect(getHealthColor(89)).toBe('text-red-600');
    expect(getHealthColor(0)).toBe('text-red-600');
  });
});

describe('getTrendColor', () => {
  it('returns green for up/rising', () => {
    expect(getTrendColor('up')).toBe('text-green-600');
    expect(getTrendColor('rising')).toBe('text-green-600');
  });

  it('returns red for down/declining', () => {
    expect(getTrendColor('down')).toBe('text-red-600');
    expect(getTrendColor('declining')).toBe('text-red-600');
  });

  it('returns gray for stable', () => {
    expect(getTrendColor('stable')).toBe('text-gray-600');
  });

  it('returns gray for unknown', () => {
    expect(getTrendColor('unknown')).toBe('text-gray-600');
  });
});

describe('getTrendIcon', () => {
  it('returns correct icons', () => {
    expect(getTrendIcon('up')).toBe('📈');
    expect(getTrendIcon('down')).toBe('📉');
    expect(getTrendIcon('stable')).toBe('➡️');
  });

  it('returns arrow for unknown', () => {
    expect(getTrendIcon('unknown')).toBe('➡️');
  });
});
