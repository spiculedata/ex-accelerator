import { describe, it, expect } from 'vitest';
import {
  buildCrawlerJobName,
  buildCrawlerJobRequest,
  buildRunNowPayload,
  computeDueTime,
  pickServerErrorMessage
} from './jobRequests';
import { createDefaultCrawlerConfig, createDefaultScheduleConfig, crawlerConfigFromJobData } from './configDefaults';

const schedule = (overrides: Record<string, string>) => ({ ...createDefaultScheduleConfig(), ...overrides });

describe('computeDueTime', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0);

  it('waits 10 seconds for immediate jobs', () => {
    expect(computeDueTime(schedule({ schedulingMode: 'immediate' }), now)).toBe('10s');
  });

  it('converts delayed values to seconds', () => {
    expect(computeDueTime(schedule({ schedulingMode: 'delayed', dueTime: '45s' }), now)).toBe('45s');
    expect(computeDueTime(schedule({ schedulingMode: 'delayed', dueTime: '5m' }), now)).toBe('300s');
    expect(computeDueTime(schedule({ schedulingMode: 'delayed', dueTime: '2h' }), now)).toBe('7200s');
    expect(computeDueTime(schedule({ schedulingMode: 'delayed', dueTime: 'soon' }), now)).toBe('10s');
  });

  it('schedules later today, or tomorrow once the time has passed', () => {
    expect(computeDueTime(schedule({ schedulingMode: 'scheduled', time: '13:00' }), now)).toBe('3600s');
    expect(computeDueTime(schedule({ schedulingMode: 'scheduled', time: '11:00' }), now)).toBe('82800s');
  });

  it('never goes below 10 seconds', () => {
    expect(computeDueTime(schedule({ schedulingMode: 'scheduled', time: '12:00' }), new Date(2026, 0, 1, 11, 59, 55))).toBe('10s');
  });
});

describe('buildCrawlerJobName', () => {
  it('replaces unsafe characters and appends the timestamp', () => {
    const name = buildCrawlerJobName('  My Job! #1 ', new Date('2026-01-02T03:04:05.678Z'));
    expect(name).toBe('My-Job---1-2026-01-02T03-04-05-678Z');
  });
});

describe('buildCrawlerJobRequest', () => {
  const config = {
    ...createDefaultCrawlerConfig(),
    name: 'n',
    urls: ['https://t.me/channel_name', '  '],
    crawlId: 'cid',
    maxDepth: 3,
    maxPosts: 50,
    skipMediaDownload: true,
    youtubeApiKey: 'key'
  };

  it('builds a telegram request and drops unset limits', () => {
    const request = buildCrawlerJobRequest({ ...config, maxDepth: -1, maxPosts: -1, crawlId: '' }, 'job', '10s');
    expect(request).toEqual({
      name: 'job',
      dueTime: '10s',
      data: {
        droid: 'my-scheduled-job',
        task: 'crawl telegram channels',
        urls: ['https://t.me/channel_name'],
        platform: 'telegram',
        crawlId: undefined,
        maxDepth: undefined,
        concurrency: 1,
        maxPosts: undefined,
        skipMedia: true,
        timeAgo: '1m',
        minPostDate: undefined
      }
    });
  });

  it('keeps positive limits', () => {
    const { data } = buildCrawlerJobRequest(config, 'job', '10s');
    expect(data).toMatchObject({ crawlId: 'cid', maxDepth: 3, maxPosts: 50 });
  });

  it('adds YouTube settings only for YouTube with an API key', () => {
    const youtube = buildCrawlerJobRequest({ ...config, platform: 'youtube' }, 'job', '10s').data;
    expect(youtube).toMatchObject({ youtubeApiKey: 'key', samplingMethod: 'channel', minChannelVideos: 10 });
    expect(buildCrawlerJobRequest({ ...config, platform: 'youtube', youtubeApiKey: '' }, 'j', '1s').data).not.toHaveProperty('youtubeApiKey');
    expect(buildCrawlerJobRequest(config, 'job', '10s').data).not.toHaveProperty('youtubeApiKey');
  });
});

describe('buildRunNowPayload', () => {
  it('uses defaults when the job has no data', () => {
    const payload = buildRunNowPayload({ id: 'j1', name: 'job', status: 'scheduled' }, 'j1', 1000);
    expect(payload).toMatchObject({
      name: 'run-now-job-1000',
      dueTime: '1s',
      data: {
        droid: 'job',
        task: 'crawl telegram channels',
        urls: [],
        platform: 'telegram',
        crawlId: 'crawl-1000',
        maxPosts: 100,
        maxDepth: 2,
        concurrency: 1,
        timeAgo: '7d',
        skipMedia: true
      }
    });
  });

  it('uses the stored job data and honours skipMedia false', () => {
    const job = {
      id: 'j1',
      name: 'job',
      status: 'scheduled',
      platform: 'youtube',
      jobData: { droid: 'd', urls: ['u'], crawlId: 'c', maxPosts: 5, timeAgo: '1d', skipMedia: false }
    };
    expect(buildRunNowPayload(job, 'j1', 1).data).toMatchObject({
      droid: 'd',
      task: 'crawl youtube channels',
      platform: 'youtube',
      urls: ['u'],
      crawlId: 'c',
      maxPosts: 5,
      timeAgo: '1d',
      skipMedia: false
    });
  });
});

describe('pickServerErrorMessage', () => {
  it('reads the known error shapes in priority order', () => {
    expect(pickServerErrorMessage('plain')).toBe('plain');
    expect(pickServerErrorMessage({ error: 'e', message: 'm' })).toBe('e');
    expect(pickServerErrorMessage({ message: 'm' })).toBe('m');
    expect(pickServerErrorMessage({ error: { message: 'nested' } })).toBe('nested');
    expect(pickServerErrorMessage({ body: { message: 'body' } })).toBe('body');
    expect(pickServerErrorMessage({ details: 'd' })).toBe('d');
  });

  it('returns null for an unknown shape and throws for a null body', () => {
    expect(pickServerErrorMessage({ other: 1 })).toBeNull();
    expect(() => pickServerErrorMessage(null)).toThrow(TypeError);
  });
});

describe('config defaults', () => {
  it('returns independent copies each call', () => {
    const a = createDefaultCrawlerConfig();
    a.urls.push('x');
    expect(createDefaultCrawlerConfig().urls).toEqual([]);
  });

  it('rebuilds the form from saved job data with fallbacks', () => {
    const empty = crawlerConfigFromJobData('n', {});
    expect(empty).toEqual({ ...createDefaultCrawlerConfig(), name: 'n' });
    const saved = crawlerConfigFromJobData('n', { skipMedia: true, urls: ['u'], maxPosts: 7, concurrency: 0 });
    expect(saved).toMatchObject({ skipMediaDownload: true, urls: ['u'], maxPosts: 7, concurrency: 1 });
  });
});
