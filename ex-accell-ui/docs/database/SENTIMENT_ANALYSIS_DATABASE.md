# Sentiment Analysis Database Integration

This document explains the database structure and implementation for the Sentiment Analysis dashboard, extending the base social media analytics schema with AI-powered sentiment classification, emotion analysis, and trend tracking capabilities.

## Database Schema Extension

The Sentiment Analysis dashboard extends the base dashboard schema with specialized tables for comprehensive sentiment and emotion analysis:

### Core Sentiment Tables

#### `sentiment_analysis`
Individual sentiment analysis results for each post.
```sql
CREATE TABLE sentiment_analysis (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    sentiment_label VARCHAR(20) NOT NULL, -- Very Positive, Positive, Neutral, Negative, Very Negative
    confidence_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    polarity_score DECIMAL(4,3), -- -1.000 to 1.000 (negative to positive)
    subjectivity_score DECIMAL(3,2), -- 0.00 to 1.00 (objective to subjective)
    processing_model VARCHAR(50) DEFAULT 'TextBlob', -- AI model used
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `emotion_analysis`
Multi-emotion analysis for posts (supports multiple emotions per post).
```sql
CREATE TABLE emotion_analysis (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    emotion VARCHAR(20) NOT NULL, -- Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation
    intensity_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    confidence DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    processing_model VARCHAR(50) DEFAULT 'NRC-Emotion-Lexicon',
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `sentiment_trends`
Aggregated sentiment trends by date and data source.
```sql
CREATE TABLE sentiment_trends (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    analysis_date DATE NOT NULL,
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    very_positive_count INTEGER DEFAULT 0,
    very_negative_count INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    avg_confidence DECIMAL(3,2),
    avg_polarity DECIMAL(4,3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, analysis_date)
);
```

#### `emotion_trends`
Daily aggregated emotion trends across all platforms.
```sql
CREATE TABLE emotion_trends (
    id INTEGER PRIMARY KEY,
    analysis_date DATE NOT NULL,
    emotion VARCHAR(20) NOT NULL,
    post_count INTEGER DEFAULT 0,
    avg_intensity DECIMAL(3,2),
    avg_confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(analysis_date, emotion)
);
```

#### `sentiment_keywords`
Keywords and phrases that contribute to sentiment scores.
```sql
CREATE TABLE sentiment_keywords (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    keyword_phrase TEXT NOT NULL,
    sentiment_contribution VARCHAR(20), -- positive, negative, neutral
    weight DECIMAL(3,2) NOT NULL, -- Impact weight on overall sentiment
    position_start INTEGER, -- Character position in text
    position_end INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `platform_sentiment_metrics`
Platform-specific sentiment performance and engagement metrics.
```sql
CREATE TABLE platform_sentiment_metrics (
    id INTEGER PRIMARY KEY,
    data_source_id INTEGER REFERENCES data_sources(id),
    analysis_date DATE NOT NULL,
    avg_engagement_positive DECIMAL(8,2), -- Average engagement for positive posts
    avg_engagement_negative DECIMAL(8,2), -- Average engagement for negative posts
    avg_engagement_neutral DECIMAL(8,2), -- Average engagement for neutral posts
    sentiment_engagement_ratio DECIMAL(4,2), -- Positive to negative engagement ratio
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_source_id, analysis_date)
);
```

## Analytical Views

### Sentiment Overview
```sql
CREATE VIEW sentiment_overview AS
SELECT 
    sa.sentiment_label,
    COUNT(*) as post_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sentiment_analysis), 1) as percentage,
    AVG(sa.confidence_score) as avg_confidence,
    AVG(sa.polarity_score) as avg_polarity,
    AVG(sa.subjectivity_score) as avg_subjectivity
FROM sentiment_analysis sa
GROUP BY sa.sentiment_label
ORDER BY post_count DESC;
```

### Emotion Summary
```sql
CREATE VIEW emotion_summary AS
SELECT 
    ea.emotion,
    COUNT(*) as post_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emotion_analysis), 1) as percentage,
    AVG(ea.intensity_score) as avg_intensity,
    AVG(ea.confidence) as avg_confidence
FROM emotion_analysis ea
GROUP BY ea.emotion
ORDER BY post_count DESC;
```

### Daily Sentiment Trends
```sql
CREATE VIEW daily_sentiment_trends AS
SELECT 
    st.analysis_date,
    SUM(st.positive_count + st.very_positive_count) as positive_total,
    SUM(st.negative_count + st.very_negative_count) as negative_total,
    SUM(st.neutral_count) as neutral_total,
    SUM(st.total_posts) as total_posts,
    ROUND(SUM(st.positive_count + st.very_positive_count) * 100.0 / SUM(st.total_posts), 1) as positive_percentage,
    ROUND(SUM(st.negative_count + st.very_negative_count) * 100.0 / SUM(st.total_posts), 1) as negative_percentage,
    ROUND(SUM(st.neutral_count) * 100.0 / SUM(st.total_posts), 1) as neutral_percentage,
    AVG(st.avg_confidence) as avg_confidence,
    AVG(st.avg_polarity) as avg_polarity
FROM sentiment_trends st
GROUP BY st.analysis_date
ORDER BY st.analysis_date DESC;
```

### Posts with Sentiment Analysis
```sql
CREATE VIEW posts_with_sentiment AS
SELECT 
    p.id,
    p.content,
    p.author,
    p.created_at,
    ds.name as platform,
    sa.sentiment_label,
    sa.confidence_score,
    sa.polarity_score,
    sa.subjectivity_score,
    STRING_AGG(ea.emotion, ', ') as emotions,
    AVG(ea.intensity_score) as avg_emotion_intensity
FROM posts p
JOIN data_sources ds ON p.data_source_id = ds.id
LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
LEFT JOIN emotion_analysis ea ON p.id = ea.post_id
GROUP BY p.id, p.content, p.author, p.created_at, ds.name, sa.sentiment_label, sa.confidence_score, sa.polarity_score, sa.subjectivity_score
ORDER BY p.created_at DESC;
```

### Platform Sentiment Performance
```sql
CREATE VIEW platform_sentiment_performance AS
SELECT 
    ds.name as platform,
    COUNT(sa.id) as total_analyzed_posts,
    AVG(sa.confidence_score) as avg_confidence,
    AVG(sa.polarity_score) as avg_polarity,
    SUM(CASE WHEN sa.sentiment_label IN ('Positive', 'Very Positive') THEN 1 ELSE 0 END) as positive_posts,
    SUM(CASE WHEN sa.sentiment_label IN ('Negative', 'Very Negative') THEN 1 ELSE 0 END) as negative_posts,
    SUM(CASE WHEN sa.sentiment_label = 'Neutral' THEN 1 ELSE 0 END) as neutral_posts,
    ROUND(SUM(CASE WHEN sa.sentiment_label IN ('Positive', 'Very Positive') THEN 1 ELSE 0 END) * 100.0 / COUNT(sa.id), 1) as positive_percentage,
    ROUND(SUM(CASE WHEN sa.sentiment_label IN ('Negative', 'Very Negative') THEN 1 ELSE 0 END) * 100.0 / COUNT(sa.id), 1) as negative_percentage
FROM data_sources ds
JOIN posts p ON ds.id = p.data_source_id
JOIN sentiment_analysis sa ON p.id = sa.post_id
GROUP BY ds.name
ORDER BY total_analyzed_posts DESC;
```

### Top Sentiment Keywords
```sql
CREATE VIEW top_sentiment_keywords AS
SELECT 
    sk.keyword_phrase,
    sk.sentiment_contribution,
    COUNT(*) as frequency,
    AVG(sk.weight) as avg_weight,
    COUNT(*) * AVG(sk.weight) as impact_score
FROM sentiment_keywords sk
GROUP BY sk.keyword_phrase, sk.sentiment_contribution
HAVING COUNT(*) >= 5 -- Only keywords that appear at least 5 times
ORDER BY impact_score DESC
LIMIT 100;
```

### Emotion Correlations
```sql
CREATE VIEW emotion_correlations AS
SELECT 
    e1.emotion as emotion_1,
    e2.emotion as emotion_2,
    COUNT(*) as co_occurrence_count,
    AVG(e1.intensity_score) as avg_intensity_1,
    AVG(e2.intensity_score) as avg_intensity_2,
    CORR(e1.intensity_score, e2.intensity_score) as correlation_coefficient
FROM emotion_analysis e1
JOIN emotion_analysis e2 ON e1.post_id = e2.post_id AND e1.emotion < e2.emotion
GROUP BY e1.emotion, e2.emotion
HAVING COUNT(*) >= 100 -- Only pairs that co-occur at least 100 times
ORDER BY correlation_coefficient DESC;
```

## Database Service Implementation

### Core Service Methods
The Sentiment Analysis database service (`sentimentAnalysisDb.ts`) provides comprehensive sentiment analytics:

```typescript
// Overview and statistics
await sentimentAnalysisDb.getSentimentStats();           // Overall sentiment distribution
await sentimentAnalysisDb.getDetailedSentiments();       // 5-level sentiment breakdown
await sentimentAnalysisDb.getEmotionStats();             // Emotion analysis summary

// Trends and temporal analysis
await sentimentAnalysisDb.getSentimentTrends(timeRange); // Sentiment trends over time
await sentimentAnalysisDb.getSentimentByTimeOfDay();     // Circadian sentiment patterns

// Post-level analysis
await sentimentAnalysisDb.getSamplePosts(filters);       // Filtered posts with sentiment
await sentimentAnalysisDb.getTopSentimentKeywords();     // High-impact sentiment keywords

// Platform and correlation analysis
await sentimentAnalysisDb.getPlatformSentimentPerformance(); // Platform-specific metrics
await sentimentAnalysisDb.getEmotionCorrelations();         // Emotion co-occurrence patterns

// Export capabilities
await sentimentAnalysisDb.exportSentimentData(filters);     // Comprehensive data export
```

## Dashboard Features

### AI-Powered Analysis

#### 1. Multi-Level Sentiment Classification
- **5-Point Scale**: Very Positive, Positive, Neutral, Negative, Very Negative
- **Confidence Scoring**: AI model confidence ratings (0-100%)
- **Polarity Analysis**: Numerical sentiment scores (-1.0 to +1.0)
- **Subjectivity Measurement**: Objective vs. subjective content assessment

#### 2. Multi-Emotion Analysis
- **8 Primary Emotions**: Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation
- **Intensity Scoring**: Emotion strength measurement (0-100%)
- **Multi-Emotion Support**: Multiple emotions per post
- **Emotion Correlations**: Co-occurrence pattern analysis

#### 3. Advanced Visualizations
- **Sentiment Distribution**: Interactive pie charts with detailed breakdowns
- **Emotion Analysis**: Bar charts showing emotion prevalence and intensity
- **Temporal Trends**: Line charts tracking sentiment changes over time
- **Platform Comparison**: Cross-platform sentiment performance metrics

### Interactive Features

#### 1. Dynamic Filtering
- **Sentiment Filtering**: Filter by specific sentiment categories
- **Platform Filtering**: Analyze individual social media platforms
- **Confidence Thresholding**: Filter by AI confidence levels
- **Time Range Selection**: Analyze different time periods (1d, 7d, 30d, 90d)

#### 2. Real-Time Updates
- **Database-Driven**: Live updates from sentiment analysis pipeline
- **Filter Reactivity**: Instant filtering with database queries
- **Chart Synchronization**: Coordinated chart updates across dashboard

#### 3. Export Capabilities
- **CSV Export**: Filtered sentiment data export
- **Comprehensive Reports**: Full analytics including trends and metadata
- **Research Format**: Academic-ready data structure

### Analytics Insights

#### 1. Sentiment Metrics
- **Overall Distribution**: Positive, negative, neutral sentiment percentages
- **Confidence Analysis**: AI model performance and reliability metrics
- **Trend Analysis**: Sentiment changes over time periods
- **Platform Comparison**: Sentiment differences across social platforms

#### 2. Emotion Intelligence
- **Emotion Prevalence**: Most common emotions in social content
- **Intensity Analysis**: Emotional strength measurement
- **Correlation Patterns**: Emotion co-occurrence relationships
- **Temporal Patterns**: Emotion trends over time

#### 3. Content Analysis
- **Keyword Impact**: Words and phrases driving sentiment scores
- **Engagement Correlation**: Sentiment vs. engagement relationship
- **Platform Behavior**: Platform-specific sentiment characteristics
- **Quality Metrics**: Analysis confidence and accuracy indicators

## Production Integration

### AI/ML Pipeline Integration
1. **Text Processing**: Automated sentiment analysis on new posts
2. **Model Selection**: Support for multiple AI models (TextBlob, VADER, etc.)
3. **Batch Processing**: Efficient analysis of large post volumes
4. **Real-time Analysis**: Live sentiment scoring for streaming data

### Performance Optimization
- **Indexed Queries**: Optimized database indexes for fast filtering
- **Aggregated Views**: Pre-computed statistics for dashboard performance
- **Caching Strategy**: Intelligent caching of frequently accessed data
- **Batch Updates**: Efficient bulk data processing

### Data Quality
- **Confidence Tracking**: Model confidence scoring and filtering
- **Multi-Model Support**: Ensemble approaches for improved accuracy
- **Human Validation**: Integration with human annotation workflows
- **Error Handling**: Graceful handling of analysis failures

## Benefits

1. **AI-Powered Insights**: Advanced sentiment and emotion analysis using modern NLP
2. **Real-Time Monitoring**: Live sentiment tracking across social platforms
3. **Comprehensive Analysis**: Multi-dimensional sentiment and emotion measurement
4. **Interactive Exploration**: Dynamic filtering and visualization capabilities
5. **Research-Grade Data**: Academic-quality analytics with confidence scoring
6. **Platform Intelligence**: Cross-platform sentiment comparison and analysis
7. **Export Flexibility**: Multiple data export formats for further analysis
8. **Scalable Architecture**: Database-driven approach supporting large datasets

## File Structure

```
├── sentiment_analysis_schema.sql              # Complete sentiment database schema
├── src/lib/services/
│   └── sentimentAnalysisDb.ts                # Sentiment analysis database service
├── src/routes/text-analytics/sentiment-analysis/
│   └── +page.svelte                          # Sentiment analysis dashboard
└── SENTIMENT_ANALYSIS_DATABASE.md            # This documentation
```

This implementation provides a comprehensive foundation for AI-powered sentiment analysis with real-time dashboard capabilities, supporting both basic sentiment classification and advanced emotion analysis for social media content.