import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobStateStore } from '$lib/services/jobStateStore.js';
import { spawn } from 'child_process';

/**
 * Log monitoring endpoint that can parse live console output from dapr run
 * This monitors the console output and extracts job progress information
 */

interface LogParseResult {
  jobId?: string;
  action?: 'start' | 'progress' | 'complete' | 'error';
  message?: string;
  itemsProcessed?: number;
}

// Parse console logs to extract job information
function parseLogLine(line: string): LogParseResult | null {
  const result: LogParseResult = {};
  
  // Look for job-related patterns in the console output
  const patterns = [
    // Job event received
    /Job event received! Raw data: (.+)/i,
    // Task patterns
    /task\s*([^=\s]+)/i,
    // Platform patterns
    /platform\s*([^=\s]+)/i,
    // URL patterns
    /url\d*\s*([^=\s]+)/i,
    // Progress indicators
    /processed\s+(\d+)/i,
    /collected\s+(\d+)/i,
    /completed/i,
    /failed|error/i
  ];
  
  // Extract basic info
  if (line.includes('Job event received')) {
    result.action = 'start';
    result.message = 'Job execution started based on console output';
  }
  
  if (line.includes('task') && line.includes('crawl')) {
    result.action = 'progress';
    result.message = 'Crawl task detected in progress';
  }
  
  if (line.includes('completed') || line.includes('finished')) {
    result.action = 'complete';
    result.message = 'Job completion detected from console';
  }
  
  if (line.includes('error') || line.includes('failed')) {
    result.action = 'error';
    result.message = 'Error detected in job execution';
  }
  
  // Extract numbers that might be progress indicators
  const numberMatch = line.match(/(\d+)/);
  if (numberMatch && result.action === 'progress') {
    result.itemsProcessed = parseInt(numberMatch[1]);
  }
  
  return Object.keys(result).length > 0 ? result : null;
}

// Monitor running jobs and try to extract progress from logs
async function updateJobFromLogPattern(pattern: LogParseResult, potentialJobIds: string[]) {
  try {
    // Find the most recent running job to attribute this log to
    const runningJobs = await jobStateStore.getJobsByStatus('running');
    const scheduledJobs = await jobStateStore.getJobsByStatus('scheduled');
    const activeJobs = [...runningJobs, ...scheduledJobs];
    
    if (activeJobs.length === 0) return;
    
    // Use the most recently created job
    const targetJob = activeJobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    if (!targetJob) return;
    
    const jobId = targetJob.id;
    
    switch (pattern.action) {
      case 'start':
        await jobStateStore.updateJobStatus(jobId, 'running');
        if (pattern.message) {
          await jobStateStore.addJobLog(jobId, pattern.message);
        }
        break;
        
      case 'progress':
        await jobStateStore.updateJobStatus(jobId, 'running', {
          result: {
            success: true,
            message: pattern.message || 'Progress detected',
            itemsProcessed: pattern.itemsProcessed || 0
          }
        });
        if (pattern.message) {
          await jobStateStore.addJobLog(jobId, pattern.message);
        }
        break;
        
      case 'complete':
        await jobStateStore.updateJobStatus(jobId, 'completed', {
          result: {
            success: true,
            message: pattern.message || 'Job completed',
            itemsProcessed: pattern.itemsProcessed || 0
          }
        });
        if (pattern.message) {
          await jobStateStore.addJobLog(jobId, pattern.message);
        }
        break;
        
      case 'error':
        await jobStateStore.updateJobStatus(jobId, 'failed', {
          result: {
            success: false,
            message: pattern.message || 'Job failed',
            errors: [pattern.message || 'Unknown error']
          }
        });
        if (pattern.message) {
          await jobStateStore.addJobLog(jobId, pattern.message);
        }
        break;
    }
    
    console.log(`Updated job ${jobId} based on log pattern:`, pattern);
    
  } catch (error) {
    console.error('Error updating job from log pattern:', error);
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { logLines } = await request.json();
    
    if (!Array.isArray(logLines)) {
      return json({ error: 'logLines must be an array' }, { status: 400 });
    }
    
    const results = [];
    
    for (const line of logLines) {
      const parsed = parseLogLine(line);
      if (parsed) {
        await updateJobFromLogPattern(parsed, []);
        results.push({ line, parsed });
      }
    }
    
    return json({ 
      processed: results.length,
      results: results.slice(0, 5) // Return first 5 for debugging
    });
    
  } catch (error) {
    console.error('Log monitor error:', error);
    return json({ error: 'Failed to process log lines' }, { status: 500 });
  }
};

export const GET: RequestHandler = async () => {
  return json({
    message: 'Log Monitor API',
    usage: {
      POST: {
        description: 'Process console log lines to extract job progress',
        body: {
          logLines: ['array of console log strings']
        }
      }
    },
    patterns: [
      'Job event received - triggers job start',
      'task crawl - indicates job progress',
      'platform telegram - job configuration detected',
      'completed/finished - job completion',
      'error/failed - job failure',
      'Numbers - potential progress indicators'
    ]
  });
};