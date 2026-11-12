import type { JobScheduleRequest } from '$lib/services/jobSchedulerService';
import type { CrawlerConfig, ScheduleConfig, UiJob } from './types';

const IMMEDIATE_DUE_TIME = '10s';
const MIN_DUE_SECONDS = 10;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/**
 * Dapr due time for a new crawl job. `now` is injectable so the result can be tested.
 * Immediate jobs wait 10 seconds; delayed jobs convert s/m/h values to seconds; scheduled
 * jobs run at the chosen time today or tomorrow (never sooner than 10 seconds away).
 */
export function computeDueTime(schedule: ScheduleConfig, now: Date = new Date()): string {
  if (schedule.schedulingMode === 'delayed') {
    const timeValue = schedule.dueTime;
    if (timeValue.endsWith('s')) return timeValue;
    if (timeValue.endsWith('m')) return `${parseInt(timeValue.slice(0, -1)) * SECONDS_PER_MINUTE}s`;
    if (timeValue.endsWith('h')) return `${parseInt(timeValue.slice(0, -1)) * SECONDS_PER_HOUR}s`;
    return IMMEDIATE_DUE_TIME;
  }

  if (schedule.schedulingMode === 'scheduled') {
    const scheduledDate = new Date(now.getTime());
    const [hours, minutes] = schedule.time.split(':');
    scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (scheduledDate.getTime() <= now.getTime()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const secondsFromNow = Math.floor((scheduledDate.getTime() - now.getTime()) / 1000);
    return `${Math.max(MIN_DUE_SECONDS, secondsFromNow)}s`;
  }

  return IMMEDIATE_DUE_TIME;
}

/** Unique Dapr job name from the user's name plus a timestamp. */
export function buildCrawlerJobName(name: string, now: Date = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `${name.trim().replace(/[^a-zA-Z0-9-]/g, '-')}-${timestamp}`;
}

/** The job schedule request for the crawler form. */
export function buildCrawlerJobRequest(config: CrawlerConfig, jobName: string, dueTime: string): JobScheduleRequest {
  const jobRequest: JobScheduleRequest = {
    name: jobName,
    dueTime: dueTime,
    data: {
      droid: 'my-scheduled-job', // Must match registered handler in telegram-scraper
      task: `crawl ${config.platform} channels`,
      urls: config.urls.filter(url => url.trim()),
      platform: config.platform as 'telegram' | 'youtube',
      crawlId: config.crawlId || undefined,
      maxDepth: config.maxDepth > 0 ? config.maxDepth : undefined,
      concurrency: config.concurrency,
      maxPosts: config.maxPosts > 0 ? config.maxPosts : undefined,
      skipMedia: config.skipMediaDownload,
      timeAgo: config.timeAgo || undefined,
      minPostDate: config.minPostDate || undefined
    }
  };

  if (config.platform === 'youtube' && config.youtubeApiKey) {
    jobRequest.data.youtubeApiKey = config.youtubeApiKey;
    jobRequest.data.samplingMethod = config.samplingMethod;
    jobRequest.data.minChannelVideos = config.minChannelVideos;
  }

  return jobRequest;
}

/** Payload for the "Run Now" action on an existing job; matches the telegram-scraper README. */
export function buildRunNowPayload(job: UiJob, jobId: string, nowMs: number = Date.now()) {
  return {
    name: `run-now-${job.name || jobId}-${nowMs}`,
    dueTime: '1s', // Execute immediately
    data: {
      droid: job.jobData?.droid || job.name || `crawl-job-${nowMs}`,
      task: job.platform === 'youtube' ? 'crawl youtube channels' : 'crawl telegram channels',
      urls: job.jobData?.urls || [],
      platform: job.platform || 'telegram',
      crawlId: job.jobData?.crawlId || `crawl-${nowMs}`,
      // Core parameters
      maxPosts: job.jobData?.maxPosts || 100,
      maxDepth: job.jobData?.maxDepth || 2,
      concurrency: job.jobData?.concurrency || 1,
      // YouTube specific
      youtubeApiKey: job.jobData?.youtubeApiKey,
      samplingMethod: job.jobData?.samplingMethod,
      minChannelVideos: job.jobData?.minChannelVideos,
      sampleSize: job.jobData?.sampleSize,
      // Date filtering
      minPostDate: job.jobData?.minPostDate,
      dateBetweenMin: job.jobData?.dateBetweenMin,
      dateBetweenMax: job.jobData?.dateBetweenMax,
      timeAgo: job.jobData?.timeAgo || '7d',
      // Media options
      skipMedia: job.jobData?.skipMedia !== false, // Default to true unless explicitly false
      // Advanced options
      maxPages: job.jobData?.maxPages,
      urlFile: job.jobData?.urlFile,
      tdlibDatabaseUrls: job.jobData?.tdlibDatabaseUrls
    }
  };
}

/**
 * Pull a readable message out of a server error body. Returns null when no known field
 * holds one. Like the original inline code it throws on a null body, which callers treat as
 * "not JSON" and fall back to the text response.
 */
export function pickServerErrorMessage(errorData: any): string | null {
  if (typeof errorData === 'string') return errorData;
  if (typeof errorData.error === 'string') return errorData.error;
  if (errorData.message) return errorData.message;
  if (errorData.error?.message) return errorData.error.message;
  if (errorData.body?.message) return errorData.body.message;
  if (errorData.details) return errorData.details;
  return null;
}

/**
 * Read a failed "Run Now" response into a message: JSON error shapes first, then the plain
 * text body, then the status line.
 */
export async function readRunError(response: Response): Promise<string> {
  let message = `Failed to submit job: ${response.status}`;

  try {
    const errorData = await response.json();
    const picked = pickServerErrorMessage(errorData);
    if (picked) {
      message = picked;
    }
  } catch {
    // Not JSON (or an empty body): try the text of a cloned response
    try {
      const errorText = await response.clone().text();
      if (errorText.trim()) {
        message = errorText;
      }
    } catch {
      message = `Failed to submit job: ${response.status} ${response.statusText}`;
    }
  }

  return message;
}

/** Lines of an uploaded URL list that look like links and are not already in `existing`. */
export function parseNewUrls(content: string, existing: string[]): string[] {
  return content
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0 && url.startsWith('http'))
    .filter(url => !existing.includes(url));
}
