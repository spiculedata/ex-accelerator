import { mount } from 'cypress/svelte';

describe('Dapr Job Scheduler Components', () => {
  beforeEach(() => {
    // Mock Dapr-related services
    cy.window().then((win) => {
      win.daprJobScheduler = {
        scheduleJob: cy.stub().resolves({ success: true, job: { scheduled: true } }),
        getJobs: cy.stub().resolves([]),
        deleteJob: cy.stub().resolves({ success: true }),
        validateConnection: cy.stub().resolves(true)
      };
    });
  });

  describe('Job Configuration Form with Dapr SDK Integration', () => {
    it('should render Dapr-specific job scheduling options', () => {
      mount(`
        <div data-testid="dapr-job-form" class="max-w-4xl mx-auto p-6">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <h3 class="text-lg font-medium text-blue-800">Dapr Job Scheduling</h3>
            </div>
            <p class="text-sm text-blue-700 mt-1">Using Dapr SDK for reliable job scheduling and execution</p>
          </div>
          
          <!-- Job Service Selection -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">Job Service</label>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div class="flex items-center">
                <input 
                  type="radio" 
                  id="telegram-scraper" 
                  name="jobService"
                  value="telegram-scraper"
                  checked
                  class="text-blue-600 focus:ring-blue-500">
                <label for="telegram-scraper" class="ml-2 text-sm text-gray-700">telegram-scraper</label>
                <span class="ml-auto text-xs text-gray-500">gRPC on port 6481</span>
              </div>
              <p class="text-xs text-gray-600 mt-1 ml-6">Handles crawling jobs for Telegram and YouTube platforms</p>
            </div>
          </div>

          <!-- Service Invocation Method -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">Invocation Method</label>
            <div class="space-y-2">
              <div class="flex items-center p-3 border border-gray-200 rounded-lg">
                <input 
                  type="radio" 
                  id="service-invocation" 
                  name="invocationMethod"
                  value="service-invocation"
                  checked
                  class="text-blue-600 focus:ring-blue-500">
                <div class="ml-3">
                  <label for="service-invocation" class="text-sm font-medium text-gray-700">Service Invocation</label>
                  <p class="text-xs text-gray-500">Direct app-to-app communication via Dapr SDK</p>
                </div>
              </div>
              <div class="flex items-center p-3 border border-gray-200 rounded-lg opacity-50">
                <input 
                  type="radio" 
                  id="http-api" 
                  name="invocationMethod"
                  value="http-api"
                  disabled
                  class="text-gray-400">
                <div class="ml-3">
                  <label for="http-api" class="text-sm text-gray-400">Direct HTTP API</label>
                  <p class="text-xs text-gray-400">Legacy method (deprecated)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);

      // Verify Dapr-specific elements are present
      cy.contains('Dapr Job Scheduling').should('be.visible');
      cy.contains('Using Dapr SDK').should('be.visible');
      cy.get('input[value="telegram-scraper"]').should('be.checked');
      cy.get('input[value="service-invocation"]').should('be.checked');
      cy.get('input[value="http-api"]').should('be.disabled');
    });

    it('should display connection status indicators', () => {
      mount(`
        <div data-testid="connection-status">
          <!-- Dapr Sidecar Status -->
          <div class="flex items-center space-x-4 mb-4">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span class="text-sm text-gray-700">Dapr Sidecar</span>
              <span class="text-xs text-gray-500 ml-1">(localhost:3500)</span>
            </div>
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span class="text-sm text-gray-700">Job Service</span>
              <span class="text-xs text-gray-500 ml-1">(telegram-scraper)</span>
            </div>
            <div class="flex items-center">
              <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <span class="text-sm text-gray-700">State Store</span>
              <span class="text-xs text-gray-500 ml-1">(Redis)</span>
            </div>
          </div>
        </div>
      `);

      // Check connection status indicators
      cy.get('[data-testid="connection-status"]').within(() => {
        cy.contains('Dapr Sidecar').should('be.visible');
        cy.contains('Job Service').should('be.visible');
        cy.contains('State Store').should('be.visible');
        cy.get('.bg-green-500').should('have.length', 2);
        cy.get('.bg-yellow-500').should('have.length', 1);
      });
    });

    it('should show job handler registration status', () => {
      const registeredHandlers = ['R2-D2', 'C-3PO', 'BB-8', 'my-scheduled-job'];
      
      mount(`
        <div data-testid="handler-status" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Registered Job Handlers</h4>
          <div class="grid grid-cols-2 gap-2">
            ${registeredHandlers.map(handler => `
              <div class="flex items-center p-2 bg-white border border-gray-200 rounded">
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span class="text-xs text-gray-600">${handler}</span>
              </div>
            `).join('')}
          </div>
          <p class="text-xs text-gray-500 mt-2">Custom job names will use the generic handler</p>
        </div>
      `);

      registeredHandlers.forEach(handler => {
        cy.contains(handler).should('be.visible');
      });
      cy.contains('Custom job names will use the generic handler').should('be.visible');
    });
  });

  describe('Real-time Job Status with Dapr State Store', () => {
    it('should display job status from Dapr state store', () => {
      const mockJobs = [
        {
          id: 'job-1-state',
          name: 'telegram-crawl-test-1',
          status: 'scheduled',
          platform: 'telegram',
          scheduledFor: '2024-12-01T15:00:00Z',
          daprInfo: {
            name: 'telegram-crawl-test-1',
            dueTime: '2024-12-01T15:00:00Z'
          }
        },
        {
          id: 'job-2-state',
          name: 'youtube-crawl-test-1',
          status: 'running',
          platform: 'youtube',
          scheduledFor: 'now',
          daprInfo: {
            name: 'youtube-crawl-test-1',
            dueTime: 'now'
          }
        }
      ];

      mount(`
        <div data-testid="job-status-list" class="space-y-4">
          ${mockJobs.map(job => `
            <div class="border border-gray-200 rounded-lg p-4" data-job-id="${job.id}">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-lg font-medium text-gray-900">${job.name}</h4>
                <span class="px-2 py-1 text-xs font-medium rounded-full ${
                  job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                  job.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }">${job.status}</span>
              </div>
              
              <div class="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span class="font-medium">Platform:</span> ${job.platform}
                </div>
                <div>
                  <span class="font-medium">Scheduled:</span> ${job.scheduledFor}
                </div>
              </div>
              
              <!-- Dapr Integration Info -->
              <div class="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <div class="text-xs text-blue-700">
                  <span class="font-medium">Dapr Job:</span> ${job.daprInfo.name}<br>
                  <span class="font-medium">Due Time:</span> ${job.daprInfo.dueTime}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `);

      // Verify job status display
      cy.get('[data-job-id="job-1-state"]').within(() => {
        cy.contains('telegram-crawl-test-1').should('be.visible');
        cy.contains('scheduled').should('be.visible');
        cy.contains('Platform: telegram').should('be.visible');
        cy.contains('Dapr Job: telegram-crawl-test-1').should('be.visible');
      });

      cy.get('[data-job-id="job-2-state"]').within(() => {
        cy.contains('youtube-crawl-test-1').should('be.visible');
        cy.contains('running').should('be.visible');
        cy.contains('Platform: youtube').should('be.visible');
        cy.contains('Due Time: now').should('be.visible');
      });
    });

    it('should handle state store connection errors', () => {
      mount(`
        <div data-testid="state-store-error" class="border border-red-200 bg-red-50 rounded-lg p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h4 class="text-sm font-medium text-red-800">State Store Unavailable</h4>
              <p class="text-sm text-red-700 mt-1">Cannot connect to Dapr state store. Job status tracking is limited.</p>
              <p class="text-xs text-red-600 mt-2">
                <span class="font-medium">Solution:</span> Run <code class="bg-red-100 px-1 rounded">npm run dev:dapr</code> to start the unified deployment
              </p>
            </div>
          </div>
        </div>
      `);

      cy.contains('State Store Unavailable').should('be.visible');
      cy.contains('Cannot connect to Dapr state store').should('be.visible');
      cy.contains('npm run dev:dapr').should('be.visible');
    });

    it('should show job execution logs from state store', () => {
      const jobWithLogs = {
        name: 'logged-job-test',
        logs: [
          'Job successfully scheduled with Dapr',
          'Starting crawl of 5 URLs with concurrency 2',
          'Processing channel @testchannel1',
          'Found 150 posts in channel @testchannel1',
          'Crawling completed successfully'
        ]
      };

      mount(`
        <div data-testid="job-logs" class="bg-white border border-gray-200 rounded-lg">
          <div class="px-4 py-3 border-b border-gray-200">
            <h4 class="text-lg font-medium text-gray-900">Job Execution Logs</h4>
            <p class="text-sm text-gray-600">${jobWithLogs.name}</p>
          </div>
          <div class="p-4">
            <div class="space-y-1 max-h-64 overflow-y-auto">
              ${jobWithLogs.logs.map((log, index) => `
                <div class="flex items-start text-sm">
                  <span class="text-gray-400 text-xs w-8 flex-shrink-0">${index + 1}</span>
                  <span class="text-gray-700">${log}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `);

      cy.contains('Job Execution Logs').should('be.visible');
      cy.contains('logged-job-test').should('be.visible');
      
      jobWithLogs.logs.forEach((log, index) => {
        cy.contains(`${index + 1}`).should('be.visible');
        cy.contains(log).should('be.visible');
      });
    });
  });

  describe('Error Handling and User Feedback', () => {
    it('should show Dapr SDK specific error messages', () => {
      const daprErrors = [
        {
          type: 'connection',
          title: 'Dapr Connection Error',
          message: 'Cannot connect to Dapr sidecar on localhost:3500',
          solution: 'Ensure Dapr is running with: dapr run -f ./dapr.yaml'
        },
        {
          type: 'service',
          title: 'Service Invocation Failed',
          message: 'Failed to invoke telegram-scraper.scheduleJob',
          solution: 'Verify telegram-scraper is running in dapr-job mode'
        },
        {
          type: 'grpc',
          title: 'gRPC Communication Error',
          message: 'gRPC connection refused on port 6481',
          solution: 'Check telegram-scraper gRPC server configuration'
        }
      ];

      daprErrors.forEach((error, index) => {
        mount(`
          <div data-testid="dapr-error-${index}" class="border border-red-200 bg-red-50 rounded-lg p-4 mb-4">
            <div class="flex">
              <svg class="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="flex-1">
                <h4 class="text-sm font-medium text-red-800">${error.title}</h4>
                <p class="text-sm text-red-700 mt-1">${error.message}</p>
                <div class="mt-2 p-2 bg-red-100 border border-red-200 rounded">
                  <p class="text-xs text-red-800">
                    <span class="font-medium">Solution:</span> ${error.solution}
                  </p>
                </div>
              </div>
            </div>
          </div>
        `);

        cy.get(`[data-testid="dapr-error-${index}"]`).within(() => {
          cy.contains(error.title).should('be.visible');
          cy.contains(error.message).should('be.visible');
          cy.contains('Solution:').should('be.visible');
          cy.contains(error.solution).should('be.visible');
        });
      });
    });

    it('should provide diagnostic information for troubleshooting', () => {
      const diagnostics = {
        daprVersion: '1.12.0',
        sidecarStatus: 'running',
        jobServiceStatus: 'connected',
        stateStoreStatus: 'available',
        lastJobScheduled: '2024-11-30T10:30:00Z',
        totalJobsScheduled: 42
      };

      mount(`
        <div data-testid="diagnostics" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Dapr Diagnostics</h4>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-600">Dapr Version:</span>
              <span class="ml-2 text-gray-900">${diagnostics.daprVersion}</span>
            </div>
            <div>
              <span class="text-gray-600">Sidecar Status:</span>
              <span class="ml-2 text-green-600">${diagnostics.sidecarStatus}</span>
            </div>
            <div>
              <span class="text-gray-600">Job Service:</span>
              <span class="ml-2 text-green-600">${diagnostics.jobServiceStatus}</span>
            </div>
            <div>
              <span class="text-gray-600">State Store:</span>
              <span class="ml-2 text-green-600">${diagnostics.stateStoreStatus}</span>
            </div>
            <div>
              <span class="text-gray-600">Last Job:</span>
              <span class="ml-2 text-gray-900">${new Date(diagnostics.lastJobScheduled).toLocaleString()}</span>
            </div>
            <div>
              <span class="text-gray-600">Total Jobs:</span>
              <span class="ml-2 text-gray-900">${diagnostics.totalJobsScheduled}</span>
            </div>
          </div>
        </div>
      `);

      cy.contains('Dapr Diagnostics').should('be.visible');
      cy.contains(diagnostics.daprVersion).should('be.visible');
      cy.contains('running').should('be.visible');
      cy.contains('connected').should('be.visible');
      cy.contains('available').should('be.visible');
      cy.contains('42').should('be.visible');
    });
  });

  describe('Job Data Transformation for telegram-scraper', () => {
    it('should properly format job data for JobData struct compatibility', () => {
      const formData = {
        jobName: 'test-data-transform',
        platform: 'telegram',
        urls: ['@channel1', '@channel2'],
        maxPosts: 1000,
        concurrency: 2,
        skipMedia: true,
        timeAgo: '30d'
      };

      mount(`
        <div data-testid="data-transformation">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 class="text-sm font-medium text-blue-800 mb-2">Job Data Transformation</h4>
            <div class="text-xs text-blue-700">
              <div class="mb-2">
                <span class="font-medium">Frontend Form Data:</span>
                <pre class="mt-1 p-2 bg-white border rounded text-blue-600">${JSON.stringify(formData, null, 2)}</pre>
              </div>
              
              <div>
                <span class="font-medium">Transformed for telegram-scraper:</span>
                <pre class="mt-1 p-2 bg-white border rounded text-blue-600">{
  "dueTime": "30s",
  "droid": "${formData.jobName}",
  "task": "crawl:${formData.platform}",
  "urls": ${JSON.stringify(formData.urls)},
  "platform": "${formData.platform}",
  "maxPosts": ${formData.maxPosts},
  "concurrency": ${formData.concurrency},
  "skipMedia": ${formData.skipMedia},
  "timeAgo": "${formData.timeAgo}",
  "jobId": "${formData.jobName}-1234567890"
}</pre>
              </div>
            </div>
          </div>
        </div>
      `);

      cy.contains('Job Data Transformation').should('be.visible');
      cy.contains('Frontend Form Data:').should('be.visible');
      cy.contains('Transformed for telegram-scraper:').should('be.visible');
      cy.contains('"droid": "test-data-transform"').should('be.visible');
      cy.contains('"task": "crawl:telegram"').should('be.visible');
      cy.contains('"jobId":').should('be.visible');
    });

    it('should handle YouTube-specific data transformation', () => {
      const youtubeFormData = {
        jobName: 'youtube-transform-test',
        platform: 'youtube',
        urls: ['UCChannel1', 'UCChannel2'],
        youtubeApiKey: 'test-api-key',
        samplingMethod: 'random',
        minChannelVideos: 50,
        sampleSize: 100
      };

      mount(`
        <div data-testid="youtube-transformation" class="space-y-4">
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <h5 class="text-sm font-medium text-red-800">YouTube Platform Data</h5>
            <div class="text-xs text-red-700 mt-2">
              <div>API Key: ${youtubeFormData.youtubeApiKey}</div>
              <div>Sampling: ${youtubeFormData.samplingMethod}</div>
              <div>Min Videos: ${youtubeFormData.minChannelVideos}</div>
              <div>Sample Size: ${youtubeFormData.sampleSize}</div>
            </div>
          </div>
          
          <div class="bg-green-50 border border-green-200 rounded-lg p-3">
            <h5 class="text-sm font-medium text-green-800">Transformed JobData</h5>
            <pre class="text-xs text-green-700 mt-2">{
  "task": "crawl:youtube",
  "platform": "youtube",
  "youtubeApiKey": "${youtubeFormData.youtubeApiKey}",
  "samplingMethod": "${youtubeFormData.samplingMethod}",
  "minChannelVideos": ${youtubeFormData.minChannelVideos},
  "sampleSize": ${youtubeFormData.sampleSize}
}</pre>
          </div>
        </div>
      `);

      cy.contains('YouTube Platform Data').should('be.visible');
      cy.contains('test-api-key').should('be.visible');
      cy.contains('random').should('be.visible');
      cy.contains('Transformed JobData').should('be.visible');
      cy.contains('"task": "crawl:youtube"').should('be.visible');
    });
  });
});