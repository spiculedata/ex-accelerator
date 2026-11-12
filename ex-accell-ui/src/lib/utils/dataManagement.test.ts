import { describe, expect, it } from 'vitest';
import {
  EMPTY_DATA_STATS,
  blankRadioStream,
  buildCrawlRequest,
  buildDataSources,
  computeDataStats,
  crawlTargetLabels,
  defaultCrawlerConfig,
  defaultRadioConfig,
  formatTimestamp,
  getStatusIcon,
  parseCrawlerUrls
} from './dataManagement';

const dataset = (over: Record<string, unknown> = {}) => ({ id: 1, name: 'Posts', dataset_type: 'social_media', status: 'available', record_count: '100', last_updated: '2026-01-02', ...over });

describe('buildDataSources', () => {
  it('picks an icon and colour from the kind of dataset', () => {
    const sources = buildDataSources(
      [dataset({ id: 1, source_platform: 'bluesky' }), dataset({ id: 2 }), dataset({ id: 3, dataset_type: 'radio' }), dataset({ id: 4, dataset_type: 'gdelt_events' }), dataset({ id: 5, dataset_type: 'tabular' })],
      { status: 'idle' }
    );
    expect(sources.map((s) => s.icon)).toEqual(['🦋', '📱', '📻', '🌍', '📊']);
    expect(sources.map((s) => s.color)).toEqual(['sky', 'blue', 'rose', 'amber', 'blue']);
  });

  it('calls an available dataset connected and keeps any other status', () => {
    const sources = buildDataSources([dataset(), dataset({ status: 'error' })], { status: 'idle' });
    expect(sources.map((s) => s.status)).toEqual(['connected', 'error']);
  });

  it('shows a radio dataset as recording only while WavePulse runs', () => {
    const radio = [dataset({ dataset_type: 'radio' })];
    expect(buildDataSources(radio, { status: 'running' })[0].status).toBe('recording');
    expect(buildDataSources(radio, { status: 'offline' })[0].status).toBe('idle');
    expect(buildDataSources(radio, { status: 'running' })[0].isRadio).toBe(true);
  });

  it('reads the record count as a number, 0 when it is not one', () => {
    const sources = buildDataSources([dataset({ record_count: '1200' }), dataset({ record_count: 'many' }), dataset({ record_count: undefined })], {});
    expect(sources.map((s) => s.recordsCaptured)).toEqual([1200, 0, 0]);
  });

  it('keeps the description, last update and platform', () => {
    const [source] = buildDataSources([dataset({ description: undefined, source_platform: 'telegram' })], {});
    expect(source).toMatchObject({ id: 1, name: 'Posts', description: '', lastSync: '2026-01-02', sourcePlatform: 'telegram', datasetType: 'social_media' });
  });
});

describe('computeDataStats', () => {
  it('totals the records and counts connections and running workflows', () => {
    const sources = buildDataSources([dataset({ record_count: '1000' }), dataset({ id: 2, record_count: '500', status: 'error' })], {});
    const stats = computeDataStats(sources, [dataset(), dataset()], [{ status: 'running' }, { status: 'draft' }, { status: 'running' }]);
    expect(stats).toEqual({
      totalRecordsCapture: 1500,
      activeConnections: 1,
      totalDatasets: 2,
      activeWorkflows: 2,
      totalStorageUsed: '1.5K records',
      lastCaptureUpdate: '2026-01-02'
    });
  });

  it('has a dash for the last update when there are no sources', () => {
    expect(computeDataStats([], [], [])).toMatchObject({ totalRecordsCapture: 0, totalStorageUsed: '0 records', lastCaptureUpdate: '—' });
    expect(EMPTY_DATA_STATS.totalStorageUsed).toBe('—');
  });
});

describe('status display', () => {
  it('gives each known status an icon and others a dot', () => {
    expect(getStatusIcon('running')).toBe('🔄');
    expect(getStatusIcon('draft')).toBe('📝');
    expect(getStatusIcon('mystery')).toBe('●');
  });

  it('formats a timestamp in the local style', () => {
    expect(formatTimestamp('2026-01-02T10:00:00Z')).toBe(new Date('2026-01-02T10:00:00Z').toLocaleString());
  });
});

describe('radio defaults', () => {
  it('starts with one all-day station and returns a fresh copy each time', () => {
    const first = defaultRadioConfig();
    expect(first.radioStreams).toHaveLength(1);
    expect(first.radioStreams[0]).toMatchObject({ radioName: 'WGSV', state: 'VA', timeSlots: [{ start: '00:00', end: '23:59' }] });
    first.radioStreams[0].timeSlots[0].start = '05:00';
    expect(defaultRadioConfig().radioStreams[0].timeSlots[0].start).toBe('00:00');
  });

  it('makes blank stations that do not share their time slots', () => {
    const a = blankRadioStream();
    const b = blankRadioStream();
    a.timeSlots[0].end = '12:00';
    expect(b.timeSlots[0].end).toBe('23:59');
    expect(a).toMatchObject({ url: '', radioName: '', state: '' });
  });
});

describe('crawler', () => {
  it('splits targets on commas and line breaks and drops blanks', () => {
    expect(parseCrawlerUrls(' a ,b\n\n c,, ')).toEqual(['a', 'b', 'c']);
    expect(parseCrawlerUrls('')).toEqual([]);
    expect(parseCrawlerUrls(' \n , ')).toEqual([]);
  });

  it('builds the request from the form, making up an id when none was typed', () => {
    const config = { ...defaultCrawlerConfig(), platform: 'youtube', urls: 'ignored' };
    const request = buildCrawlRequest(config, ['u1'], 1234);
    expect(request).toMatchObject({ platform: 'youtube', urls: ['u1'], crawlId: 'youtube-1234', maxPosts: 1000, timeAgo: '30d', skipMedia: true });
    expect(buildCrawlRequest({ ...config, crawlId: 'mine' }, ['u1'], 1234).crawlId).toBe('mine');
  });

  it('labels the target field for each platform', () => {
    expect(crawlTargetLabels('bluesky').label).toBe('Handles or DIDs');
    expect(crawlTargetLabels('youtube').label).toBe('Channel URLs');
    expect(crawlTargetLabels('telegram')).toEqual({ label: 'Channel Names', hint: 'e.g. @channelname' });
  });
});
