import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobStateStore } from '$lib/services/jobStateStore.js';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { logLine } = await request.json();
    
    // Simple pattern matching for the actual logs you're seeing
    const patterns = {
      jobStart: /Job event received/i,
      taskDetected: /taskcrawl/i,
      platformDetected: /platform.*telegram/i,
      urlDetected: /url\d+/i
    };
    
    const results = {
      line: logLine,
      matches: {},
      action: null
    };
    
    // Check each pattern
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(logLine)) {
        results.matches[key] = true;
        
        if (key === 'jobStart') {
          results.action = 'start';
        } else if (key === 'taskDetected') {
          results.action = 'progress';
        }
      }
    }
    
    // If we detected a job start, try to update the most recent scheduled job
    if (results.action === 'start') {
      try {
        const scheduledJobs = await jobStateStore.getJobsByStatus('scheduled');
        if (scheduledJobs.length > 0) {
          const latestJob = scheduledJobs.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          
          await jobStateStore.updateJobStatus(latestJob.id, 'running');
          await jobStateStore.addJobLog(latestJob.id, 'Job execution detected from console logs');
          
          results.updatedJob = latestJob.id;
        }
      } catch (error) {
        console.error('Error updating job:', error);
        results.error = error instanceof Error ? error.message : String(error);
      }
    }
    
    return json(results);
    
  } catch (error) {
    console.error('Simple log test error:', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
};