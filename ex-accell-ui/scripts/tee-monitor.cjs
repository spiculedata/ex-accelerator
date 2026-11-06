#!/usr/bin/env node

/**
 * Tee-style Log Monitor
 * 
 * Acts like Unix 'tee' - passes all input to output while also processing
 * for job state updates. Monitor messages go to stderr with timestamps.
 * 
 * Usage:
 *   dapr run -f dapr.yaml 2>&1 | node tee-monitor.cjs
 */

const API_BASE = 'http://localhost:5173/api';

// Enhanced patterns for telegram-scraper events
const PATTERNS = {
  start: /Job event received|Starting.*job|Initializing|Connected to.*API/i,
  progress: /task.*crawl|platform|url\d+|Collected\s+(\d+)|Processed\s+(\d+)|Processing.*batch|crawlId|concurrency|timeAgo/i,
  complete: /completed|finished|saved.*results|crawl.*done|job.*done/i,
  error: /error|failed|exception|timeout|rate.*limit/i
};

let lastJobUpdate = 0;
let activeJobs = [];

// Lightweight job tracking
async function getActiveJobs() {
  try {
    const now = Date.now();
    if (now - lastJobUpdate < 15000 && activeJobs.length > 0) {
      return activeJobs;
    }
    
    const response = await fetch(`${API_BASE}/jobs?state=true`);
    if (response.ok) {
      const jobs = await response.json();
      activeJobs = jobs.filter(job => 
        job.status === 'scheduled' || job.status === 'running'
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      lastJobUpdate = now;
    }
    return activeJobs;
  } catch {
    return activeJobs;
  }
}

async function updateJobQuietly(pattern, line) {
  try {
    const jobs = await getActiveJobs();
    if (jobs.length === 0) return;
    
    const jobId = jobs[0].id;
    let action, message, itemsProcessed = 0;
    
    // Extract the actual log content from the Dapr log line
    // Format: "== APP - telegram-scraper == actual log content"
    const cleanLine = line.replace(/^== APP - telegram-scraper ==\s*/, '').trim();
    
    if (PATTERNS.start.test(line)) {
      action = 'start';
      message = cleanLine || 'Job execution started';
    } else if (PATTERNS.complete.test(line)) {
      action = 'complete';
      message = cleanLine || 'Job completed successfully';
    } else if (PATTERNS.error.test(line)) {
      action = 'fail';
      message = cleanLine || 'Job encountered an error';
    } else if (PATTERNS.progress.test(line)) {
      // Check if this line has actual progress numbers
      const numbers = line.match(/(\d+)/);
      if (numbers && (line.includes('Collected') || line.includes('Processed'))) {
        action = 'progress';
        itemsProcessed = parseInt(numbers[1]);
        message = cleanLine || `Processed ${itemsProcessed} items`;
      } else {
        // Just log the activity without changing job state
        action = 'log';
        message = cleanLine;
      }
    } else {
      return;
    }
    
    // For better log tracking, use 'log' action for most entries and only use 
    // 'start', 'progress', 'complete' for actual state changes
    let apiAction = action;
    let logMessage = message;
    
    if (action === 'progress' && !itemsProcessed) {
      // If it's progress but no items processed, just log it
      apiAction = 'log';
      logMessage = message;
    }
    
    const response = await fetch(`${API_BASE}/job-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: apiAction, 
        jobId, 
        message: logMessage, 
        logMessage: logMessage, // For 'log' action
        itemsProcessed 
      })
    });
    
    // Only log to stderr if successful, and make it subtle
    if (response.ok) {
      const timestamp = new Date().toLocaleTimeString();
      console.error(`\x1b[90m[${timestamp}] 📊 Job ${jobId.slice(-8)} → ${action}\x1b[0m`);
    }
    
  } catch (error) {
    // Silently ignore errors to avoid disrupting log flow
  }
}

// Process stdin line by line
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  // Always pass through the original line first
  console.log(line);
  
  // Quietly process for job updates (only telegram-scraper lines)
  if (line.includes('telegram-scraper')) {
    updateJobQuietly(PATTERNS, line);
  }
});

rl.on('close', () => {
  // Silent exit
});

// Quiet startup - only show if explicitly requested
if (process.argv.includes('--verbose')) {
  console.error('\x1b[90m📊 Job state monitor active\x1b[0m');
}

// Handle termination gracefully
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));