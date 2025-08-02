import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Test endpoint to simulate crawler log updates
 * This simulates what the telegram-scraper would do during job execution
 */

const sampleLogMessages = [
  "Starting Telegram crawl job",
  "Initializing Telegram client connection",
  "Connected to Telegram API successfully",
  "Loading channel list from URLs",
  "Found 5 channels to crawl",
  "Starting crawl for channel: @example_channel",
  "Collected 50 posts from @example_channel",
  "Processing batch 1/10 - analyzing content",
  "Extracted metadata from 50 posts",
  "Starting crawl for channel: @tech_news", 
  "Rate limit encountered, waiting 30 seconds...",
  "Resuming crawl operations",
  "Collected 75 posts from @tech_news",
  "Processing batch 2/10 - sentiment analysis",
  "Completed sentiment analysis for 125 posts",
  "Starting crawl for channel: @crypto_updates",
  "Collected 30 posts from @crypto_updates",
  "Processing batch 3/10 - topic modeling",
  "Identified 8 key topics in collected data",
  "Data validation completed - 155 posts processed",
  "Saving results to output format",
  "Crawl job completed successfully"
];

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const { jobId, action } = await request.json();
    
    if (!jobId) {
      return error(400, 'jobId is required');
    }

    const baseUrl = url.origin;
    let logMessage = '';
    let itemsProcessed = 0;

    switch (action) {
      case 'start':
        // Start the job
        await fetch(`${baseUrl}/api/job-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            jobId,
            message: 'Test crawler job started'
          })
        });
        
        // Simulate initial logs
        for (let i = 0; i < 3; i++) {
          await fetch(`${baseUrl}/api/job-state`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'log',
              jobId,
              logMessage: sampleLogMessages[i]
            })
          });
        }
        break;

      case 'progress':
        // Simulate progress updates with logs
        const progressStep = Math.floor(Math.random() * 3) + 1;
        const currentProgress = Math.floor(Math.random() * 200) + 50;
        
        // Add some random log messages
        for (let i = 0; i < progressStep; i++) {
          const randomIndex = Math.floor(Math.random() * sampleLogMessages.length);
          logMessage = sampleLogMessages[randomIndex];
          
          await fetch(`${baseUrl}/api/job-state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'log',
              jobId,
              logMessage: `${new Date().toISOString().slice(0, 19).replace('T', ' ')}: ${logMessage}`
            })
          });
        }
        
        // Update progress
        await fetch(`${baseUrl}/api/job-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'progress',
            jobId,
            itemsProcessed: currentProgress,
            message: `Processed ${currentProgress} items`
          })
        });
        break;

      case 'complete':
        // Add final logs
        const finalLogs = [
          "Data validation completed - 500 posts processed",
          "Saving results to output format",
          "Crawl job completed successfully"
        ];
        
        for (const log of finalLogs) {
          await fetch(`${baseUrl}/api/job-state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'log',
              jobId,
              logMessage: `${new Date().toISOString().slice(0, 19).replace('T', ' ')}: ${log}`
            })
          });
        }
        
        // Mark as completed
        await fetch(`${baseUrl}/api/job-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            jobId,
            itemsProcessed: 500,
            message: 'Test crawl completed successfully'
          })
        });
        break;

      case 'simulate':
        // Simulate a full job lifecycle
        const steps = [
          { action: 'start', delay: 0 },
          { action: 'progress', delay: 2000 },
          { action: 'progress', delay: 4000 },
          { action: 'progress', delay: 6000 },
          { action: 'progress', delay: 8000 },
          { action: 'complete', delay: 10000 }
        ];
        
        for (const step of steps) {
          setTimeout(async () => {
            await fetch(`${baseUrl}/api/test-crawler-logs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jobId,
                action: step.action
              })
            });
          }, step.delay);
        }
        break;

      default:
        return error(400, `Unknown action: ${action}`);
    }

    return json({ 
      success: true, 
      message: `Test crawler action '${action}' executed for job ${jobId}` 
    });

  } catch (err) {
    console.error('Test crawler logs error:', err);
    return error(500, 'Internal server error while simulating crawler logs');
  }
};

export const GET: RequestHandler = async () => {
  return json({
    message: 'Test Crawler Logs API',
    usage: {
      POST: {
        description: 'Simulate crawler actions',
        body: {
          jobId: 'string (required)',
          action: 'start | progress | complete | simulate'
        }
      }
    },
    availableActions: [
      'start - Initialize job and add initial logs',
      'progress - Add progress logs and update items processed',
      'complete - Add final logs and mark job as completed', 
      'simulate - Run full job lifecycle automatically'
    ]
  });
};