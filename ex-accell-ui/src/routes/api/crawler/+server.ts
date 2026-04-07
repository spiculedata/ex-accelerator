// Social Crawler Proxy API
// Schedules crawl jobs via Dapr Jobs API on the crawler service

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';
const DAPR_URL = `http://localhost:${DAPR_HTTP_PORT}`;

/**
 * POST /api/crawler — schedule a crawl job
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { platform, urls, crawlId, maxPosts, maxDepth, timeAgo, skipMedia, samplingMethod, youtubeApiKey } = body;

    if (!platform || !urls || urls.length === 0) {
      return json({ error: 'platform and urls are required' }, { status: 400 });
    }

    // Build job name
    const jobName = crawlId || `${platform}-${Date.now()}`;

    // Build crawl config
    const jobData = {
      platform,
      urls: Array.isArray(urls) ? urls : [urls],
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

    if (!response.ok) {
      // Fallback: try Dapr Jobs API
      const jobResponse = await fetch(`${DAPR_URL}/v1.0-alpha1/jobs/${jobName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueTime: '5s',
          data: { value: JSON.stringify(jobData) }
        })
      });

      if (!jobResponse.ok) {
        const errText = await jobResponse.text();
        return json({ error: `Failed to schedule crawl: ${errText}` }, { status: 500 });
      }

      return json({ success: true, jobName, method: 'dapr-jobs', data: jobData });
    }

    const result = await response.json().catch(() => ({}));
    return json({ success: true, jobName, method: 'service-invocation', result });

  } catch (err: any) {
    console.error('Crawler API error:', err);
    return json({ error: `Crawler service unavailable: ${err.message}` }, { status: 500 });
  }
};

/**
 * GET /api/crawler — get crawler status
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    // Try to invoke crawler health check
    const response = await fetch(`${DAPR_URL}/v1.0/invoke/crawler/method/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      return json({ success: true, status: 'running', ...result });
    }

    return json({ success: true, status: 'unavailable' });
  } catch {
    return json({ success: true, status: 'offline' });
  }
};
