# Crawler State Integration - Alternative Approaches

## Problem
The telegram-scraper processes jobs but doesn't update the UI because it's not integrated with our job state management system.

## Alternative Solutions (No API Calls Required)

### Option 1: Direct Dapr State Store Updates ⭐ RECOMMENDED

The telegram-scraper can write directly to the same Dapr state store our UI reads from, without calling our API endpoints.

**From telegram-scraper code:**
```go
// Update job state directly via Dapr State API
func updateJobState(jobID string, status string, logs []string, itemsProcessed int) {
    stateData := map[string]interface{}{
        "id": jobID,
        "status": status,
        "updatedAt": time.Now().Format(time.RFC3339),
        "executionLog": logs,
        "result": map[string]interface{}{
            "success": status == "completed",
            "itemsProcessed": itemsProcessed,
        },
    }
    
    // POST to Dapr state store directly
    client := &http.Client{}
    jsonData, _ := json.Marshal([]map[string]interface{}{
        {"key": fmt.Sprintf("job:%s", jobID), "value": stateData},
    })
    
    req, _ := http.NewRequest("POST", "http://localhost:3502/v1.0/state/statestore", bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")
    client.Do(req)
}
```

### Option 2: Log File Monitoring

Create a log file that our UI service monitors:

**From telegram-scraper:**
```go
// Write structured logs to a file that UI can monitor
func logJobProgress(jobID string, action string, message string, itemsProcessed int) {
    logEntry := map[string]interface{}{
        "timestamp": time.Now().Format(time.RFC3339),
        "jobId": jobID,
        "action": action,
        "message": message,
        "itemsProcessed": itemsProcessed,
    }
    
    jsonData, _ := json.Marshal(logEntry)
    
    // Append to job-specific log file
    f, _ := os.OpenFile(fmt.Sprintf("./logs/job_%s.jsonl", jobID), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
    defer f.Close()
    f.WriteString(string(jsonData) + "\n")
}
```

### Option 3: Dapr Pub/Sub Events

Use Dapr's pub/sub to emit events that our UI subscribes to:

**From telegram-scraper:**
```go
func publishJobEvent(jobID string, eventType string, data map[string]interface{}) {
    event := map[string]interface{}{
        "jobId": jobID,
        "eventType": eventType,
        "data": data,
        "timestamp": time.Now().Format(time.RFC3339),
    }
    
    jsonData, _ := json.Marshal(event)
    
    // Publish to Dapr pub/sub
    client := &http.Client{}
    req, _ := http.NewRequest("POST", "http://localhost:3502/v1.0/publish/pubsub/job-events", bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")
    client.Do(req)
}
```

## Recommended Approach

**Option 1 (Direct Dapr State Store Updates)** is the cleanest because:
- No additional infrastructure needed
- Uses existing Dapr state store
- No file system dependencies
- Real-time updates
- Leverages Dapr's built-in capabilities

The telegram-scraper would need these minimal changes:
1. Extract `jobId` from the incoming Dapr job data
2. Make HTTP calls to `http://localhost:3502/v1.0/state/statestore` (not our service)
3. Update the same state store keys our UI reads from

This approach keeps services decoupled while enabling real-time UI updates.