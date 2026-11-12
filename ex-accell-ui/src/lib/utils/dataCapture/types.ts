export type CrawlerStep = 'basic' | 'platform' | 'advanced' | 'review';

export interface CrawlerConfig {
  name: string;
  crawlId: string;
  logLevel: string;
  concurrency: number;
  timeout: number;
  userAgent: string;
  outputFormat: string;
  platform: string;
  urls: string[];
  urlFileURL: string;
  minPostDate: string;
  timeAgo: string;
  dateBetween: string;
  sampleSize: number;
  maxComments: number;
  maxDepth: number;
  maxPosts: number;
  maxPages: number;
  minUsers: number;
  minChannelVideos: number;
  tdlibDatabaseURLs: string[];
  tdlibVerbosity: number;
  skipMediaDownload: boolean;
  youtubeApiKey: string;
  samplingMethod: string;
}

export interface ScheduleConfig {
  frequency: string;
  time: string;
  timezone: string;
  enabled: boolean;
  dueTime: string;
  schedulingMode: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface RadioStream {
  url: string;
  radioName: string;
  state: string;
  timeSlots: TimeSlot[];
}

export interface WavePulseConfig {
  huggingFaceToken: string;
  geminiApiKey: string;
  enableRecording: boolean;
  enableTranscription: boolean;
  enableClassification: boolean;
  enableDiarization: boolean;
  whisperModel: string;
  batchSize: number;
  computeType: string;
  device: string;
  radioStreams: RadioStream[];
  segmentDuration: number;
  retries: number;
  waitTime: number;
  assetsDir: string;
  dataDir: string;
  recordingsDir: string;
  transcriptsDir: string;
  timezone: string;
  shutdownTime: string;
  restartTime: string;
  sentimentAnalysis: boolean;
  narrativeTracking: boolean;
  enableBackup: boolean;
  ftpServer: string;
  ftpUsername: string;
  ftpPassword: string;
}

export interface PrincetonSmartConfig {
  apiEndpoint: string;
  apiKey: string;
  datasetId: string;
  query: string;
  dateRange: { start: string; end: string };
  filters: {
    location: string;
    language: string;
    contentType: string;
    sentiment: string;
    minEngagement: number;
  };
  outputFormat: string;
  maxRecords: number;
  includeMetadata: boolean;
  includeAnalytics: boolean;
}

/** A job row as the page shows it: a crawl job from the state store or a WavePulse schedule. */
export interface UiJob {
  id: string;
  name: string;
  status: string;
  [key: string]: any;
}

export interface StepValidation {
  isValid: boolean;
  errors: string[];
}
