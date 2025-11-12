// Database Seeding API
// Populates the unified database with sample data for testing

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DuckDBInstance } from '@duckdb/node-api';
import { join } from 'path';

// Direct DuckDB connection for server-side operations
let db: DuckDBInstance | null = null;

async function getDb() {
  if (!db) {
    const dbPath = join(process.cwd(), 'unified_social_analytics.db');
    db = await DuckDBInstance.create(dbPath);
  }
  return db;
}

async function executeQuery(sql: string): Promise<any[]> {
  try {
    const database = await getDb();
    const connection = await database.connect();
    const result = await connection.runAndReadAll(sql);
    const rows = result.getRowObjectsJS();
    connection.closeSync();
    return rows;
  } catch (error) {
    console.error('Direct DuckDB query error:', error);
    return [];
  }
}

/**
 * POST /api/unified-analytics/seed
 * Seed the database with sample data
 */
export const POST: RequestHandler = async () => {
  try {
    await getDb();
    
    // Clear existing data
    console.log('Clearing existing data...');
    await executeQuery('DELETE FROM sentiment_classifications');
    await executeQuery('DELETE FROM emotion_analysis');
    await executeQuery('DELETE FROM sentiment_temporal_trends');
    await executeQuery('DELETE FROM posts');
    await executeQuery('DELETE FROM data_sources');
    await executeQuery('DELETE FROM crawlers');
    
    // Insert sample data sources
    console.log('Inserting data sources...');
    await executeQuery(`
      INSERT INTO data_sources (id, name, platform, status, health_score, last_sync) VALUES
      (1, 'Twitter Analytics', 'twitter', 'active', 95, CURRENT_TIMESTAMP),
      (2, 'Facebook Insights', 'facebook', 'active', 88, CURRENT_TIMESTAMP),
      (3, 'Instagram Data', 'instagram', 'active', 92, CURRENT_TIMESTAMP)
    `);
    
    // Insert sample posts
    console.log('Inserting sample posts...');
    const posts = [
      { id: 1, source: 1, content: "Absolutely love the new AI features! This is revolutionary technology that will change everything. #AI #Innovation", author: "tech_enthusiast_2024" },
      { id: 2, source: 1, content: "I'm so disappointed with the service quality lately. Customer support is terrible and nothing works properly.", author: "frustrated_customer" },
      { id: 3, source: 2, content: "Just had an okay experience at the store. Nothing special but not bad either.", author: "neutral_reviewer" },
      { id: 4, source: 2, content: "This is the best product I've ever purchased! Highly recommend to everyone. Five stars!", author: "happy_buyer" },
      { id: 5, source: 3, content: "Terrible weather today. Everything is going wrong and I'm feeling really down about it.", author: "weather_watcher" },
      { id: 6, source: 3, content: "Beautiful sunset tonight! Feeling grateful for these peaceful moments in life.", author: "nature_lover" },
      { id: 7, source: 1, content: "The quarterly report shows steady growth. Market conditions remain stable.", author: "business_analyst" },
      { id: 8, source: 2, content: "Excited about the upcoming conference! Can't wait to learn new technologies and network.", author: "conference_goer" },
      { id: 9, source: 1, content: "System outage again! This is becoming a serious problem affecting productivity.", author: "dev_ops_admin" },
      { id: 10, source: 3, content: "Regular day at the office. Meeting went fine, nothing particularly noteworthy.", author: "office_worker" }
    ];
    
    for (const post of posts) {
      await executeQuery(`
        INSERT INTO posts (id, data_source_id, external_id, content, author, post_type, language, created_at) VALUES
        (${post.id}, ${post.source}, 'ext_${post.id}', '${post.content.replace(/'/g, "''")}', '${post.author}', 'post', 'en', CURRENT_TIMESTAMP - INTERVAL '${Math.floor(Math.random() * 30)} days')
      `);
    }
    
    // Insert sentiment classifications
    console.log('Inserting sentiment classifications...');
    const sentiments = [
      { post_id: 1, category: 'Very Positive', confidence: 0.92 },
      { post_id: 2, category: 'Very Negative', confidence: 0.89 },
      { post_id: 3, category: 'Neutral', confidence: 0.75 },
      { post_id: 4, category: 'Very Positive', confidence: 0.95 },
      { post_id: 5, category: 'Negative', confidence: 0.85 },
      { post_id: 6, category: 'Positive', confidence: 0.88 },
      { post_id: 7, category: 'Neutral', confidence: 0.72 },
      { post_id: 8, category: 'Positive', confidence: 0.90 },
      { post_id: 9, category: 'Negative', confidence: 0.83 },
      { post_id: 10, category: 'Neutral', confidence: 0.68 }
    ];
    
    for (const sentiment of sentiments) {
      await executeQuery(`
        INSERT INTO sentiment_classifications (post_id, sentiment_category, confidence_score, analysis_model, classification_timestamp) VALUES
        (${sentiment.post_id}, '${sentiment.category}', ${sentiment.confidence}, 'AI_SENTIMENT_V1', CURRENT_TIMESTAMP - INTERVAL '${Math.floor(Math.random() * 30)} days')
      `);
    }
    
    // Insert temporal trends (last 7 days)
    console.log('Inserting temporal trends...');
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const platforms = ['twitter', 'facebook', 'instagram'];
      for (const platform of platforms) {
        for (let hour = 0; hour < 24; hour += 6) { // Every 6 hours
          const positive = Math.floor(Math.random() * 20) + 10;
          const negative = Math.floor(Math.random() * 15) + 5;
          const neutral = Math.floor(Math.random() * 25) + 15;
          const total = positive + negative + neutral;
          const avgConf = (Math.random() * 0.3) + 0.65; // 0.65-0.95
          
          await executeQuery(`
            INSERT INTO sentiment_temporal_trends (analysis_date, analysis_hour, platform, positive_count, negative_count, neutral_count, total_posts, avg_confidence) VALUES
            ('${dateStr}', ${hour}, '${platform}', ${positive}, ${negative}, ${neutral}, ${total}, ${avgConf})
          `);
        }
      }
    }
    
    // Verify data was inserted
    const postCount = await executeQuery('SELECT COUNT(*) as count FROM posts');
    const sentimentCount = await executeQuery('SELECT COUNT(*) as count FROM sentiment_classifications');
    const trendCount = await executeQuery('SELECT COUNT(*) as count FROM sentiment_temporal_trends');
    
    console.log('Database seeded successfully!');
    
    return json({
      success: true,
      message: 'Database seeded with sample data',
      stats: {
        posts: postCount[0]?.count || 0,
        sentiments: sentimentCount[0]?.count || 0,
        trends: trendCount[0]?.count || 0
      }
    });
    
  } catch (error) {
    console.error('Database seeding failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to seed database'
    }, { status: 500 });
  }
};