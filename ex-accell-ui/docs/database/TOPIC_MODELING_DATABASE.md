# Topic Modeling Database Integration

This document explains the database structure and implementation for the Topic Modeling dashboard, extending the base social media analytics schema with advanced topic discovery, network analysis, and visualization capabilities.

## Database Schema Overview

The Topic Modeling dashboard uses a comprehensive database schema with the following core tables:

### Core Tables

#### `topic_categories`
Organizes topics into logical categories for filtering and visualization.
```sql
CREATE TABLE topic_categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- Technology, Health, Politics, Sports, etc.
    color VARCHAR(7) NOT NULL, -- Hex color code for visualization
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `topics`
Individual topics discovered through modeling algorithms.
```sql
CREATE TABLE topics (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category_id INTEGER REFERENCES topic_categories(id),
    size INTEGER NOT NULL DEFAULT 0, -- Number of documents/posts in topic
    weight DECIMAL(5,3) NOT NULL DEFAULT 0.0, -- Topic prominence (0.0-1.0)
    coherence_score DECIMAL(4,3), -- Topic coherence metric
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `topic_keywords`
Keywords and terms that define each topic with importance weights.
```sql
CREATE TABLE topic_keywords (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER REFERENCES topics(id),
    keyword VARCHAR(100) NOT NULL,
    weight DECIMAL(5,3) NOT NULL DEFAULT 0.0, -- Keyword importance (0.0-1.0)
    tf_idf_score DECIMAL(8,4), -- TF-IDF score
    frequency INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `topic_relationships`
Network connections between topics for graph visualization.
```sql
CREATE TABLE topic_relationships (
    id INTEGER PRIMARY KEY,
    source_topic_id INTEGER REFERENCES topics(id),
    target_topic_id INTEGER REFERENCES topics(id),
    relationship_strength DECIMAL(5,3) NOT NULL DEFAULT 0.0, -- Connection strength
    relationship_type VARCHAR(20) DEFAULT 'similarity',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Database Service Implementation

### Core Service Methods
The Topic Modeling database service (`topicModelingDb.ts`) provides comprehensive topic analytics:

```typescript
// Load topics with filtering
await topicModelingDb.getTopics(filters);              // Filtered topic data
await topicModelingDb.getTopicCategories();            // Category information
await topicModelingDb.getTopicRelationships(0.5);      // Network relationships

// Visualization data
await topicModelingDb.getTreemapData(filters);         // Hierarchical treemap data
await topicModelingDb.getTrendingTopics(10);           // Trending topic analysis

// Analytics and export
await topicModelingDb.getTopicStats();                 // Overall statistics
await topicModelingDb.exportTopicData(filters);        // Comprehensive data export
```

## Dashboard Features

### 1. Interactive Network Visualization
- **Force-directed graph**: Shows topic relationships and connections
- **Node sizing**: Topics sized by document count
- **Color coding**: Categories distinguished by color
- **Interactive exploration**: Click, drag, zoom, and hover for details

### 2. Hierarchical Treemap
- **Category grouping**: Topics organized by category
- **Size proportional**: Visual area represents topic size
- **Drill-down capability**: Explore category hierarchies
- **Color consistency**: Matches network diagram colors

### 3. Advanced Filtering
- **Category filtering**: Filter by topic categories
- **Search functionality**: Find topics by name or keywords
- **Size thresholding**: Filter by minimum topic size
- **Real-time updates**: Charts update dynamically with filters

### 4. Topic Analytics
- **Statistics dashboard**: Total topics, categories, documents, connections
- **Trending analysis**: Identify rising and declining topics
- **Keyword analysis**: View defining keywords for each topic
- **Export capabilities**: CSV export with filtering support

## Data Structure

### Topic Data Format
```typescript
interface Topic {
  id: string;                    // Unique topic identifier
  name: string;                  // Human-readable topic name
  category: string;              // Category classification
  categoryColor?: string;        // Hex color for visualization
  size: number;                  // Number of documents in topic
  weight: number;                // Topic importance (0.0-1.0)
  keywords: string[];            // Defining keywords array
}
```

### Network Relationships
```typescript
interface TopicRelationship {
  source: string;                // Source topic ID
  target: string;                // Target topic ID
  value: number;                 // Relationship strength (0.0-1.0)
  sourceCategory: string;        // Source topic category
  targetCategory: string;        // Target topic category
}
```

## Visualization Technologies

### ECharts Integration
- **Network Graph**: Force-directed layout with clustering
- **Treemap**: Hierarchical visualization with drill-down
- **Interactive features**: Zoom, pan, hover tooltips, click events
- **Responsive design**: Adapts to different screen sizes

### Chart Configuration
- **Force simulation**: Configurable repulsion and edge length
- **Color schemes**: Category-based color coding
- **Label positioning**: Smart label placement for readability
- **Animation**: Smooth transitions and interactions

## Sample Data Categories

The implementation includes comprehensive sample data across 8 categories:

1. **Technology** (8 topics): AI, ML, Cybersecurity, Cloud Computing, etc.
2. **Health** (5 topics): Mental Health, COVID-19, Healthcare Innovation, etc.
3. **Politics** (4 topics): Elections, Policy, Government Reform, etc.
4. **Sports** (4 topics): Football, Basketball, Baseball, Olympics
5. **Entertainment** (4 topics): Movies, Music, Celebrity, TV Shows
6. **Business** (4 topics): Stock Market, Startups, Economy, Strategy
7. **Science** (4 topics): Climate Change, Space, Medical Breakthroughs, etc.
8. **Social** (4 topics): Social Justice, Community, Education, Diversity

## Performance Optimizations

### Database Efficiency
- **Indexed queries**: Optimized filtering and search performance
- **Aggregated views**: Pre-computed statistics for dashboard metrics
- **Lazy loading**: Load data on demand to reduce initial load time
- **Caching strategy**: Intelligent caching of frequently accessed data

### Frontend Optimization
- **Async chart updates**: Non-blocking chart rendering
- **Debounced filtering**: Prevent excessive API calls during filtering
- **Memory management**: Proper cleanup of chart instances
- **Responsive loading**: Progressive loading states

## Integration Benefits

1. **Scalable Architecture**: Database-driven approach supports large topic sets
2. **Interactive Exploration**: Rich visualizations for topic discovery
3. **Real-time Filtering**: Dynamic data exploration capabilities
4. **Export Flexibility**: Multiple data export formats for analysis
5. **Network Analysis**: Relationship mapping between topics
6. **Category Organization**: Logical grouping for better navigation
7. **Trend Analysis**: Identify emerging and declining topics
8. **Research-Grade**: Academic-quality topic modeling with metrics

## File Structure

```
├── topic_modeling_schema.sql                   # Complete topic modeling database schema
├── src/lib/services/
│   └── topicModelingDb.ts                     # Topic modeling database service
├── src/routes/text-analytics/topic-modeling/
│   └── +page.svelte                           # Topic modeling dashboard
└── TOPIC_MODELING_DATABASE.md                 # This documentation
```

This implementation provides a comprehensive foundation for advanced topic modeling with interactive network visualization and hierarchical analysis capabilities, supporting both research and production use cases.