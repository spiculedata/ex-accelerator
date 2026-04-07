import { unifiedDb } from './duckdb';

export interface TrigramData {
  trigram: string;
  frequency: number;
  sentiment: number;
  platforms: string[];
  trend: 'up' | 'down' | 'stable';
  firstSeen: string;
  lastSeen: string;
  averageEngagement: number;
  topPosts: string[];
}

export interface TrigramFilters {
  platform?: string;
  timeRange?: string;
  minFrequency?: number;
  maxResults?: number;
  searchQuery?: string;
  sentimentRange?: [number, number];
}

export interface TrigramStats {
  totalTrigrams: number;
  uniqueTrigrams: number;
  averageFrequency: number;
  topCategories: Array<{ category: string; percentage: number }>;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  trendDistribution: {
    up: number;
    stable: number;
    down: number;
  };
}

class TrigramsDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return;
    await unifiedDb.connect();
    await this.ensureTablesExist();
    this.initialized = true;
  }

  private async ensureTablesExist() {
    try {
      // Create trigrams table if it doesn't exist
      await unifiedDb.query(`
        CREATE TABLE IF NOT EXISTS trigrams (
          id INTEGER PRIMARY KEY,
          trigram TEXT NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 0,
          sentiment REAL DEFAULT 0.0,
          platforms TEXT, -- JSON array of platform names
          trend TEXT DEFAULT 'stable',
          first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          average_engagement REAL DEFAULT 0.0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create trigram_posts junction table for tracking which posts contain which trigrams
      await unifiedDb.query(`
        CREATE TABLE IF NOT EXISTS trigram_posts (
          id INTEGER PRIMARY KEY,
          trigram_id INTEGER,
          post_id INTEGER,
          position INTEGER, -- Position in the post where trigram appears
          context TEXT, -- Surrounding text context
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trigram_id) REFERENCES trigrams(id),
          FOREIGN KEY (post_id) REFERENCES posts(id)
        );
      `);

      // Create index for better performance
      await unifiedDb.query(`
        CREATE INDEX IF NOT EXISTS idx_trigrams_frequency ON trigrams(frequency DESC);
      `);
      
      await unifiedDb.query(`
        CREATE INDEX IF NOT EXISTS idx_trigrams_sentiment ON trigrams(sentiment);
      `);

      await unifiedDb.query(`
        CREATE INDEX IF NOT EXISTS idx_trigram_posts_trigram_id ON trigram_posts(trigram_id);
      `);

      console.log('Trigrams database tables initialized');
    } catch (error) {
      console.error('Error creating trigrams tables:', error);
    }
  }

  async getTrigramsData(filters: TrigramFilters = {}): Promise<TrigramData[]> {
    if (!this.initialized) await this.connect();

    const {
      platform = 'all',
      timeRange = '7d',
      minFrequency = 1,
      maxResults = 100,
      searchQuery = '',
      sentimentRange = [-1, 1]
    } = filters;

    try {
      let whereConditions = [`frequency >= ${minFrequency}`];
      let timeFilter = '';

      // Time range filter
      switch (timeRange) {
        case '1d':
          timeFilter = "last_seen >= datetime('now', '-1 day')";
          break;
        case '7d':
          timeFilter = "last_seen >= datetime('now', '-7 days')";
          break;
        case '30d':
          timeFilter = "last_seen >= datetime('now', '-30 days')";
          break;
        case '90d':
          timeFilter = "last_seen >= datetime('now', '-90 days')";
          break;
        default:
          timeFilter = "last_seen >= datetime('now', '-7 days')";
      }
      whereConditions.push(timeFilter);

      // Platform filter
      if (platform !== 'all') {
        whereConditions.push(`platforms LIKE '%"${platform}"%'`);
      }

      // Search query filter
      if (searchQuery) {
        whereConditions.push(`trigram LIKE '%${searchQuery}%'`);
      }

      // Sentiment range filter
      if (sentimentRange[0] !== -1 || sentimentRange[1] !== 1) {
        whereConditions.push(`sentiment BETWEEN ${sentimentRange[0]} AND ${sentimentRange[1]}`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          trigram,
          frequency,
          sentiment,
          platforms,
          trend,
          first_seen,
          last_seen,
          average_engagement
        FROM trigrams
        ${whereClause}
        ORDER BY frequency DESC
        LIMIT ${maxResults}
      `;

      const results = await unifiedDb.query(query);

      return results.map(row => ({
        trigram: row.trigram,
        frequency: row.frequency,
        sentiment: row.sentiment,
        platforms: row.platforms ? JSON.parse(row.platforms) : [],
        trend: row.trend as 'up' | 'down' | 'stable',
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        averageEngagement: row.average_engagement || 0,
        topPosts: [] // Would need additional query to populate
      }));

    } catch (error) {
      console.error('Error fetching trigrams data:', error);
      // Return fallback data
      return this.getFallbackTrigramsData();
    }
  }

  async getTrigramStats(filters: TrigramFilters = {}): Promise<TrigramStats> {
    if (!this.initialized) await this.connect();

    try {
      const trigramsData = await this.getTrigramsData(filters);
      const totalTrigrams = trigramsData.reduce((sum, item) => sum + item.frequency, 0);
      const uniqueTrigrams = trigramsData.length;
      const averageFrequency = uniqueTrigrams > 0 ? Math.round(totalTrigrams / uniqueTrigrams) : 0;

      // Calculate sentiment distribution
      const sentimentDistribution = trigramsData.reduce(
        (acc, trigram) => {
          if (trigram.sentiment > 0.3) acc.positive++;
          else if (trigram.sentiment < -0.3) acc.negative++;
          else acc.neutral++;
          return acc;
        },
        { positive: 0, neutral: 0, negative: 0 }
      );

      // Calculate trend distribution
      const trendDistribution = trigramsData.reduce(
        (acc, trigram) => {
          acc[trigram.trend]++;
          return acc;
        },
        { up: 0, stable: 0, down: 0 }
      );

      // Mock top categories (would be calculated from actual data)
      const topCategories = [
        { category: 'Marketing & Social', percentage: 23 },
        { category: 'Technology & AI', percentage: 19 },
        { category: 'Business & Products', percentage: 16 },
        { category: 'Environment & Climate', percentage: 12 },
        { category: 'Other Topics', percentage: 30 }
      ];

      return {
        totalTrigrams,
        uniqueTrigrams,
        averageFrequency,
        topCategories,
        sentimentDistribution,
        trendDistribution
      };

    } catch (error) {
      console.error('Error calculating trigram stats:', error);
      return {
        totalTrigrams: 0,
        uniqueTrigrams: 0,
        averageFrequency: 0,
        topCategories: [],
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        trendDistribution: { up: 0, stable: 0, down: 0 }
      };
    }
  }

  async seedTrigramsData(): Promise<void> {
    if (!this.initialized) await this.connect();

    try {
      // Check if we already have data
      const existingCount = await unifiedDb.query('SELECT COUNT(*) as count FROM trigrams');
      if (existingCount[0]?.count > 0) {
        console.log('Trigrams data already exists, skipping seed');
        return;
      }

      const sampleTrigrams = [
        { trigram: 'social media marketing', frequency: 1247, sentiment: 0.72, platforms: '["twitter", "facebook"]', trend: 'up' },
        { trigram: 'artificial intelligence technology', frequency: 892, sentiment: 0.65, platforms: '["twitter", "linkedin"]', trend: 'up' },
        { trigram: 'climate change impact', frequency: 734, sentiment: -0.23, platforms: '["twitter", "instagram"]', trend: 'stable' },
        { trigram: 'new product launch', frequency: 623, sentiment: 0.81, platforms: '["facebook", "instagram"]', trend: 'up' },
        { trigram: 'customer service experience', frequency: 567, sentiment: -0.15, platforms: '["twitter", "facebook"]', trend: 'down' },
        { trigram: 'machine learning algorithms', frequency: 489, sentiment: 0.58, platforms: '["linkedin", "twitter"]', trend: 'up' },
        { trigram: 'data privacy concerns', frequency: 445, sentiment: -0.34, platforms: '["twitter", "linkedin"]', trend: 'stable' },
        { trigram: 'mobile app development', frequency: 398, sentiment: 0.44, platforms: '["linkedin", "instagram"]', trend: 'up' },
        { trigram: 'brand awareness campaign', frequency: 367, sentiment: 0.67, platforms: '["instagram", "facebook"]', trend: 'stable' },
        { trigram: 'user experience design', frequency: 334, sentiment: 0.52, platforms: '["linkedin", "twitter"]', trend: 'up' },
        { trigram: 'financial market analysis', frequency: 298, sentiment: 0.12, platforms: '["twitter", "linkedin"]', trend: 'down' },
        { trigram: 'sustainable energy solutions', frequency: 276, sentiment: 0.78, platforms: '["linkedin", "facebook"]', trend: 'up' },
        { trigram: 'remote work productivity', frequency: 245, sentiment: 0.34, platforms: '["linkedin", "twitter"]', trend: 'stable' },
        { trigram: 'e commerce growth', frequency: 234, sentiment: 0.59, platforms: '["facebook", "instagram"]', trend: 'up' },
        { trigram: 'digital transformation strategy', frequency: 212, sentiment: 0.43, platforms: '["linkedin", "twitter"]', trend: 'up' }
      ];

      for (const trigram of sampleTrigrams) {
        await unifiedDb.query(`
          INSERT INTO trigrams (trigram, frequency, sentiment, platforms, trend, average_engagement)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          trigram.trigram,
          trigram.frequency,
          trigram.sentiment,
          trigram.platforms,
          trigram.trend,
          Math.round(((trigram.frequency / 1247) * 4 + Math.abs(trigram.sentiment)) * 100) / 100 // Deterministic engagement derived from frequency and sentiment
        ]);
      }

      console.log('Sample trigrams data seeded successfully');
    } catch (error) {
      console.error('Error seeding trigrams data:', error);
    }
  }

  private getFallbackTrigramsData(): TrigramData[] {
    return [
      { trigram: 'social media marketing', frequency: 1247, sentiment: 0.72, platforms: ['twitter', 'facebook'], trend: 'up', firstSeen: '2024-01-01', lastSeen: '2024-01-08', averageEngagement: 4.2, topPosts: [] },
      { trigram: 'artificial intelligence technology', frequency: 892, sentiment: 0.65, platforms: ['twitter', 'linkedin'], trend: 'up', firstSeen: '2024-01-02', lastSeen: '2024-01-08', averageEngagement: 3.8, topPosts: [] },
      { trigram: 'climate change impact', frequency: 734, sentiment: -0.23, platforms: ['twitter', 'instagram'], trend: 'stable', firstSeen: '2024-01-01', lastSeen: '2024-01-07', averageEngagement: 3.1, topPosts: [] },
      { trigram: 'new product launch', frequency: 623, sentiment: 0.81, platforms: ['facebook', 'instagram'], trend: 'up', firstSeen: '2024-01-03', lastSeen: '2024-01-08', averageEngagement: 4.5, topPosts: [] },
      { trigram: 'customer service experience', frequency: 567, sentiment: -0.15, platforms: ['twitter', 'facebook'], trend: 'down', firstSeen: '2024-01-01', lastSeen: '2024-01-06', averageEngagement: 2.7, topPosts: [] }
    ];
  }

  async exportTrigramsData(filters: TrigramFilters = {}): Promise<string> {
    const trigramsData = await this.getTrigramsData(filters);
    
    const csvHeader = 'Trigram,Frequency,Sentiment,Sentiment Label,Platforms,Trend,First Seen,Last Seen,Average Engagement';
    const csvRows = trigramsData.map(trigram => {
      const sentimentLabel = trigram.sentiment > 0.3 ? 'Positive' : 
                           trigram.sentiment < -0.3 ? 'Negative' : 'Neutral';
      
      return [
        `"${trigram.trigram}"`,
        trigram.frequency,
        trigram.sentiment.toFixed(2),
        sentimentLabel,
        `"${trigram.platforms.join('; ')}"`,
        trigram.trend,
        trigram.firstSeen,
        trigram.lastSeen,
        trigram.averageEngagement.toFixed(1)
      ].join(',');
    });

    return [csvHeader, ...csvRows].join('\n');
  }
}

export const trigramsDb = new TrigramsDatabase();