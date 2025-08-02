// Unified Analytics API
// Test endpoint for unified DuckDB connection and dataset queries

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { databaseInit } from '$lib/services/databaseInit';

/**
 * GET /api/unified-analytics
 * Test connection and basic queries for unified analytics
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const type = url.searchParams.get('type');
    
    if (type === 'test') {
      // Test database connection
      const isConnected = await databaseInit.testConnection();
      
      if (isConnected) {
        return json({
          success: true,
          message: 'Unified DuckDB Service connected',
          timestamp: new Date().toISOString()
        });
      } else {
        return json({
          success: false,
          error: 'Database connection failed',
          message: 'Could not connect to unified database'
        });
      }
    }
    
    if (type === 'datasets') {
      // Return mock datasets for now since we don't have real data tables yet
      return json({
        success: true,
        datasets: [
          {
            id: 'sample_social',
            name: 'Sample Social Media Data',
            description: 'Sample dataset for testing workflows',
            table: 'posts',
            type: 'sample'
          }
        ]
      });
    }
    
    // Default response for other queries
    return json({
      success: true,
      message: 'Unified analytics API is available',
      endpoints: {
        test: '/api/unified-analytics?type=test',
        datasets: '/api/unified-analytics?type=datasets'
      }
    });
  } catch (err) {
    console.error('Unified analytics API error:', err);
    return json({
      success: false,
      error: err.message,
      message: 'Failed to process unified analytics request'
    });
  }
};