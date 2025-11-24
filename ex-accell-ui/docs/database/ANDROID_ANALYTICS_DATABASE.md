# Android Analytics Database Integration

This document explains the database structure and implementation for the Android Analytics dashboard using Princeton SMART / Screenlake Research Kit data.

## Database Schema

The Android Analytics dashboard is powered by DuckDB with the following tables designed for mobile device analytics:

### Core Tables

#### `android_users`
Stores research participants and device information.
```sql
CREATE TABLE android_users (
    id_user VARCHAR(50) PRIMARY KEY,
    user_type VARCHAR(20) DEFAULT 'research_participant',
    device_info JSON,
    consent_given BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_sessions`
Tracks user interaction sessions.
```sql
CREATE TABLE android_sessions (
    id_session VARCHAR(100) PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    session_start TIMESTAMP,
    session_end TIMESTAMP,
    duration_minutes INTEGER,
    total_apps_used INTEGER DEFAULT 0,
    total_screenshots INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_apps`
Application metadata and categorization.
```sql
CREATE TABLE android_apps (
    apk VARCHAR(255) PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    developer VARCHAR(255),
    is_system_app BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_accessibility_events`
Captures device interaction events and screen content.
```sql
CREATE TABLE android_accessibility_events (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    id_session VARCHAR(100) REFERENCES android_sessions(id_session),
    event_type VARCHAR(50) NOT NULL, -- SESSION_START, SCREEN_TEXT, URL, etc.
    t_unix_ts_ms BIGINT NOT NULL,
    apk VARCHAR(255) REFERENCES android_apps(apk),
    text_content TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_app_segments`
Tracks application usage duration and timing.
```sql
CREATE TABLE android_app_segments (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    id_session VARCHAR(100) REFERENCES android_sessions(id_session),
    apk VARCHAR(255) REFERENCES android_apps(apk),
    t_unix_ts_segment_start BIGINT NOT NULL,
    duration_segment_ms INTEGER NOT NULL,
    activity_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_screenshots`
Screenshot metadata and OCR text extraction.
```sql
CREATE TABLE android_screenshots (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    file_name VARCHAR(500) NOT NULL,
    apk VARCHAR(255) REFERENCES android_apps(apk),
    app_display_name VARCHAR(255),
    extracted_text TEXT,
    t_epoch_ts_ms BIGINT NOT NULL,
    t_natural_day_ts VARCHAR(20),
    image_path VARCHAR(1000),
    ocr_confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Analytics Views

### Session Analytics
```sql
CREATE VIEW android_session_analytics AS
SELECT 
    s.id_session,
    s.id_user,
    s.duration_minutes,
    COUNT(DISTINCT seg.apk) as unique_apps_used,
    COUNT(ss.id) as total_screenshots,
    SUM(seg.duration_segment_ms) / 60000.0 as total_active_minutes,
    COUNT(ae.id) as total_events
FROM android_sessions s
LEFT JOIN android_app_segments seg ON s.id_session = seg.id_session
LEFT JOIN android_screenshots ss ON s.id_session = ss.id_user
LEFT JOIN android_accessibility_events ae ON s.id_session = ae.id_session
GROUP BY s.id_session, s.id_user, s.duration_minutes;
```

### App Usage Analytics
```sql
CREATE VIEW android_app_analytics AS
SELECT 
    a.apk,
    a.app_name,
    a.category,
    COUNT(seg.id) as usage_sessions,
    SUM(seg.duration_segment_ms) / 60000.0 as total_minutes,
    AVG(seg.duration_segment_ms) / 60000.0 as avg_session_minutes,
    COUNT(ss.id) as screenshot_count,
    COUNT(DISTINCT seg.id_user) as unique_users
FROM android_apps a
LEFT JOIN android_app_segments seg ON a.apk = seg.apk
LEFT JOIN android_screenshots ss ON a.apk = ss.apk
GROUP BY a.apk, a.app_name, a.category;
```

### User Behavior Patterns
```sql
CREATE VIEW android_user_patterns AS
SELECT 
    u.id_user,
    COUNT(DISTINCT s.id_session) as total_sessions,
    SUM(s.duration_minutes) as total_session_minutes,
    COUNT(DISTINCT seg.apk) as unique_apps_used,
    COUNT(ss.id) as total_screenshots,
    COUNT(ae.id) as total_events,
    AVG(s.duration_minutes) as avg_session_duration
FROM android_users u
LEFT JOIN android_sessions s ON u.id_user = s.id_user
LEFT JOIN android_app_segments seg ON u.id_user = seg.id_user
LEFT JOIN android_screenshots ss ON u.id_user = ss.id_user
LEFT JOIN android_accessibility_events ae ON u.id_user = ae.id_user
GROUP BY u.id_user;
```

## Implementation

### Database Service
The Android Analytics database service (`androidAnalyticsDb.ts`) provides a clean API for querying Princeton SMART data:

```typescript
// Core data retrieval methods
await androidAnalyticsDb.getAccessibilityEvents();  // Screen interactions and events
await androidAnalyticsDb.getAppSegments();          // App usage timing data
await androidAnalyticsDb.getScreenshots();          // Screenshot metadata and OCR text
await androidAnalyticsDb.getSessionAnalytics();     // Aggregated session metrics
await androidAnalyticsDb.getAppUsageAnalytics();    // App-level usage statistics
await androidAnalyticsDb.getUserBehaviorPatterns(); // User behavior analysis
await androidAnalyticsDb.getAnalyticsSummary();     // Dashboard summary metrics
```

### Dashboard Integration
The Android Analytics dashboard (`/android-analytics/+page.svelte`) now uses the database service:

1. **Data Loading**: Async loading from database with fallback to sample data
2. **Real Metrics**: Calculations based on actual database queries
3. **Error Handling**: Graceful fallback if database connection fails
4. **Performance**: Efficient loading and chart rendering

### Key Features

#### Research Data Compatibility
- **Princeton SMART**: Full compatibility with Social Media Analysis and Research Toolkit
- **Screenlake Kit**: Native support for mobile device monitoring data
- **Research Ethics**: Maintains participant consent and privacy controls

#### Mobile Analytics
- **App Usage Tracking**: Detailed timing and interaction patterns
- **Screenshot Analysis**: OCR text extraction and content analysis
- **Accessibility Events**: Complete interaction timeline
- **Session Management**: Multi-user session tracking

#### Visualization
- **Usage Patterns**: Top applications by time spent
- **Behavior Analysis**: User interaction patterns and trends
- **Timeline View**: Chronological app usage timeline
- **Content Analysis**: Screen text and URL visit tracking

## Data Flow

1. **Collection**: Screenlake Research Kit captures device interactions
2. **Processing**: Data flows through Princeton SMART analysis pipeline
3. **Storage**: Structured data stored in DuckDB analytics tables
4. **Querying**: Database service provides clean API access
5. **Visualization**: Dashboard renders interactive analytics and insights

## Production Deployment

### Backend Requirements
- DuckDB instance with Android analytics schema
- API endpoints for database service methods
- Data pipeline from Princeton SMART / Screenlake sources

### Migration Steps
1. Deploy DuckDB instance with `android_analytics_schema.sql`
2. Set up ETL pipeline for Princeton SMART data ingestion
3. Update `androidAnalyticsDb.ts` to call backend APIs
4. Configure authentication and access controls

## Benefits

1. **Research-Ready**: Built specifically for Princeton SMART ecosystem
2. **Real-Time Analytics**: Live dashboard updates from mobile data streams
3. **Scalable Schema**: Easily extensible for new research data types
4. **Privacy-First**: Designed with research ethics and consent management
5. **Cross-Platform**: Supports various Android device types and versions

## File Structure

```
├── android_analytics_schema.sql               # Complete database schema
├── src/lib/services/
│   └── androidAnalyticsDb.ts                 # Database service implementation
├── src/routes/android-analytics/
│   └── +page.svelte                          # Dashboard component
└── ANDROID_ANALYTICS_DATABASE.md             # This documentation
```

This implementation provides a robust foundation for analyzing mobile device interaction patterns and user behavior using Princeton SMART research data.