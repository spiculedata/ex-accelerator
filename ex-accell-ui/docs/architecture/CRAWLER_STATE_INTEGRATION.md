# Crawler State Integration Guide

This document explains how web crawlers (like telegram-scraper) should integrate with the Dapr state store for job tracking.

## Overview

The ex-accell-ui application uses a Dapr Redis state store to track job execution states. Crawlers should update job states during execution to provide real-time feedback to users.

## State Store APIs

### Job State Management API: `/api/job-state`

This API is specifically designed for crawler job state updates:

#### Update Job Status (POST)

```bash
POST /api/job-state
Content-Type: application/json

{
  "action": "start|progress|complete|fail|log",
  "jobId": "job-unique-id",
  "itemsProcessed": 100,
  "message": "Status message",
  "error": "Error message (for fail action)",
  "errors": ["Error 1", "Error 2"],
  "logMessage": "Log entry"
}
```

**Actions:**
- `start`: Mark job as running
- `progress`: Update progress with items processed
- `complete`: Mark job as completed successfully
- `fail`: Mark job as failed with error details
- `log`: Add log entry to job execution log

#### Get Job State (GET)

```bash
# Get specific job
GET /api/job-state?jobId=my-job-id

# Get jobs by status
GET /api/job-state?status=running

# Get all jobs
GET /api/job-state
```

#### Update Job Status (PUT)

```bash
PUT /api/job-state
Content-Type: application/json

{
  "jobId": "job-unique-id",
  "status": "running",
  "result": {
    "success": true,
    "message": "Processing...",
    "itemsProcessed": 150
  }
}
```

## Integration Example

Here's how a crawler should integrate with the state store:

### 1. Job Initialization

When the crawler receives a job from Dapr, extract the `jobId` from the job data and mark the job as started:

```bash
curl -X POST http://localhost:5173/api/job-state \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "jobId": "telegram-crawl-1234",
    "message": "Starting Telegram crawl job"
  }'
```

### 2. Progress Updates

Periodically update progress during job execution:

```bash
curl -X POST http://localhost:5173/api/job-state \
  -H "Content-Type: application/json" \
  -d '{
    "action": "progress", 
    "jobId": "telegram-crawl-1234",
    "itemsProcessed": 250,
    "message": "Processed 250 posts from 5 channels"
  }'
```

### 3. Log Entries

Add detailed log entries for debugging:

```bash
curl -X POST http://localhost:5173/api/job-state \
  -H "Content-Type: application/json" \
  -d '{
    "action": "log",
    "jobId": "telegram-crawl-1234", 
    "logMessage": "Connected to Telegram API successfully"
  }'
```

### 4. Job Completion

Mark job as completed when finished:

```bash
curl -X POST http://localhost:5173/api/job-state \
  -H "Content-Type: application/json" \
  -d '{
    "action": "complete",
    "jobId": "telegram-crawl-1234",
    "itemsProcessed": 1500,
    "message": "Crawl completed successfully. Processed 1500 posts from 10 channels."
  }'
```

### 5. Error Handling

Mark job as failed if errors occur:

```bash
curl -X POST http://localhost:5173/api/job-state \
  -H "Content-Type: application/json" \
  -d '{
    "action": "fail",
    "jobId": "telegram-crawl-1234",
    "error": "API rate limit exceeded",
    "errors": ["Rate limit: 420 Too Many Requests", "Retry after: 3600 seconds"]
  }'
```

## Job State Schema

```typescript
interface JobState {
  id: string;
  name: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  scheduledFor: string;
  platform: 'telegram' | 'youtube';
  jobData: {
    droid: string;
    task: string;
    urls?: string[];
    // ... other job configuration
  };
  executionLog?: string[];
  result?: {
    success: boolean;
    message: string;
    itemsProcessed?: number;
    errors?: string[];
  };
}
```

## Important Notes

1. **Job ID**: The `jobId` is automatically added to job data when scheduling through `/api/jobs`
2. **State Persistence**: All job states are persisted in Redis via Dapr State API
3. **Real-time Updates**: The UI automatically refreshes job states and displays live progress
4. **Error Handling**: Always update job state to 'failed' if the crawler encounters unrecoverable errors
5. **Logging**: Use detailed log messages to help with debugging and monitoring

## Testing the Integration

You can test the state store integration using curl commands:

```bash
# Start the Dapr deployment
npm run dev:dapr

# Test state store connectivity
curl -X GET http://localhost:5173/api/job-state

# Create a test job state
curl -X POST http://localhost:5173/api/job-state \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "jobId": "test-job-123",
    "message": "Test job started"
  }'

# Check the job state in the UI at http://localhost:5173/data-capture
```

This integration ensures that users can monitor job progress in real-time through the web interface while crawlers execute in the background.

## Testing Real-Time Log Updates

A test endpoint is available to simulate crawler behavior and test the real-time log functionality:

### Test API: `/api/test-crawler-logs`

Simulate different crawler actions:

```bash
# Start a test job
curl -X POST http://localhost:5173/api/test-crawler-logs \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-123", "action": "start"}'

# Simulate progress updates
curl -X POST http://localhost:5173/api/test-crawler-logs \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-123", "action": "progress"}'

# Complete the job
curl -X POST http://localhost:5173/api/test-crawler-logs \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-123", "action": "complete"}'

# Run full simulation (automatic)
curl -X POST http://localhost:5173/api/test-crawler-logs \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-123", "action": "simulate"}'
```

### Real-Time UI Features

The UI now includes:

1. **Live Log Updates**: Logs refresh every 2 seconds for running jobs
2. **Auto-Scroll**: New logs automatically scroll into view
3. **Visual Indicators**: 
   - Red dot on "View Logs" button for new logs
   - Green pulse indicator for running jobs
   - Live updating indicator in log viewer
4. **Global Job Monitoring**: All running jobs are monitored automatically
5. **Smart Progress Calculation**: Progress based on items processed vs. total estimated
6. **Enhanced Log Display**: Color-coded log levels (ERROR, WARN, DEBUG, INFO)
7. **Line Numbers**: Each log entry shows line numbers for reference

### Testing Workflow

1. **Start Dapr**: `npm run dev:dapr`
2. **Create Test Job**: Schedule a job through the UI or create manually
3. **Simulate Crawler**: Use the test API to simulate log updates
4. **Monitor UI**: Watch real-time updates in the Data Capture interface
5. **View Logs**: Click "View Logs" to see live log streaming with auto-scroll

This comprehensive integration provides a production-ready job monitoring system with real-time feedback for all crawler operations.