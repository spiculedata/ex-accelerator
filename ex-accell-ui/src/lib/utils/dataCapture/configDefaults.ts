import type { CrawlerConfig, PrincetonSmartConfig, ScheduleConfig, WavePulseConfig } from './types';

/** A fresh crawler config; every call returns new arrays so callers can mutate safely. */
export function createDefaultCrawlerConfig(): CrawlerConfig {
  return {
    // Basic settings
    name: '',
    crawlId: '',

    // Global flags
    logLevel: 'debug',
    concurrency: 1,
    timeout: 30,
    userAgent: 'Mozilla/5.0 Crawler',
    outputFormat: 'json',

    // Platform and URLs
    platform: 'telegram',
    urls: [],
    urlFileURL: '',

    // Date and time filters
    minPostDate: '',
    timeAgo: '1m',
    dateBetween: '',
    sampleSize: 0,

    // Limits and constraints
    maxComments: -1,
    maxDepth: -1,
    maxPosts: -1,
    maxPages: 108000,
    minUsers: 100,
    minChannelVideos: 10,

    // Platform-specific settings
    tdlibDatabaseURLs: [],
    tdlibVerbosity: 1,
    skipMediaDownload: false,
    youtubeApiKey: '',
    samplingMethod: 'channel'
  };
}

/**
 * Rebuild the crawler form from a saved job's data. Falsy values fall back to the form
 * defaults (so a saved 0 becomes the default), matching how editing has always behaved.
 */
export function crawlerConfigFromJobData(name: string, jobData: Record<string, any>): CrawlerConfig {
  return {
    name,
    crawlId: jobData.crawlId || '',
    logLevel: jobData.logLevel || 'debug',
    concurrency: jobData.concurrency || 1,
    timeout: jobData.timeout || 30,
    userAgent: jobData.userAgent || 'Mozilla/5.0 Crawler',
    outputFormat: jobData.outputFormat || 'json',
    platform: jobData.platform || 'telegram',
    urls: jobData.urls || [],
    urlFileURL: jobData.urlFileURL || '',
    minPostDate: jobData.minPostDate || '',
    timeAgo: jobData.timeAgo || '1m',
    dateBetween: jobData.dateBetween || '',
    sampleSize: jobData.sampleSize || 0,
    maxComments: jobData.maxComments || -1,
    maxDepth: jobData.maxDepth || -1,
    maxPosts: jobData.maxPosts || -1,
    maxPages: jobData.maxPages || 108000,
    minUsers: jobData.minUsers || 100,
    minChannelVideos: jobData.minChannelVideos || 10,
    tdlibDatabaseURLs: jobData.tdlibDatabaseURLs || [],
    tdlibVerbosity: jobData.tdlibVerbosity || 1,
    skipMediaDownload: jobData.skipMedia || false,
    youtubeApiKey: jobData.youtubeApiKey || '',
    samplingMethod: jobData.samplingMethod || 'channel'
  };
}

export function createDefaultScheduleConfig(): ScheduleConfig {
  return {
    frequency: 'daily',
    time: '09:00',
    timezone: 'UTC',
    enabled: false,
    dueTime: 'now',
    schedulingMode: 'immediate' // immediate, delayed, scheduled
  };
}

export function createDefaultPrincetonSmartConfig(): PrincetonSmartConfig {
  return {
    apiEndpoint: 'https://smart.princeton.edu/api/v1',
    apiKey: '',
    datasetId: '',
    query: '',
    dateRange: {
      start: '',
      end: ''
    },
    filters: {
      location: '',
      language: 'en',
      contentType: 'all', // all, text, media, links
      sentiment: 'all', // all, positive, negative, neutral
      minEngagement: 0
    },
    outputFormat: 'json', // json, csv, xml
    maxRecords: 10000,
    includeMetadata: true,
    includeAnalytics: false
  };
}

export function createDefaultWavePulseConfig(): WavePulseConfig {
  return {
    // API Configuration
    huggingFaceToken: '',
    geminiApiKey: '',

    // Component Control
    enableRecording: true,
    enableTranscription: true,
    enableClassification: true,
    enableDiarization: false,

    // Transcription Settings
    whisperModel: 'large-v3',
    batchSize: 16,
    computeType: 'float16',
    device: 'cuda', // cuda or cpu

    // Radio Stream Schedule
    radioStreams: [
      {
        url: 'https://example.com/stream',
        radioName: 'WXYZ',
        state: 'NY',
        timeSlots: [
          { start: '08:00', end: '14:00' },
          { start: '17:00', end: '22:00' }
        ]
      }
    ],

    // Recording Settings
    segmentDuration: 1800, // 30 minutes in seconds
    retries: 3,
    waitTime: 60,

    // Directory Configuration
    assetsDir: 'assets',
    dataDir: 'data',
    recordingsDir: 'recordings',
    transcriptsDir: 'transcripts',

    // Application Settings
    timezone: 'US/Eastern',
    shutdownTime: '03:00',
    restartTime: '03:10',

    // Analytics Settings
    sentimentAnalysis: false,
    narrativeTracking: false,

    // Backup Settings
    enableBackup: false,
    ftpServer: '',
    ftpUsername: '',
    ftpPassword: ''
  };
}
