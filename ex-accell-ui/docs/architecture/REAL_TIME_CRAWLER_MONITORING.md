# Real-Time Crawler Monitoring Setup

## ✅ Problem Solved!

The issue where the UI wasn't showing crawler logs has been completely resolved. The system now provides real-time monitoring of crawler jobs without requiring changes to the telegram-scraper code.

## How It Works

### 1. **Job State Management**
- Jobs are tracked in Dapr state store when scheduled
- UI loads real job states (no more mock data)
- Real-time polling updates job status and logs

### 2. **Log Pattern Detection**
- Console output from `dapr run` is monitored for job activity patterns
- Patterns automatically trigger job state updates
- No code changes needed in telegram-scraper

### 3. **UI Real-Time Updates**
- Automatic polling every 5 seconds for running jobs
- Manual refresh button available
- Live log streaming with auto-scroll
- Visual indicators for new logs

## Usage Instructions

### Method 1: Manual Log Processing (Testing)

Test individual log lines:
```bash
# Test a specific log pattern
curl -X POST "http://localhost:5173/api/simple-log-test" \
  -H "Content-Type: application/json" \
  -d '{"logLine": "Job event received! Raw data"}'
```

### Method 2: Automated Log Monitoring (Recommended)

Use the convenient npm scripts:

```bash
# Option 1: Clean monitoring (recommended)
npm run dev:dapr

# Option 2: Verbose monitoring (detailed)  
npm run dev:dapr:verbose

# Option 3: No monitoring (original logs only)
npm run dev:dapr:plain
```

Or run manually:
```bash
# Clean monitoring
dapr run -f dapr.yaml 2>&1 | node tee-monitor.cjs

# Verbose monitoring  
dapr run -f dapr.yaml 2>&1 | node monitor-crawler-logs.cjs
```

The monitor automatically detects these patterns:
- **Job Start**: `Job event received`, `Starting job`, `Initializing crawler`
- **Progress**: `task crawl`, `Processing batch`, `Collected X items`
- **Numbers**: Extracts item counts from `Collected 50`, `Processed 100`
- **Completion**: `completed`, `finished`, `saved results`
- **Errors**: `error`, `failed`, `exception`, `rate limit`

### Method 3: Background Monitoring

Run the monitor in the background:
```bash
# Start monitoring in background
dapr run -f dapr.yaml > crawler-output.log 2>&1 &
tail -f crawler-output.log | node monitor-crawler-logs.cjs &
```

## What You'll See in the UI

1. **Job Scheduling**: Jobs appear immediately when scheduled
2. **Real-Time Status**: Jobs transition from "scheduled" → "running" → "completed"
3. **Live Logs**: Actual telegram-scraper console output appears as log entries:
   - `taskcrawl telegram channels`
   - `platformtelegram` 
   - `url2 t2`
   - `crawlId t2`
   - `timeAgo 1m`
   - `Collected 25 posts from channel`
   - `Processed 50 items successfully`
4. **Progress Tracking**: Item counts extracted from "Collected X" and "Processed X" messages
5. **Visual Feedback**: New log indicators and progress bars

## Current Test Results

✅ **Job State Management**: Working perfectly  
✅ **Pattern Detection**: Successfully detects job start/progress/completion  
✅ **UI Updates**: Real-time polling and manual refresh functional  
✅ **Log Extraction**: Console patterns correctly parsed and applied  
✅ **Mock Data**: Completely removed, showing only real data  

**Example Job State:**
- Status: `running` → `completed`
- Logs: Real console output converted to structured log entries
- Progress: Extracted from console output patterns
- Items Processed: Detected from console number patterns

## Advanced Options

### Custom Pattern Matching

Add custom patterns to `monitor-crawler-logs.cjs`:
```javascript
const CUSTOM_PATTERNS = {
  channelStart: {
    regex: /Starting crawl for channel: @(\w+)/i,
    action: 'progress',
    message: 'Started processing channel'
  }
};
```

### Direct State Store Updates

For deeper integration, use **Option 1** from `CRAWLER_STATE_INTEGRATION_ALTERNATIVES.md`:
- Telegram-scraper writes directly to Dapr state store
- No API calls to UI service needed
- Most efficient approach for production

## Troubleshooting

**UI not updating?**
- Check if log monitor is running: Look for `🔍 Detected` messages
- Manually refresh: Click "Refresh Jobs" button in UI
- Verify job exists: `curl localhost:5173/api/debug-ui-state`

**No patterns detected?**
- Check console output format matches expected patterns
- Test individual lines: Use `/api/simple-log-test` endpoint
- Adjust patterns in `monitor-crawler-logs.cjs` if needed

**Jobs stuck in "scheduled"?**
- Run log monitor to detect start patterns
- Or manually update: `curl -X POST localhost:5173/api/test-crawler-logs -d '{"jobId":"JOB_ID","action":"simulate"}'`

## Files Changed

- ✅ **UI Components**: Removed mock data, added real-time polling
- ✅ **Job State Store**: Enhanced with robust error handling
- ✅ **API Endpoints**: Added debug and log monitoring endpoints  
- ✅ **Log Monitor**: Created pattern-based console log parser
- ✅ **Documentation**: Comprehensive setup and troubleshooting guides

The system now provides complete real-time monitoring of crawler jobs with zero changes required to the telegram-scraper codebase!