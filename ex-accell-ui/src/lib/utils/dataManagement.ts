import { formatNumber } from '$lib/utils/formatUtils';

// Dataset and workflow rows come from the API in a few shapes, so pages read them loosely
export type DataRow = Record<string, any>;

export interface RadioTimeSlot {
  start: string;
  end: string;
}

export interface RadioStream {
  url: string;
  radioName: string;
  state: string;
  timeSlots: RadioTimeSlot[];
}

export interface RadioConfig {
  radioStreams: RadioStream[];
  device: string;
  computeType: string;
  whisperModel: string;
  enableTranscription: boolean;
  enableClassification: boolean;
  huggingFaceToken: string;
  geminiApiKey: string;
}

export interface CrawlerConfig {
  platform: string;
  urls: string;
  crawlId: string;
  maxPosts: number;
  maxDepth: number;
  timeAgo: string;
  skipMedia: boolean;
  samplingMethod: string;
  youtubeApiKey: string;
}

/** What the WavePulse radio service reports about itself. */
export interface WavePulseStatus {
  status?: string;
  active_streams?: unknown[];
  recordings_count?: number;
  transcripts_count?: number;
}

export interface DataSource {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: string;
  lastSync: unknown;
  recordsCaptured: number;
  datasetType: string;
  sourcePlatform: string;
  isRadio: boolean;
}

export interface DataStats {
  totalRecordsCapture: number;
  activeConnections: number;
  totalDatasets: number;
  activeWorkflows: number;
  totalStorageUsed: string;
  lastCaptureUpdate: unknown;
}

export const EMPTY_DATA_STATS: DataStats = {
  totalRecordsCapture: 0,
  activeConnections: 0,
  totalDatasets: 0,
  activeWorkflows: 0,
  totalStorageUsed: '—',
  lastCaptureUpdate: '—'
};

const ALL_DAY: RadioTimeSlot = { start: '00:00', end: '23:59' };

/** A station with nothing filled in, recording all day. */
export function blankRadioStream(): RadioStream {
  return { url: '', radioName: '', state: '', timeSlots: [{ ...ALL_DAY }] };
}

export function defaultRadioConfig(): RadioConfig {
  return {
    radioStreams: [
      { url: 'https://ice42.securenetsystems.net/WGSV', radioName: 'WGSV', state: 'VA', timeSlots: [{ ...ALL_DAY }] }
    ],
    device: 'cpu',
    computeType: 'float32',
    whisperModel: 'large-v3',
    enableTranscription: true,
    enableClassification: false,
    huggingFaceToken: '',
    geminiApiKey: ''
  };
}

export function defaultCrawlerConfig(): CrawlerConfig {
  return {
    platform: 'bluesky',
    urls: '',
    crawlId: '',
    maxPosts: 1000,
    maxDepth: 1,
    timeAgo: '30d',
    skipMedia: true,
    samplingMethod: 'channel',
    youtubeApiKey: ''
  };
}

/** Turns dataset rows into the rows of the Data Sources table. A radio dataset is recording while WavePulse runs. */
export function buildDataSources(datasets: DataRow[], wavePulseStatus: WavePulseStatus): DataSource[] {
  return datasets.map((ds) => {
    const isRadio = ds.dataset_type === 'radio';
    const isGdelt = ds.dataset_type?.startsWith('gdelt');
    return {
      id: ds.id,
      name: ds.name,
      description: ds.description || '',
      icon: isRadio ? '📻' : isGdelt ? '🌍' : ds.source_platform === 'bluesky' ? '🦋' : ds.dataset_type === 'social_media' ? '📱' : '📊',
      color: isRadio ? 'rose' : isGdelt ? 'amber' : ds.source_platform === 'bluesky' ? 'sky' : 'blue',
      status: isRadio ? (wavePulseStatus.status === 'running' ? 'recording' : 'idle') : (ds.status === 'available' ? 'connected' : ds.status),
      lastSync: ds.last_updated,
      recordsCaptured: parseInt(ds.record_count) || 0,
      datasetType: ds.dataset_type,
      sourcePlatform: ds.source_platform,
      isRadio
    };
  });
}

export function computeDataStats(dataSources: DataSource[], datasets: DataRow[], workflows: DataRow[]): DataStats {
  const totalRecords = dataSources.reduce((sum, s) => sum + s.recordsCaptured, 0);
  return {
    totalRecordsCapture: totalRecords,
    activeConnections: dataSources.filter((s) => s.status === 'connected').length,
    totalDatasets: datasets.length,
    activeWorkflows: workflows.filter((w) => w.status === 'running').length,
    totalStorageUsed: formatNumber(totalRecords) + ' records',
    lastCaptureUpdate: dataSources[0]?.lastSync || '—'
  };
}

const STATUS_ICONS: Record<string, string> = {
  connected: '🟢',
  paused: '🟡',
  disconnected: '⚫',
  error: '🔴',
  ready: '✅',
  processing: '⏳',
  running: '🔄',
  completed: '🎉',
  draft: '📝'
};

export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] || '●';
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/** The handles, channels or URLs in the crawl form, split on commas and line breaks. */
export function parseCrawlerUrls(text: string): string[] {
  return text.split(/[,\n]/).map((u) => u.trim()).filter(Boolean);
}

export type CrawlRequest = Omit<CrawlerConfig, 'urls'> & { urls: string[] };

/** The request body for the crawler: the form as it is, the parsed urls, and an id made up when none was typed. */
export function buildCrawlRequest(config: CrawlerConfig, urls: string[], nowMs: number = Date.now()): CrawlRequest {
  return {
    ...config,
    urls,
    crawlId: config.crawlId || `${config.platform}-${nowMs}`
  };
}

/** The label and hint under the crawl target field depend on the platform. */
export function crawlTargetLabels(platform: string): { label: string; hint: string } {
  if (platform === 'bluesky') return { label: 'Handles or DIDs', hint: 'e.g. user.bsky.social or "firehose" for full network' };
  if (platform === 'youtube') return { label: 'Channel URLs', hint: 'e.g. UCxxxxxxx or channel URLs' };
  return { label: 'Channel Names', hint: 'e.g. @channelname' };
}
