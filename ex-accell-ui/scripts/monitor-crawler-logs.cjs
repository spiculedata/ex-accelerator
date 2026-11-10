#!/usr/bin/env node

/**
 * Crawler Log Monitor
 * 
 * This script monitors console output from the Dapr multi-app run and
 * updates job states based on detected patterns.
 * 
 * Usage:
 *   # Run alongside dapr run command:
 *   dapr run -f dapr.yaml 2>&1 | node monitor-crawler-logs.js
 * 
 *   # Or monitor existing output:
 *   tail -f /path/to/logs | node monitor-crawler-logs.js
 */

// Use built-in fetch (Node.js 18+)

const API_BASE = 'http://localhost:5173/api';

// Log patterns to detect job state changes
const PATTERNS = {
  jobStart: {
    regex: /Job event received|Starting.*job|Initializing.*crawler/i,
    action: 'start',
    status: 'running',
    message: 'Job execution started (detected from console)'
  },
  
  taskProgress: {
    regex: /task.*crawl|Processing.*batch|Collected.*\d+|Connected to.*API/i,
    action: 'progress',
    status: 'running',
    message: 'Job progress detected'
  },
  
  itemsProcessed: {
    regex: /Collected\s+(\d+)|Processed\s+(\d+)|Found\s+(\d+)/i,
    action: 'progress',
    status: 'running',
    extractNumber: true
  },
  
  completion: {
    regex: /completed|finished|saved.*results|job.*done/i,
    action: 'complete',
    status: 'completed',
    message: 'Job completion detected from console'
  },
  
  error: {
    regex: /error|failed|exception|timeout|rate.*limit.*exceeded/i,
    action: 'error',
    status: 'failed',
    message: 'Error detected in job execution'
  }
};

// Track recent jobs to associate logs with
let recentJobs = [];
let lastJobCheck = 0;

async function getActiveJobs() {
  try {
    const now = Date.now();
    
    // Only fetch jobs every 10 seconds to avoid spam
    if (now - lastJobCheck < 10000 && recentJobs.length > 0) {
      return recentJobs;
    }
    
    const response = await fetch(`${API_BASE}/jobs?state=true`);
    if (response.ok) {
      const jobs = await response.json();
      // Keep recent jobs (scheduled or running in last 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      recentJobs = jobs.filter(job => 
        (job.status === 'scheduled' || job.status === 'running') &&
        new Date(job.createdAt) > thirtyMinutesAgo
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      lastJobCheck = now;
    }
    
    return recentJobs;
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    return recentJobs;
  }
}

async function updateJobFromLog(pattern, line, jobId = null) {
  try {
    if (!jobId) {
      // Find the most recent active job
      const activeJobs = await getActiveJobs();
      if (activeJobs.length === 0) {
        console.log('No active jobs found to update');
        return;
      }
      jobId = activeJobs[0].id;
    }
    
    let itemsProcessed = 0;
    let message = pattern.message || line.slice(0, 100);
    
    // Extract numbers if pattern supports it
    if (pattern.extractNumber) {
      const numberMatch = line.match(/(\d+)/);
      if (numberMatch) {
        itemsProcessed = parseInt(numberMatch[1]);
        message = `Processed ${itemsProcessed} items (from console)`;
      }
    }
    
    // Update job state via our API
    const updateData = {
      action: pattern.action,
      jobId,
      message,
      itemsProcessed
    };
    
    const response = await fetch(`${API_BASE}/job-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      console.error(`✅ Updated job ${jobId}: ${pattern.action} - ${message}`);
    } else {
      console.error(`❌ Failed to update job ${jobId}: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error updating job from log:', error.message);
  }
}

function processLogLine(line) {
  // Skip empty lines or lines without relevant content
  if (!line.trim() || !line.includes('telegram-scraper')) {
    return;
  }
  
  // Check each pattern
  for (const [patternName, pattern] of Object.entries(PATTERNS)) {
    if (pattern.regex.test(line)) {
      console.error(`🔍 Detected ${patternName}: ${line.slice(0, 80)}...`);
      updateJobFromLog(pattern, line);
      break; // Only process first matching pattern per line
    }
  }
}

console.error('🚀 Crawler Log Monitor started');
console.error('📡 Monitoring console output for job state changes...');
console.error('🎯 Watching for patterns:', Object.keys(PATTERNS).join(', '));
console.error('');

// Process stdin line by line
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  // IMPORTANT: Pass through the original log line to stdout first
  console.log(line);
  
  // Then process it for job state updates
  processLogLine(line);
});

rl.on('close', () => {
  console.error('📝 Log monitoring stopped');
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('\n🛑 Shutting down log monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n🛑 Log monitor terminated');
  process.exit(0);
});