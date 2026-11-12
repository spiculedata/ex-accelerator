// Social Crawler Proxy API
// Schedules crawl jobs via Dapr Jobs API on the crawler service

import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';

const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';
const DAPR_URL = `http://localhost:${DAPR_HTTP_PORT}`;
const MAX_CRAWL_BODY_BYTES = 64 * 1024;
const MAX_URLS = 500;

/**
 * POST /api/crawler — schedule a crawl job
 */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = await readJsonObject(request, MAX_CRAWL_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { platform, urls, crawlId, maxPosts, maxDepth, timeAgo, skipMedia, samplingMethod, youtubeApiKey } = parsed.body;

  const urlList = Array.isArray(urls) ? urls : urls ? [urls] : [];
  if (typeof platform !== 'string' || !platform || urlList.length === 0) return apiFail('platform and urls are required', 400);
  if (urlList.length > MAX_URLS || urlList.some((url) => typeof url !== 'string')) {
    return apiFail(`urls must be up to ${MAX_URLS} text values`, 400);
  }

  try {
    const jobName = (typeof crawlId === 'string' && crawlId) || `${platform}-${Date.now()}`;
    const jobData = {
      platform,
      urls: urlList,
      crawlId: jobName,
      maxPosts: maxPosts || 1000,
      maxDepth: maxDepth || 1,
      timeAgo: timeAgo || '30d',
      skipMedia: skipMedia !== false,
      samplingMethod: samplingMethod || 'channel',
      ...(youtubeApiKey ? { youtubeApiKey } : {})
    };

    // Schedule via Dapr service invocation to crawler
    const response = await fetch(`${DAPR_URL}/v1.0/invoke/crawler/method/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });

    if (response.ok) {
      const method = 'service-invocation';
      return apiOk({ jobName, method }, { jobName, method });
    }

    // Fallback: try Dapr Jobs API
    const jobResponse = await fetch(`${DAPR_URL}/v1.0-alpha1/jobs/${encodeURIComponent(jobName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueTime: '5s', data: { value: JSON.stringify(jobData) } })
    });
    if (!jobResponse.ok) {
      return apiServerError('POST /api/crawler', new Error(`Dapr jobs API answered ${jobResponse.status}: ${await jobResponse.text()}`), 'Failed to schedule crawl');
    }

    const method = 'dapr-jobs';
    return apiOk({ jobName, method }, { jobName, method });
  } catch (err) {
    return apiServerError('POST /api/crawler', err, 'Crawler service unavailable');
  }
};

/**
 * GET /api/crawler — get crawler status. An unreachable crawler is a status, not an error.
 */
export const GET: RequestHandler = async () => {
  try {
    const response = await fetch(`${DAPR_URL}/v1.0/invoke/crawler/method/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      return apiOk({ status: 'running' }, { status: 'running' });
    }
    return apiOk({ status: 'unavailable' }, { status: 'unavailable' });
  } catch {
    return apiOk({ status: 'offline' }, { status: 'offline' });
  }
};
