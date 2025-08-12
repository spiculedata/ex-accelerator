describe('Job Scheduler API - Dapr SDK Integration', () => {
  beforeEach(() => {
    // Set up common test environment
    cy.window().then((win) => {
      // Mock console methods to prevent test pollution
      win.console = {
        ...win.console,
        log: cy.stub(),
        error: cy.stub(),
        warn: cy.stub(),
        info: cy.stub()
      };
    });
  });

  describe('POST /api/jobs - Dapr SDK Job Scheduling', () => {
    it('should successfully schedule a job using Dapr SDK service invocation', () => {
      const jobRequest = {
        name: 'test-job-sdk-integration',
        dueTime: '30s',
        data: {
          droid: 'test-job-sdk-integration',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@testchannel1', '@testchannel2'],
          crawlId: 'test-crawl-001',
          maxPosts: 1000,
          concurrency: 2
        }
      };

      // Mock successful Dapr SDK response
      cy.intercept('POST', '/api/jobs', {
        statusCode: 200,
        body: {
          success: true,
          job: {
            scheduled: true,
            jobName: 'test-job-sdk-integration',
            method: 'dapr-sdk'
          },
          jobId: `${jobRequest.name}-${Date.now()}`,
          jobState: {
            id: `${jobRequest.name}-${Date.now()}`,
            name: jobRequest.name,
            status: 'scheduled',
            platform: 'telegram'
          },
          message: 'Job scheduled successfully'
        }
      }).as('scheduleJobSDK');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: jobRequest
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.job.method).to.eq('dapr-sdk');
        expect(response.body.job.jobName).to.eq(jobRequest.name);
        expect(response.body.message).to.eq('Job scheduled successfully');
      });
    });

    it('should handle Dapr SDK connection errors gracefully', () => {
      const jobRequest = {
        name: 'test-job-connection-error',
        dueTime: '1m',
        data: {
          droid: 'test-job-connection-error',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@testchannel']
        }
      };

      // Mock Dapr SDK connection error
      cy.intercept('POST', '/api/jobs', {
        statusCode: 503,
        body: {
          message: 'Job scheduling service unavailable',
          details: 'Cannot connect to Dapr job scheduler. Please ensure the unified deployment is running.',
          action: 'Run: npm run dev:dapr'
        }
      }).as('connectionError');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: jobRequest,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(503);
        expect(response.body.message).to.include('service unavailable');
        expect(response.body.action).to.include('npm run dev:dapr');
      });
    });

    it('should properly format job data for telegram-scraper JobData struct', () => {
      const jobRequest = {
        name: 'telegram-job-format-test',
        dueTime: '2h',
        data: {
          droid: 'telegram-job-format-test',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@channel1', '@channel2'],
          crawlId: 'format-test-001',
          maxDepth: 3,
          concurrency: 4,
          maxPosts: 500,
          skipMedia: true,
          timeAgo: '30d'
        }
      };

      cy.intercept('POST', '/api/jobs', (req) => {
        // Verify the request body matches expected JobData format
        expect(req.body.name).to.eq(jobRequest.name);
        expect(req.body.dueTime).to.eq(jobRequest.dueTime);
        expect(req.body.data.droid).to.eq(jobRequest.name);
        expect(req.body.data.task).to.eq('crawl:telegram');
        expect(req.body.data.platform).to.eq('telegram');
        expect(req.body.data.urls).to.deep.eq(['@channel1', '@channel2']);
        expect(req.body.data.maxDepth).to.eq(3);
        expect(req.body.data.concurrency).to.eq(4);
        expect(req.body.data.maxPosts).to.eq(500);
        expect(req.body.data.skipMedia).to.eq(true);
        expect(req.body.data.timeAgo).to.eq('30d');
        expect(req.body.data.jobId).to.exist;

        req.reply({
          statusCode: 200,
          body: { success: true, job: { scheduled: true } }
        });
      }).as('formatTest');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: jobRequest
      });

      cy.wait('@formatTest');
    });

    it('should handle YouTube platform job configuration', () => {
      const youtubeJobRequest = {
        name: 'youtube-job-test',
        dueTime: '15m',
        data: {
          droid: 'youtube-job-test',
          task: 'crawl:youtube',
          platform: 'youtube',
          urls: ['UCTestChannel1', 'UCTestChannel2'],
          youtubeApiKey: 'test-api-key-123',
          samplingMethod: 'channel',
          minChannelVideos: 50,
          maxPosts: 2000,
          sampleSize: 100
        }
      };

      cy.intercept('POST', '/api/jobs', {
        statusCode: 200,
        body: {
          success: true,
          job: {
            scheduled: true,
            jobName: 'youtube-job-test',
            method: 'dapr-sdk'
          },
          message: 'YouTube job scheduled successfully'
        }
      }).as('youtubeJob');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: youtubeJobRequest
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.job.jobName).to.eq('youtube-job-test');
      });
    });

    it('should validate required fields', () => {
      const invalidJobRequest = {
        // Missing name
        dueTime: '1m',
        data: {
          platform: 'telegram'
        }
      };

      cy.intercept('POST', '/api/jobs', {
        statusCode: 400,
        body: {
          error: 'Missing required fields: name, dueTime, data'
        }
      }).as('validationError');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: invalidJobRequest,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error).to.include('Missing required fields');
      });
    });

    it('should handle job state store integration', () => {
      const jobRequest = {
        name: 'state-store-test-job',
        dueTime: 'now',
        data: {
          droid: 'state-store-test-job',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@statechannel']
        }
      };

      cy.intercept('POST', '/api/jobs', {
        statusCode: 200,
        body: {
          success: true,
          job: { scheduled: true },
          jobId: 'state-store-test-job-1234567890',
          jobState: {
            id: 'state-store-test-job-1234567890',
            name: 'state-store-test-job',
            status: 'scheduled',
            platform: 'telegram',
            scheduledFor: new Date().toISOString(),
            logs: ['Job successfully scheduled with Dapr']
          },
          message: 'Job scheduled successfully'
        }
      }).as('stateStoreTest');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: jobRequest
      }).then((response) => {
        expect(response.body.jobState).to.exist;
        expect(response.body.jobState.id).to.include('state-store-test-job');
        expect(response.body.jobState.status).to.eq('scheduled');
        expect(response.body.jobState.platform).to.eq('telegram');
      });
    });
  });

  describe('GET /api/jobs - Dapr SDK Job Retrieval', () => {
    it('should retrieve all jobs using mixed SDK and HTTP approach', () => {
      const mockJobsResponse = {
        daprJobs: [
          {
            name: 'dapr-job-1',
            dueTime: '2024-12-01T15:00:00Z',
            data: { platform: 'telegram' }
          },
          {
            name: 'dapr-job-2',
            dueTime: 'now',
            data: { platform: 'youtube' }
          }
        ],
        jobStates: [
          {
            id: 'dapr-job-1-123',
            name: 'dapr-job-1',
            status: 'scheduled',
            platform: 'telegram'
          },
          {
            id: 'dapr-job-2-456',
            name: 'dapr-job-2',
            status: 'running',
            platform: 'youtube'
          }
        ],
        combined: [
          {
            id: 'dapr-job-1-123',
            name: 'dapr-job-1',
            status: 'scheduled',
            platform: 'telegram',
            daprInfo: {
              name: 'dapr-job-1',
              dueTime: '2024-12-01T15:00:00Z'
            }
          }
        ],
        serviceStatus: {
          daprAvailable: true,
          stateAvailable: true
        }
      };

      cy.intercept('GET', '/api/jobs', mockJobsResponse).as('getAllJobs');

      cy.request('GET', '/api/jobs').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.daprJobs).to.have.length(2);
        expect(response.body.jobStates).to.have.length(2);
        expect(response.body.combined).to.have.length.at.least(1);
        expect(response.body.serviceStatus.daprAvailable).to.be.true;
        expect(response.body.serviceStatus.stateAvailable).to.be.true;
      });
    });

    it('should retrieve specific job using Dapr SDK service invocation', () => {
      const specificJobName = 'specific-test-job';
      const mockJobResponse = {
        name: specificJobName,
        dueTime: '2024-12-01T16:00:00Z',
        data: {
          platform: 'telegram',
          urls: ['@specificchannel']
        }
      };

      cy.intercept('GET', `/api/jobs?name=${specificJobName}`, {
        statusCode: 200,
        body: {
          daprJobs: mockJobResponse,
          jobStates: [
            {
              id: `${specificJobName}-789`,
              name: specificJobName,
              status: 'scheduled',
              platform: 'telegram'
            }
          ]
        }
      }).as('getSpecificJob');

      cy.request('GET', `/api/jobs?name=${specificJobName}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.daprJobs.name).to.eq(specificJobName);
        expect(response.body.jobStates[0].name).to.eq(specificJobName);
      });
    });

    it('should handle state-only queries', () => {
      const mockStateResponse = [
        {
          id: 'state-job-1',
          name: 'state-test-job',
          status: 'completed',
          platform: 'telegram',
          logs: ['Job started', 'Crawling completed', 'Results saved']
        }
      ];

      cy.intercept('GET', '/api/jobs?state=true', mockStateResponse).as('getStateOnly');

      cy.request('GET', '/api/jobs?state=true').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.length(1);
        expect(response.body[0].status).to.eq('completed');
        expect(response.body[0].logs).to.have.length(3);
      });
    });

    it('should handle service unavailable errors', () => {
      cy.intercept('GET', '/api/jobs', {
        statusCode: 503,
        body: {
          message: 'Job services unavailable',
          details: 'Cannot connect to job services. Please ensure the unified deployment is running.',
          action: 'Run: npm run dev:dapr'
        }
      }).as('serviceUnavailable');

      cy.request({
        method: 'GET',
        url: '/api/jobs',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(503);
        expect(response.body.message).to.include('services unavailable');
        expect(response.body.action).to.include('npm run dev:dapr');
      });
    });
  });

  describe('DELETE /api/jobs - Job Deletion', () => {
    it('should delete job from both Dapr and state store', () => {
      const jobNameToDelete = 'job-to-delete';

      cy.intercept('DELETE', `/api/jobs?name=${jobNameToDelete}`, {
        statusCode: 200,
        body: {
          success: true,
          message: `Job ${jobNameToDelete} deleted successfully`,
          deletedFromDapr: true,
          deletedFromState: true
        }
      }).as('deleteJob');

      cy.request('DELETE', `/api/jobs?name=${jobNameToDelete}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.deletedFromDapr).to.be.true;
        expect(response.body.deletedFromState).to.be.true;
        expect(response.body.message).to.include('deleted successfully');
      });
    });

    it('should delete job by jobId', () => {
      const jobIdToDelete = 'job-id-12345';

      cy.intercept('DELETE', `/api/jobs?jobId=${jobIdToDelete}`, {
        statusCode: 200,
        body: {
          success: true,
          message: `Job ${jobIdToDelete} deleted successfully`,
          deletedFromDapr: false,
          deletedFromState: true
        }
      }).as('deleteJobById');

      cy.request('DELETE', `/api/jobs?jobId=${jobIdToDelete}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.deletedFromState).to.be.true;
      });
    });

    it('should handle partial deletion failures gracefully', () => {
      const jobName = 'partially-deletable-job';

      cy.intercept('DELETE', `/api/jobs?name=${jobName}`, {
        statusCode: 200,
        body: {
          success: true,
          message: `Job ${jobName} deletion completed (services may be unavailable)`,
          deletedFromDapr: false,
          deletedFromState: true
        }
      }).as('partialDelete');

      cy.request('DELETE', `/api/jobs?name=${jobName}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('deletion completed');
      });
    });

    it('should validate required parameters for deletion', () => {
      cy.intercept('DELETE', '/api/jobs', {
        statusCode: 400,
        body: {
          error: 'Job name or jobId is required for deletion'
        }
      }).as('deletionValidationError');

      cy.request({
        method: 'DELETE',
        url: '/api/jobs',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error).to.include('required for deletion');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in job requests', () => {
      cy.intercept('POST', '/api/jobs', {
        statusCode: 400,
        body: {
          error: 'Invalid JSON in request body'
        }
      }).as('malformedJSON');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: 'invalid-json-string',
        headers: {
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });

    it('should handle extremely large job payloads', () => {
      const largeJobRequest = {
        name: 'large-payload-test',
        dueTime: '1m',
        data: {
          droid: 'large-payload-test',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: new Array(10000).fill('@channel').map((ch, i) => `${ch}${i}`)
        }
      };

      cy.intercept('POST', '/api/jobs', (req) => {
        // Simulate handling of large payload
        if (req.body.data.urls.length > 5000) {
          req.reply({
            statusCode: 413,
            body: { error: 'Payload too large' }
          });
        } else {
          req.reply({
            statusCode: 200,
            body: { success: true }
          });
        }
      }).as('largePayload');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: largeJobRequest,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(413);
        expect(response.body.error).to.include('Payload too large');
      });
    });

    it('should handle concurrent job operations', () => {
      const job1 = {
        name: 'concurrent-job-1',
        dueTime: 'now',
        data: { droid: 'concurrent-job-1', task: 'crawl:telegram', platform: 'telegram', urls: ['@ch1'] }
      };

      const job2 = {
        name: 'concurrent-job-2', 
        dueTime: '30s',
        data: { droid: 'concurrent-job-2', task: 'crawl:youtube', platform: 'youtube', urls: ['UCch2'] }
      };

      // Mock both job scheduling calls
      cy.intercept('POST', '/api/jobs', (req) => {
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: { scheduled: true, jobName: req.body.name },
            message: 'Job scheduled successfully'
          }
        });
      }).as('concurrentJobs');

      // Make concurrent requests
      const requests = [
        cy.request('POST', '/api/jobs', { body: job1 }),
        cy.request('POST', '/api/jobs', { body: job2 })
      ];

      cy.wrap(Promise.all(requests)).then((responses) => {
        expect(responses).to.have.length(2);
        responses.forEach((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
        });
      });
    });

    it('should handle timeout scenarios', () => {
      const timeoutJobRequest = {
        name: 'timeout-test-job',
        dueTime: '5m',
        data: {
          droid: 'timeout-test-job',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@timeoutchannel']
        }
      };

      // Mock a delayed response that times out
      cy.intercept('POST', '/api/jobs', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              statusCode: 408,
              body: { error: 'Request timeout' }
            });
          }, 30000); // 30 second delay
        });
      }).as('timeoutJob');

      cy.request({
        method: 'POST',
        url: '/api/jobs',
        body: timeoutJobRequest,
        timeout: 5000, // 5 second timeout
        failOnStatusCode: false
      }).then((response) => {
        // The request should fail due to timeout
        expect(response.status).to.not.eq(200);
      });
    });
  });
});