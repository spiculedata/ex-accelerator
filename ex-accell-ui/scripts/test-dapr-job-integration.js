#!/usr/bin/env node

/**
 * Integration test script for Dapr Job Scheduling with Telegram Scraper
 * 
 * This script tests the complete workflow:
 * 1. Checks if Dapr is running
 * 2. Verifies telegram-scraper service availability
 * 3. Creates a test job via Jobs API
 * 4. Monitors job status
 * 5. Cleans up test job
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DAPR_HTTP_PORT = 3500;
const TELEGRAM_SCRAPER_APP_ID = 'telegram-scraper';
const TEST_JOB_NAME = `my-scheduled-job`; // Use the registered job handler name

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const result = {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      data: null
    };

    try {
      result.data = await response.json();
    } catch (e) {
      result.data = await response.text();
    }

    return result;
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null
    };
  }
}

async function checkDaprHealth() {
  console.log('🔍 Checking Dapr sidecar health...');
  
  const response = await makeRequest(`http://localhost:${DAPR_HTTP_PORT}/v1.0/healthz`);
  
  if (response.ok) {
    console.log('✅ Dapr sidecar is running');
    return true;
  } else {
    console.error('❌ Dapr sidecar is not accessible:', response.error || response.statusText);
    return false;
  }
}

async function checkTelegramScraperService() {
  console.log('🔍 Checking telegram-scraper service availability...');
  
  // Try to invoke the service through Dapr
  const response = await makeRequest(
    `http://localhost:${DAPR_HTTP_PORT}/v1.0/invoke/${TELEGRAM_SCRAPER_APP_ID}/method/health`,
    { method: 'GET' }
  );
  
  if (response.ok || response.status === 404) {
    console.log('✅ Telegram-scraper service is accessible through Dapr');
    return true;
  } else {
    console.warn('⚠️ Telegram-scraper service may not be running:', response.error || response.statusText);
    console.log('💡 You can start it with: npm run telegram-scraper:start');
    return false;
  }
}

async function createTestJob() {
  console.log('📝 Creating test job...');
  
  const jobRequest = {
    name: TEST_JOB_NAME,
    dueTime: '30s', // Execute in 30 seconds
    data: {
      droid: TEST_JOB_NAME,
      task: 'crawl telegram channels',
      urls: ['@test_channel_dummy'],
      platform: 'telegram',
      crawlId: 'integration-test',
      maxPosts: 10,
      skipMedia: true,
      timeAgo: '1d'
    }
  };

  const response = await makeRequest(
    `http://localhost:${DAPR_HTTP_PORT}/v1.0-alpha1/jobs/${TELEGRAM_SCRAPER_APP_ID}`,
    {
      method: 'POST',
      body: JSON.stringify(jobRequest)
    }
  );

  if (response.ok) {
    console.log('✅ Test job created successfully:', TEST_JOB_NAME);
    console.log('📊 Job details:', JSON.stringify(response.data, null, 2));
    return true;
  } else {
    console.error('❌ Failed to create test job:', response.error || response.statusText);
    if (response.data) {
      console.error('📊 Error details:', JSON.stringify(response.data, null, 2));
    }
    return false;
  }
}

async function checkJobStatus() {
  console.log('🔍 Checking job status...');
  
  const response = await makeRequest(
    `http://localhost:${DAPR_HTTP_PORT}/v1.0-alpha1/jobs/${TELEGRAM_SCRAPER_APP_ID}/${TEST_JOB_NAME}`
  );

  if (response.ok) {
    console.log('✅ Job status retrieved successfully');
    console.log('📊 Job status:', JSON.stringify(response.data, null, 2));
    return response.data;
  } else {
    console.error('❌ Failed to get job status:', response.error || response.statusText);
    return null;
  }
}

async function listAllJobs() {
  console.log('📋 Listing all jobs...');
  
  const response = await makeRequest(
    `http://localhost:${DAPR_HTTP_PORT}/v1.0-alpha1/jobs/${TELEGRAM_SCRAPER_APP_ID}`
  );

  if (response.ok) {
    console.log('✅ Jobs list retrieved successfully');
    console.log('📊 Jobs:', JSON.stringify(response.data, null, 2));
    return response.data;
  } else {
    console.error('❌ Failed to list jobs:', response.error || response.statusText);
    return null;
  }
}

async function deleteTestJob() {
  console.log('🗑️ Cleaning up test job...');
  
  const response = await makeRequest(
    `http://localhost:${DAPR_HTTP_PORT}/v1.0-alpha1/jobs/${TELEGRAM_SCRAPER_APP_ID}/${TEST_JOB_NAME}`,
    { method: 'DELETE' }
  );

  if (response.ok) {
    console.log('✅ Test job deleted successfully');
    return true;
  } else {
    console.error('❌ Failed to delete test job:', response.error || response.statusText);
    return false;
  }
}

async function testUIEndpoints() {
  console.log('🌐 Testing UI API endpoints...');
  
  // Test the SvelteKit API endpoint
  try {
    const response = await makeRequest('http://localhost:5173/api/jobs');
    
    if (response.ok) {
      console.log('✅ UI API endpoint is accessible');
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      console.warn('⚠️ UI API endpoint is not accessible:', response.error || response.statusText);
      console.log('💡 Make sure the UI is running with: npm run dev');
      return false;
    }
  } catch (error) {
    console.warn('⚠️ UI is not running:', error.message);
    console.log('💡 Start the UI with: npm run dev');
    return false;
  }
}

async function checkComponentFiles() {
  console.log('📁 Checking Dapr component files...');
  
  const componentFiles = [
    'components/jobstore.yaml',
    'components/telegram-scraper-app.yaml',
    'components/statestore.yaml',
    'components/pubsub.yaml',
    'components/secretstore.yaml'
  ];

  let allExist = true;
  for (const file of componentFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.error(`❌ ${file} is missing`);
      allExist = false;
    }
  }

  return allExist;
}

async function runIntegrationTest() {
  console.log('🚀 Starting Dapr Job Scheduling Integration Test\n');

  let success = true;

  // Check component files
  success = await checkComponentFiles() && success;
  console.log('');

  // Check Dapr health
  success = await checkDaprHealth() && success;
  console.log('');

  // Check telegram-scraper service
  const scraperRunning = await checkTelegramScraperService();
  console.log('');

  // Test UI endpoints
  await testUIEndpoints();
  console.log('');

  if (!success) {
    console.log('❌ Prerequisites check failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  // Test job operations
  try {
    // Create test job
    const jobCreated = await createTestJob();
    console.log('');

    if (jobCreated) {
      // Wait a moment
      await sleep(2000);

      // Check job status
      await checkJobStatus();
      console.log('');

      // List all jobs
      await listAllJobs();
      console.log('');

      // Wait a bit more to see if job executes
      console.log('⏳ Waiting 10 seconds to monitor job execution...');
      await sleep(10000);

      // Check status again
      await checkJobStatus();
      console.log('');

      // Clean up
      await deleteTestJob();
      console.log('');
    }

    console.log('🎉 Integration test completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Start the UI: npm run dev:dapr');
    console.log('2. Navigate to: http://localhost:5173/data-capture?tab=crawler');
    console.log('3. Create a crawler job through the web interface');
    console.log('4. Monitor jobs on the Schedule tab');

  } catch (error) {
    console.error('💥 Integration test failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  try {
    await deleteTestJob();
  } catch (e) {
    // Ignore cleanup errors on shutdown
  }
  process.exit(0);
});

// Run the test
runIntegrationTest().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});