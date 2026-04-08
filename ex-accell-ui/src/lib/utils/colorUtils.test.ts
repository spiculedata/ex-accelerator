import {
  getStatusColor, getStatusIcon,
  getSentimentColor, getSentimentIcon,
  getCategoryColor,
  getConfidenceColor, getHealthColor,
  getTrendColor, getTrendIcon
} from './colorUtils';

describe('getStatusColor', () => {
  it.each([
    ['active', 'bg-blue-100 text-blue-800'],
    ['running', 'bg-blue-100 text-blue-800'],
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
    ['info', 'bg-blue-100 text-blue-800'],
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
  it.each([
    ['very positive', '#06d6a0'],
    ['positive', '#26d0ce'],
    ['neutral', '#8b5cf6'],
    ['negative', '#ff6b9d'],
    ['very negative', '#f72585'],
  ])('returns correct hex for "%s"', (sentiment, expected) => {
    expect(getSentimentColor(sentiment)).toBe(expected);
  });

  it('returns default hex for unknown sentiment', () => {
    expect(getSentimentColor('unknown')).toBe('#8b5cf6');
  });

  it.each([
    ['very positive', 'bg-green-100 text-green-800'],
    ['positive', 'bg-emerald-100 text-emerald-800'],
    ['neutral', 'bg-purple-100 text-purple-800'],
    ['negative', 'bg-orange-100 text-orange-800'],
    ['very negative', 'bg-red-100 text-red-800'],
  ])('returns correct tailwind for "%s"', (sentiment, expected) => {
    expect(getSentimentColor(sentiment, 'tailwind')).toBe(expected);
  });

  it('returns default tailwind for unknown sentiment', () => {
    expect(getSentimentColor('unknown', 'tailwind')).toBe('bg-gray-100 text-gray-800');
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
  it('returns correct color for known categories', () => {
    expect(getCategoryColor('health')).toBe('#10b981');
    expect(getCategoryColor('economy')).toBe('#8b5cf6');
    expect(getCategoryColor('technology')).toBe('#3b82f6');
  });

  it('returns default gray for unknown category', () => {
    expect(getCategoryColor('unknown')).toBe('#6b7280');
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
    expect(getHealthColor(90)).toBe('text-yellow-600');
    expect(getHealthColor(94)).toBe('text-yellow-600');
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
