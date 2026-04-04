// Test Dapr Connection API
// Debug endpoint to check Dapr sidecar connectivity

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/test-dapr-connection
 * Test Dapr sidecar connectivity and return detailed information
 */
export const GET: RequestHandler = async () => {
  try {
    const results = {
      environment: {
        DAPR_HTTP_PORT: process.env.DAPR_HTTP_PORT,
        DAPR_GRPC_PORT: process.env.DAPR_GRPC_PORT,
        APP_ID: process.env.APP_ID,
        NODE_ENV: process.env.NODE_ENV
      },
      tests: [] as any[]
    };

    // Test common Dapr ports
    const portsToTest = [3500, 3501, 3502];
    
    for (const port of portsToTest) {
      const endpoints = [
        `http://localhost:${port}/v1.0/metadata`,
        `http://localhost:${port}/v1.0/healthz`,
        `http://localhost:${port}/`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { 
            signal: AbortSignal.timeout(2000)
          });
          
          let responseText = '';
          try {
            responseText = await response.text();
          } catch (e) {
            responseText = 'Could not read response body';
          }

          results.tests.push({
            endpoint,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseText.length > 500 ? responseText.substring(0, 500) + '...' : responseText
          });

          if (response.ok) {
            console.log(`✓ Dapr sidecar found at ${endpoint}`);
          }
        } catch (fetchError: any) {
          results.tests.push({
            endpoint,
            error: fetchError.message,
            type: fetchError.constructor.name
          });
        }
      }
    }

    // Check if any tests passed
    const workingEndpoints = results.tests.filter(test => test.ok);
    
    return json({
      success: workingEndpoints.length > 0,
      daprAvailable: workingEndpoints.length > 0,
      workingEndpoints: workingEndpoints.map(t => t.endpoint),
      ...results
    });

  } catch (err) {
    console.error('Error testing Dapr connection:', err);
    return error(500, `Failed to test Dapr connection: ${err instanceof Error ? err.message : String(err)}`);
  }
};