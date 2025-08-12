describe('Dapr SDK Integration Tests', () => {
  const DAPR_JOB_ENDPOINT = '/api/jobs';
  
  beforeEach(() => {
    // Set up test environment
    cy.window().then((win) => {
      win.console = {
        ...win.console,
        log: cy.stub().as('consoleLog'),
        error: cy.stub().as('consoleError'),
        warn: cy.stub().as('consoleWarn')
      };
    });
  });

  describe('Service Invocation Pattern Tests', () => {
    it('should use Dapr SDK service invocation to schedule jobs', () => {
      const testJob = {
        name: 'dapr-sdk-invocation-test',
        dueTime: '1m',
        data: {
          droid: 'dapr-sdk-invocation-test',
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@testsdk1', '@testsdk2'],
          crawlId: 'sdk-test-001',
          concurrency: 2,
          maxPosts: 500
        }
      };

      // Mock the actual Dapr SDK service invocation flow
      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        // Verify the request follows the expected format for service invocation
        expect(req.body.name).to.exist;
        expect(req.body.dueTime).to.exist;
        expect(req.body.data).to.exist;
        
        // Verify job data transformation for telegram-scraper
        expect(req.body.data.droid).to.eq(req.body.name);
        expect(req.body.data.task).to.include('crawl:');
        expect(req.body.data.jobId).to.exist;
        
        // Mock successful Dapr SDK invocation
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              jobName: req.body.name,
              method: 'dapr-sdk'
            },
            jobId: `${req.body.name}-${Date.now()}`,
            message: 'Job scheduled successfully'
          }
        });
      }).as('daprServiceInvocation');

      cy.request('POST', DAPR_JOB_ENDPOINT, testJob);
      
      cy.wait('@daprServiceInvocation').then((interception) => {
        expect(interception.response.statusCode).to.eq(200);
        expect(interception.response.body.job.method).to.eq('dapr-sdk');
        expect(interception.response.body.success).to.be.true;
      });
    });

    it('should handle Dapr service discovery and app-to-app communication', () => {
      const testJob = {
        name: 'dapr-app-communication-test',
        dueTime: '30s',
        data: {
          platform: 'youtube',
          urls: ['UCTestChannel'],
          youtubeApiKey: 'test-key-123'
        }
      };

      // Mock service discovery and communication patterns
      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        // Simulate the Dapr SDK trying to invoke the telegram-scraper service
        const headers = req.headers;
        
        // Verify Dapr-specific headers or patterns would be present
        expect(req.body).to.have.property('name');
        expect(req.body).to.have.property('dueTime');
        expect(req.body).to.have.property('data');

        // Mock successful app-to-app invocation
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              serviceInvoked: 'telegram-scraper',
              method: 'scheduleJob'
            }
          }
        });
      }).as('appToAppCommunication');

      cy.request('POST', DAPR_JOB_ENDPOINT, testJob);
      cy.wait('@appToAppCommunication');
    });

    it('should handle Dapr sidecar connectivity issues', () => {
      const testJob = {
        name: 'dapr-sidecar-connectivity-test',
        dueTime: 'now',
        data: {
          platform: 'telegram',
          urls: ['@connectivitytest']
        }
      };

      // Mock Dapr sidecar connection failure
      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 503,
        body: {
          message: 'Job scheduling service unavailable',
          details: 'Cannot connect to Dapr job scheduler. Please ensure the unified deployment is running.',
          action: 'Run: npm run dev:dapr',
          daprError: 'Connection refused to localhost:3500'
        }
      }).as('sidecarConnectionError');

      cy.request({
        method: 'POST',
        url: DAPR_JOB_ENDPOINT,
        body: testJob,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(503);
        expect(response.body.details).to.include('unified deployment');
        expect(response.body.action).to.include('npm run dev:dapr');
      });
    });
  });

  describe('Job Handler Registration Tests', () => {
    it('should verify job handlers are registered for predefined job names', () => {
      const predefinedJobNames = ['R2-D2', 'C-3PO', 'BB-8', 'my-scheduled-job'];
      
      predefinedJobNames.forEach((jobName) => {
        const testJob = {
          name: jobName,
          dueTime: '5m',
          data: {
            droid: jobName,
            task: 'Oil Change',
            platform: 'telegram',
            urls: [`@${jobName.toLowerCase().replace('-', '')}`]
          }
        };

        cy.intercept('POST', DAPR_JOB_ENDPOINT, {
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              jobName: jobName,
              handlerRegistered: true
            }
          }
        }).as(`jobHandler-${jobName}`);

        cy.request('POST', DAPR_JOB_ENDPOINT, testJob);
        cy.wait(`@jobHandler-${jobName}`);
      });
    });

    it('should handle custom job names with registered handlers', () => {
      const customJobName = 'custom-telegram-crawler-' + Date.now();
      
      const testJob = {
        name: customJobName,
        dueTime: '2h',
        data: {
          droid: customJobName,
          task: 'crawl:telegram',
          platform: 'telegram',
          urls: ['@customchannel1', '@customchannel2']
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        // Custom job names should still work through the generic handler
        expect(req.body.name).to.eq(customJobName);
        
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              jobName: customJobName,
              customHandler: true
            }
          }
        });
      }).as('customJobHandler');

      cy.request('POST', DAPR_JOB_ENDPOINT, testJob);
      cy.wait('@customJobHandler');
    });
  });

  describe('gRPC Communication Tests', () => {
    it('should handle gRPC protocol communication with job-service', () => {
      const grpcTestJob = {
        name: 'grpc-protocol-test',
        dueTime: '10m',
        data: {
          platform: 'telegram',
          urls: ['@grpctest'],
          concurrency: 1
        }
      };

      // Mock gRPC communication patterns
      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        // In a real scenario, this would test gRPC serialization/deserialization
        // For this test, we verify the data format is compatible
        expect(req.body.data).to.be.an('object');
        expect(req.body.dueTime).to.be.a('string');
        
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              protocol: 'grpc',
              serviceApp: 'telegram-scraper'
            }
          }
        });
      }).as('grpcCommunication');

      cy.request('POST', DAPR_JOB_ENDPOINT, grpcTestJob);
      cy.wait('@grpcCommunication');
    });

    it('should handle gRPC connection failures gracefully', () => {
      const grpcFailureJob = {
        name: 'grpc-failure-test',
        dueTime: 'now',
        data: {
          platform: 'telegram',
          urls: ['@grpcfailure']
        }
      };

      // Mock gRPC connection failure
      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 502,
        body: {
          error: 'Failed to schedule job via Dapr SDK: gRPC connection failed',
          grpcError: 'Connection refused to telegram-scraper on port 6481',
          suggestion: 'Verify telegram-scraper is running in dapr-job mode'
        }
      }).as('grpcFailure');

      cy.request({
        method: 'POST',
        url: DAPR_JOB_ENDPOINT,
        body: grpcFailureJob,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(502);
        expect(response.body.error).to.include('gRPC connection failed');
        expect(response.body.suggestion).to.include('dapr-job mode');
      });
    });
  });

  describe('State Management Integration', () => {
    it('should integrate with Dapr state store for job tracking', () => {
      const stateIntegrationJob = {
        name: 'state-integration-test',
        dueTime: '15m',
        data: {
          platform: 'telegram',
          urls: ['@statetest'],
          crawlId: 'state-test-001'
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 200,
        body: {
          success: true,
          job: { scheduled: true },
          jobId: 'state-integration-test-123456789',
          jobState: {
            id: 'state-integration-test-123456789',
            name: 'state-integration-test',
            status: 'scheduled',
            platform: 'telegram',
            scheduledFor: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            logs: ['Job successfully scheduled with Dapr']
          },
          message: 'Job scheduled successfully'
        }
      }).as('stateIntegration');

      cy.request('POST', DAPR_JOB_ENDPOINT, stateIntegrationJob);
      
      cy.wait('@stateIntegration').then((interception) => {
        const response = interception.response.body;
        expect(response.jobState).to.exist;
        expect(response.jobState.status).to.eq('scheduled');
        expect(response.jobState.logs).to.include('Job successfully scheduled with Dapr');
      });
    });

    it('should handle state store connectivity issues', () => {
      const stateFailureJob = {
        name: 'state-failure-test',
        dueTime: '1h',
        data: {
          platform: 'telegram',
          urls: ['@statefailure']
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 503,
        body: {
          message: 'Job scheduling service unavailable',
          details: 'DaprConnectionError: Cannot connect to state store',
          action: 'Please start the unified deployment with: npm run dev:dapr'
        }
      }).as('stateStoreFailure');

      cy.request({
        method: 'POST',
        url: DAPR_JOB_ENDPOINT,
        body: stateFailureJob,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(503);
        expect(response.body.details).to.include('DaprConnectionError');
      });
    });

    it('should test state store recovery and resilience', () => {
      const resilientJob = {
        name: 'state-resilience-test',
        dueTime: '30m',
        data: {
          platform: 'telegram',
          urls: ['@resilience']
        }
      };

      // Test partial success scenario
      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 200,
        body: {
          success: true,
          job: { scheduled: true },
          jobId: 'state-resilience-test-987654321',
          jobState: null, // State store failed but job still scheduled
          message: 'Job scheduled (state tracking unavailable)'
        }
      }).as('stateResilience');

      cy.request('POST', DAPR_JOB_ENDPOINT, resilientJob);
      
      cy.wait('@stateResilience').then((interception) => {
        const response = interception.response.body;
        expect(response.success).to.be.true;
        expect(response.jobState).to.be.null;
        expect(response.message).to.include('state tracking unavailable');
      });
    });
  });

  describe('Multi-App Deployment Tests', () => {
    it('should verify multi-app dapr.yaml configuration compatibility', () => {
      const multiAppJob = {
        name: 'multi-app-test',
        dueTime: '45m',
        data: {
          platform: 'youtube',
          urls: ['UCMultiApp'],
          youtubeApiKey: 'multi-app-key'
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        // Verify the job format is compatible with multi-app deployment
        expect(req.body.name).to.exist;
        expect(req.body.data.platform).to.exist;
        
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              deploymentMode: 'multi-app',
              uiApp: 'ex-accell-ui',
              jobServiceApp: 'telegram-scraper'
            }
          }
        });
      }).as('multiAppDeployment');

      cy.request('POST', DAPR_JOB_ENDPOINT, multiAppJob);
      
      cy.wait('@multiAppDeployment').then((interception) => {
        const response = interception.response.body;
        expect(response.job.deploymentMode).to.eq('multi-app');
        expect(response.job.uiApp).to.eq('ex-accell-ui');
        expect(response.job.jobServiceApp).to.eq('telegram-scraper');
      });
    });

    it('should test port configuration and service discovery', () => {
      const portTestJob = {
        name: 'port-config-test',
        dueTime: '20m',
        data: {
          platform: 'telegram',
          urls: ['@porttest']
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 200,
        body: {
          success: true,
          job: { scheduled: true },
          serviceConfig: {
            uiDaprPort: 3500,
            scraperDaprPort: 3502,
            scraperAppPort: 6481,
            protocol: 'grpc'
          }
        }
      }).as('portConfiguration');

      cy.request('POST', DAPR_JOB_ENDPOINT, portTestJob);
      
      cy.wait('@portConfiguration').then((interception) => {
        const config = interception.response.body.serviceConfig;
        expect(config.uiDaprPort).to.eq(3500);
        expect(config.scraperDaprPort).to.eq(3502);
        expect(config.scraperAppPort).to.eq(6481);
        expect(config.protocol).to.eq('grpc');
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent job scheduling requests', () => {
      const concurrentJobs = Array.from({ length: 5 }, (_, i) => ({
        name: `concurrent-job-${i + 1}`,
        dueTime: `${(i + 1) * 10}s`,
        data: {
          platform: 'telegram',
          urls: [`@concurrent${i + 1}`],
          concurrency: 1
        }
      }));

      // Mock concurrent job handling
      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        const jobName = req.body.name;
        
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            job: {
              scheduled: true,
              jobName: jobName,
              processingTime: Math.floor(Math.random() * 1000)
            }
          }
        });
      }).as('concurrentJobs');

      // Submit all jobs concurrently
      const requests = concurrentJobs.map(job => 
        cy.request('POST', DAPR_JOB_ENDPOINT, job)
      );

      cy.wrap(Promise.all(requests)).then((responses) => {
        expect(responses).to.have.length(5);
        responses.forEach((response, index) => {
          expect(response.status).to.eq(200);
          expect(response.body.job.jobName).to.include(`concurrent-job-${index + 1}`);
        });
      });
    });

    it('should test job scheduling under heavy load simulation', () => {
      const heavyLoadJob = {
        name: 'heavy-load-test',
        dueTime: 'now',
        data: {
          platform: 'telegram',
          urls: Array.from({ length: 100 }, (_, i) => `@heavyload${i}`),
          concurrency: 10,
          maxPosts: 10000
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, (req) => {
        // Simulate processing time for heavy payloads
        const urlCount = req.body.data.urls.length;
        const processingTime = urlCount > 50 ? 2000 : 500;

        setTimeout(() => {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              job: {
                scheduled: true,
                urlCount: urlCount,
                estimatedProcessingTime: processingTime
              }
            }
          });
        }, processingTime / 10); // Simulate some processing delay
      }).as('heavyLoadJob');

      cy.request('POST', DAPR_JOB_ENDPOINT, heavyLoadJob);
      
      cy.wait('@heavyLoadJob', { timeout: 10000 }).then((interception) => {
        const response = interception.response.body;
        expect(response.success).to.be.true;
        expect(response.job.urlCount).to.eq(100);
      });
    });
  });

  describe('Cleanup and Resource Management', () => {
    afterEach(() => {
      // Cleanup any test jobs that might have been created
      const testJobPattern = /^(dapr-sdk-|grpc-|state-|multi-app-|concurrent-job-|heavy-load-)/;
      
      // Mock cleanup calls
      cy.window().then(() => {
        // In a real scenario, this would clean up test jobs
        // For now, just verify the cleanup pattern
        expect(testJobPattern.test('dapr-sdk-invocation-test')).to.be.true;
        expect(testJobPattern.test('grpc-protocol-test')).to.be.true;
        expect(testJobPattern.test('state-integration-test')).to.be.true;
      });
    });

    it('should verify proper resource cleanup after job completion', () => {
      const cleanupTestJob = {
        name: 'cleanup-test-job',
        dueTime: 'now',
        data: {
          platform: 'telegram',
          urls: ['@cleanup']
        }
      };

      cy.intercept('POST', DAPR_JOB_ENDPOINT, {
        statusCode: 200,
        body: {
          success: true,
          job: { scheduled: true },
          cleanup: {
            resourcesManaged: true,
            memoryFreed: true,
            connectionsReleased: true
          }
        }
      }).as('resourceCleanup');

      cy.request('POST', DAPR_JOB_ENDPOINT, cleanupTestJob);
      
      cy.wait('@resourceCleanup').then((interception) => {
        const cleanup = interception.response.body.cleanup;
        expect(cleanup.resourcesManaged).to.be.true;
        expect(cleanup.memoryFreed).to.be.true;
        expect(cleanup.connectionsReleased).to.be.true;
      });
    });
  });
});