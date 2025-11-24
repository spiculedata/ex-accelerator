# Android Research Database Integration

This document explains the advanced database structure and implementation for the Android Research dashboard, extending the base Android Analytics with research-specific features for behavioral analysis, digital phenotyping, and attention research.

## Database Schema Extension

The Android Research dashboard extends the base Android Analytics schema with additional tables designed for advanced behavioral research:

### Research-Specific Tables

#### `android_temporal_usage`
Aggregated temporal usage patterns by hour for circadian analysis.
```sql
CREATE TABLE android_temporal_usage (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    hour_of_day INTEGER NOT NULL, -- 0-23
    apk VARCHAR(255) REFERENCES android_apps(apk),
    total_usage_minutes DECIMAL(8,2) NOT NULL,
    session_count INTEGER DEFAULT 0,
    avg_session_duration DECIMAL(8,2) DEFAULT 0,
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_app_transitions`
App transition matrix for network analysis and behavior flow mapping.
```sql
CREATE TABLE android_app_transitions (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    source_apk VARCHAR(255) REFERENCES android_apps(apk),
    target_apk VARCHAR(255) REFERENCES android_apps(apk),
    transition_count INTEGER NOT NULL DEFAULT 1,
    avg_transition_time_ms INTEGER,
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_user, source_apk, target_apk, analysis_date)
);
```

#### `android_attention_spans`
Individual session measurements for attention research and cognitive analysis.
```sql
CREATE TABLE android_attention_spans (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    apk VARCHAR(255) REFERENCES android_apps(apk),
    session_duration_seconds INTEGER NOT NULL,
    task_switches INTEGER DEFAULT 0,
    interruptions INTEGER DEFAULT 0,
    session_timestamp TIMESTAMP NOT NULL,
    attention_quality_score DECIMAL(3,2), -- 0-100 score
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_content_engagement`
Content engagement metrics derived from OCR analysis and interaction patterns.
```sql
CREATE TABLE android_content_engagement (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    content_category VARCHAR(100) NOT NULL, -- Social Media, Video Content, etc.
    engagement_score DECIMAL(5,2) NOT NULL, -- 0-100 engagement score
    avg_duration_seconds INTEGER NOT NULL,
    interaction_depth DECIMAL(4,2), -- Interactions per minute
    return_rate DECIMAL(3,2), -- Probability of returning
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_cognitive_load`
Cognitive load indicators for behavioral phenotyping and mental workload analysis.
```sql
CREATE TABLE android_cognitive_load (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    hour_of_day INTEGER NOT NULL, -- 0-23
    task_switches_per_hour INTEGER NOT NULL,
    multitasking_index DECIMAL(4,2), -- 0-10 scale
    attention_fragmentation DECIMAL(5,2), -- 0-100 percentage
    cognitive_efficiency DECIMAL(5,2), -- 0-100 percentage
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_research_findings`
Research insights and findings metadata for academic analysis.
```sql
CREATE TABLE android_research_findings (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    finding_type VARCHAR(100) NOT NULL,
    finding_title VARCHAR(255) NOT NULL,
    finding_description TEXT NOT NULL,
    statistical_significance TEXT,
    research_implication TEXT,
    confidence_score DECIMAL(3,2), -- 0-100
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `android_digital_phenotypes`
Digital behavioral phenotype classifications for user profiling.
```sql
CREATE TABLE android_digital_phenotypes (
    id BIGINT PRIMARY KEY,
    id_user VARCHAR(50) REFERENCES android_users(id_user),
    behavior_type VARCHAR(50), -- Heavy User, Moderate User, Light User
    attention_profile VARCHAR(50), -- Sustained, Moderate, Fragmented
    usage_pattern VARCHAR(50), -- Evening-Peak, Afternoon-Peak, Morning-Peak
    multitasking_index VARCHAR(50), -- High, Moderate, Low
    digital_wellbeing_score DECIMAL(5,2), -- 0-100
    analysis_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Research Analytics Views

### Temporal Analysis
```sql
CREATE VIEW android_temporal_analysis AS
SELECT 
    tu.id_user,
    tu.hour_of_day,
    a.app_name,
    a.category,
    tu.total_usage_minutes,
    tu.session_count,
    tu.avg_session_duration,
    RANK() OVER (PARTITION BY tu.id_user ORDER BY tu.total_usage_minutes DESC) as usage_rank
FROM android_temporal_usage tu
JOIN android_apps a ON tu.apk = a.apk
ORDER BY tu.id_user, tu.hour_of_day;
```

### Network Centrality Analysis
```sql
CREATE VIEW android_network_centrality AS
SELECT 
    apk,
    app_name,
    category,
    COALESCE(out_transitions.out_degree, 0) as out_degree,
    COALESCE(in_transitions.in_degree, 0) as in_degree,
    COALESCE(out_transitions.out_degree, 0) + COALESCE(in_transitions.in_degree, 0) as centrality_score
FROM android_apps a
LEFT JOIN (
    SELECT source_apk, SUM(transition_count) as out_degree
    FROM android_app_transitions
    GROUP BY source_apk
) out_transitions ON a.apk = out_transitions.source_apk
LEFT JOIN (
    SELECT target_apk, SUM(transition_count) as in_degree
    FROM android_app_transitions
    GROUP BY target_apk
) in_transitions ON a.apk = in_transitions.target_apk
ORDER BY centrality_score DESC;
```

### Attention Research Metrics
```sql
CREATE VIEW android_attention_research AS
SELECT 
    asp.id_user,
    a.app_name,
    a.category,
    COUNT(asp.id) as total_sessions,
    AVG(asp.session_duration_seconds) as avg_duration_seconds,
    STDDEV(asp.session_duration_seconds) as duration_std_dev,
    AVG(asp.task_switches) as avg_task_switches,
    AVG(asp.interruptions) as avg_interruptions,
    AVG(asp.attention_quality_score) as avg_attention_quality,
    -- Duration expectation ratio for research analysis
    AVG(asp.session_duration_seconds) / 
    CASE 
        WHEN a.app_name = 'YouTube' THEN 280
        WHEN a.app_name = 'Instagram' THEN 180
        WHEN a.app_name = 'WhatsApp' THEN 90
        WHEN a.app_name = 'Chrome' THEN 200
        ELSE 120
    END as duration_expectation_ratio
FROM android_attention_spans asp
JOIN android_apps a ON asp.apk = a.apk
GROUP BY asp.id_user, a.app_name, a.category;
```

## Database Service Implementation

### Core Research Methods
The Android Research database service (`androidResearchDb.ts`) provides specialized queries for behavioral analysis:

```typescript
// Temporal analysis methods
await androidResearchDb.getTemporalUsagePatterns();  // 24-hour usage patterns
await androidResearchDb.getCognitiveLoadData();      // Cognitive load by hour

// Network analysis methods  
await androidResearchDb.getAppTransitions();         // App transition matrix
await androidResearchDb.getNetworkCentrality();      // Network centrality analysis
await androidResearchDb.getTransitionFlow();         // Sankey diagram data

// Attention research methods
await androidResearchDb.getAttentionSpans();         // Individual session data
await androidResearchDb.getContentEngagement();      // Content engagement metrics

// Behavioral analysis methods
await androidResearchDb.getBehavioralMetrics();      // Key behavioral metrics
await androidResearchDb.getDigitalPhenotype();       // Phenotype classification
await androidResearchDb.getResearchFindings();       // Research insights
```

## Dashboard Features

### Advanced Visualizations

#### 1. Temporal Patterns Analysis
- **24-Hour Usage Heatmap**: Visualizes usage intensity across apps and time
- **Circadian Rhythm Charts**: Line charts showing temporal usage patterns
- **Peak Activity Detection**: Identifies optimal intervention windows

#### 2. Network Analysis
- **App Transition Network**: Force-directed graph showing app relationships
- **Sankey Flow Diagram**: Hierarchical flow visualization of app transitions
- **Centrality Analysis**: Identifies hub apps in user behavior ecosystem

#### 3. Attention Research
- **Attention Span Distribution**: Scatter plot of expected vs. actual session duration
- **Task Switching Analysis**: Measures cognitive fragmentation patterns
- **Attention Quality Metrics**: Research-grade attention measurement

#### 4. Content Engagement Analysis
- **Engagement Score Charts**: Multi-metric engagement visualization
- **Content Category Analysis**: Engagement patterns by content type
- **Return Rate Analysis**: Habit formation and content stickiness

#### 5. Research Findings
- **Digital Phenotype Classification**: Behavioral profile categorization
- **Key Research Insights**: Structured findings with statistical significance
- **Behavioral Metrics Summary**: Quantitative behavioral indicators

### Research Capabilities

#### Digital Phenotyping
- **Behavior Classification**: Heavy/Moderate/Light user categorization
- **Attention Profiling**: Sustained/Moderate/Fragmented attention patterns
- **Usage Pattern Analysis**: Morning/Afternoon/Evening peak identification
- **Multitasking Assessment**: Cognitive load and task-switching analysis

#### Behavioral Metrics
- **Total Daily Usage**: Comprehensive usage time tracking
- **Peak Activity Windows**: Optimal timing for interventions
- **Session Length Analysis**: Attention span measurement
- **App Switching Rate**: Multitasking behavior quantification
- **Digital Wellbeing Score**: Holistic behavioral health indicator

#### Research Export
- **Comprehensive Reports**: JSON export with all research data
- **Statistical Analysis**: Confidence scores and significance testing
- **Academic Format**: Research-ready data structure for publications

## Integration with Princeton SMART

### Data Pipeline
1. **Princeton SMART Collection**: Raw mobile interaction data
2. **Screenlake Processing**: Screenshot analysis and OCR extraction  
3. **Database Ingestion**: Structured data storage in research tables
4. **Analytics Processing**: Behavioral analysis and pattern detection
5. **Dashboard Visualization**: Interactive research-grade visualizations

### Research Applications
- **Attention Studies**: Measuring digital attention spans and fragmentation
- **Behavioral Interventions**: Identifying optimal intervention timing
- **Digital Wellbeing**: Quantifying healthy vs. problematic usage patterns
- **Cognitive Load Assessment**: Understanding mental workload from mobile use
- **Social Behavior Analysis**: Network effects in app usage patterns

## Production Deployment

### Backend Requirements
- DuckDB instance with extended Android research schema
- API endpoints for all research database service methods
- ETL pipeline for Princeton SMART research data processing
- Advanced analytics processing for behavioral metrics calculation

### Performance Considerations
- **Temporal Data**: Hourly aggregations for efficient querying
- **Network Analysis**: Pre-computed centrality scores for large datasets
- **Attention Metrics**: Indexed by user and timestamp for fast retrieval
- **Research Views**: Materialized views for complex analytics queries

## Benefits for Research

1. **Academic Rigor**: Research-grade metrics with statistical significance
2. **Behavioral Insights**: Deep understanding of digital behavior patterns
3. **Intervention Design**: Data-driven approach to behavioral interventions
4. **Longitudinal Analysis**: Time-series data for behavior change studies
5. **Cross-Platform Research**: Generalizable insights across mobile platforms
6. **Real-Time Analytics**: Live dashboard updates for ongoing studies
7. **Export Capabilities**: Academic publication-ready data formats

## File Structure

```
├── android_research_schema.sql               # Extended research schema
├── src/lib/services/
│   └── androidResearchDb.ts                 # Research database service
├── src/routes/android-research/
│   └── +page.svelte                         # Advanced research dashboard
└── ANDROID_RESEARCH_DATABASE.md             # This documentation
```

This implementation provides a comprehensive foundation for advanced mobile behavioral research using Princeton SMART data, with research-grade analytics and interactive visualizations suitable for academic studies and behavioral intervention design.