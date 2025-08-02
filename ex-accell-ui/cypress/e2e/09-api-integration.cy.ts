describe('API Integration and Database Tests', () => {
  describe('Unified DuckDB API Integration', () => {
    it('should connect to unified analytics API', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=test', { 
        success: true, 
        data: { status: 'connected', version: '1.0.0' } 
      }).as('connectionTest')
      
      cy.visitAndWait('/dashboards')
      cy.wait('@connectionTest')
      
      cy.get('[data-cy="api-status"]').should('contain.text', 'Connected')
      cy.get('[data-cy="api-version"]').should('contain.text', '1.0.0')
    })

    it('should handle unified post analysis queries', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=unified-post-analysis', {
        success: true,
        data: [
          {
            post_id: 1,
            content: 'Test post content',
            platform: 'Twitter',
            sentiment_category: 'Positive',
            topic_name: 'Technology',
            language_name: 'English',
            engagement_rate: 4.5
          }
        ]
      }).as('unifiedAnalysis')
      
      cy.visitAndWait('/analytics-correlation')
      cy.wait('@unifiedAnalysis')
      
      cy.get('[data-cy="unified-analysis-results"]').should('be.visible')
      cy.get('[data-cy="cross-table-data"]').should('contain.text', 'Technology')
    })

    it('should handle cross-platform sentiment queries', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=cross-platform-sentiment', {
        success: true,
        data: [
          { platform: 'Twitter', sentiment_category: 'Positive', post_count: 1250, avg_engagement_rate: 4.2 },
          { platform: 'Facebook', sentiment_category: 'Positive', post_count: 890, avg_engagement_rate: 3.8 },
          { platform: 'Instagram', sentiment_category: 'Negative', post_count: 456, avg_engagement_rate: 2.1 }
        ]
      }).as('crossPlatformSentiment')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@crossPlatformSentiment')
      
      cy.get('[data-cy="platform-comparison"]').should('be.visible')
      cy.checkChartExists('[data-cy="cross-platform-chart"]')
    })

    it('should handle topic-platform performance queries', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=topic-platform-performance', {
        success: true,
        data: [
          { 
            topic_name: 'Artificial Intelligence', 
            platform: 'Twitter', 
            avg_engagement_rate: 5.2,
            post_count: 847
          },
          { 
            topic_name: 'Climate Change', 
            platform: 'Facebook', 
            avg_engagement_rate: 3.8,
            post_count: 623
          }
        ]
      }).as('topicPlatformPerformance')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.wait('@topicPlatformPerformance')
      
      cy.get('[data-cy="platform-performance"]').should('be.visible')
      cy.get('[data-cy="performance-metric"]').should('contain.text', '5.2')
    })

    it('should handle language-sentiment correlation queries', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=language-sentiment-correlation', {
        success: true,
        data: [
          { 
            language_name: 'English', 
            sentiment_category: 'Positive', 
            percentage_in_language: 45.2,
            avg_engagement_rate: 4.1
          },
          { 
            language_name: 'Spanish', 
            sentiment_category: 'Positive', 
            percentage_in_language: 52.8,
            avg_engagement_rate: 4.8
          }
        ]
      }).as('languageSentimentCorrelation')
      
      cy.visitAndWait('/text-analytics/language-detection')
      cy.wait('@languageSentimentCorrelation')
      
      cy.get('[data-cy="correlation-analysis"]').should('be.visible')
      cy.get('[data-cy="correlation-chart"]').should('be.visible')
    })
  })

  describe('Database Service Integration', () => {
    it('should handle dashboard database service calls', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=analytics-dashboard-summary', {
        success: true,
        data: [
          { metric: 'Total Posts', value: '847293', unit: 'posts' },
          { metric: 'Active Platforms', value: '7', unit: 'platforms' },
          { metric: 'Average Engagement Rate', value: '4.2', unit: '%' }
        ]
      }).as('dashboardSummary')
      
      cy.visitAndWait('/dashboards')
      cy.wait('@dashboardSummary')
      
      cy.get('[data-cy="total-posts"]').should('contain.text', '847293')
      cy.get('[data-cy="active-platforms"]').should('contain.text', '7')
      cy.get('[data-cy="avg-engagement"]').should('contain.text', '4.2')
    })

    it('should handle sentiment analysis service calls', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=sentiment-classifications', {
        success: true,
        data: [
          { sentiment_category: 'Very Positive', post_count: 89456, percentage: 35.2 },
          { sentiment_category: 'Positive', post_count: 67234, percentage: 26.4 },
          { sentiment_category: 'Neutral', post_count: 45789, percentage: 18.0 }
        ]
      }).as('sentimentClassifications')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@sentimentClassifications')
      
      cy.get('[data-cy="sentiment-breakdown"]').should('be.visible')
      cy.get('[data-cy="positive-count"]').should('contain.text', '67234')
    })

    it('should handle topic modeling service calls', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=topic-overview', {
        success: true,
        data: [
          { 
            id: 1, 
            name: 'Artificial Intelligence', 
            category: 'Technology',
            size: 847,
            weight: 0.245,
            keywords: 'AI,machine learning,neural networks'
          }
        ]
      }).as('topicOverview')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.wait('@topicOverview')
      
      cy.get('[data-cy="topic-card"]').should('be.visible')
      cy.get('[data-cy="topic-name"]').should('contain.text', 'Artificial Intelligence')
    })

    it('should handle language detection service calls', () => {
      cy.intercept('GET', '**/api/unified-analytics?type=language-overview', {
        success: true,
        data: [
          { code: 'en', name: 'English', post_count: 678234, percentage: 80.1 },
          { code: 'es', name: 'Spanish', post_count: 89567, percentage: 10.6 },
          { code: 'fr', name: 'French', post_count: 45678, percentage: 5.4 }
        ]
      }).as('languageOverview')
      
      cy.visitAndWait('/text-analytics/language-detection')
      cy.wait('@languageOverview')
      
      cy.get('[data-cy="language-stats"]').should('be.visible')
      cy.get('[data-cy="english-count"]').should('contain.text', '678234')
    })
  })

  describe('Database Error Handling', () => {
    it('should handle database connection timeouts', () => {
      cy.intercept('GET', '**/api/unified-analytics**', (req) => {
        req.reply({ delay: 15000, statusCode: 408, body: { error: 'Request timeout' } })
      }).as('dbTimeout')
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="timeout-error"]').should('be.visible')
      cy.get('[data-cy="retry-connection"]').should('be.visible')
    })

    it('should handle SQL query execution errors', () => {
      cy.intercept('GET', '**/api/unified-analytics**', {
        statusCode: 500,
        body: { 
          success: false, 
          error: 'SQL execution failed: table posts does not exist' 
        }
      }).as('sqlError')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@sqlError')
      
      cy.get('[data-cy="sql-error"]').should('be.visible')
      cy.get('[data-cy="error-message"]').should('contain.text', 'Database schema error')
    })

    it('should handle database lock errors', () => {
      cy.intercept('GET', '**/api/unified-analytics**', {
        statusCode: 503,
        body: { 
          success: false, 
          error: 'Database is locked' 
        }
      }).as('lockError')
      
      cy.visitAndWait('/dashboards')
      cy.wait('@lockError')
      
      cy.get('[data-cy="database-locked"]').should('be.visible')
      cy.get('[data-cy="wait-and-retry"]').should('be.visible')
    })

    it('should handle data consistency errors', () => {
      cy.intercept('GET', '**/api/unified-analytics**', {
        success: true,
        data: [
          { id: 1, name: 'Topic 1', size: null }, // Invalid size
          { id: 2, name: null, size: 100 },       // Invalid name
          { id: 3, name: 'Valid Topic', size: 200 } // Valid data
        ]
      }).as('inconsistentData')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.wait('@inconsistentData')
      
      cy.get('[data-cy="data-warning"]').should('be.visible')
      cy.get('[data-cy="data-warning"]').should('contain.text', 'Some data may be incomplete')
      cy.get('[data-cy="topic-card"]').should('have.length', 1) // Only valid data shown
    })
  })

  describe('API Performance and Optimization', () => {
    it('should implement request debouncing for search', () => {
      let requestCount = 0
      cy.intercept('GET', '**/api/unified-analytics**', (req) => {
        requestCount++
        req.reply({ success: true, data: [] })
      }).as('searchRequest')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      
      // Type quickly to trigger debouncing
      cy.get('[data-cy="topic-search"]').type('artificial intelligence')
      cy.wait(1000) // Wait for debounce
      
      cy.then(() => {
        expect(requestCount).to.be.lessThan(10) // Should be debounced
      })
    })

    it('should implement request caching', () => {
      let requestCount = 0
      cy.intercept('GET', '**/api/unified-analytics?type=dashboard-stats', (req) => {
        requestCount++
        req.reply({ fixture: 'dashboard-stats.json' })
      }).as('cachedRequest')
      
      cy.visitAndWait('/dashboards')
      cy.wait('@cachedRequest')
      
      // Navigate away and back
      cy.get('[data-cy="nav-menu"]').contains('Projects').click()
      cy.waitForPageLoad()
      cy.get('[data-cy="nav-menu"]').contains('Dashboard').click()
      cy.waitForPageLoad()
      
      cy.then(() => {
        expect(requestCount).to.equal(1) // Should be cached
      })
    })

    it('should handle concurrent requests efficiently', () => {
      const requestTimestamps = []
      cy.intercept('GET', '**/api/unified-analytics**', (req) => {
        requestTimestamps.push(Date.now())
        req.reply({ delay: 100, success: true, data: [] })
      }).as('concurrentRequest')
      
      cy.visitAndWait('/analytics-correlation')
      
      // Multiple API calls should be made concurrently
      cy.wait(1000)
      cy.then(() => {
        expect(requestTimestamps.length).to.be.greaterThan(1)
        // Verify requests were made concurrently (similar timestamps)
        const timeDiffs = requestTimestamps.slice(1).map((time, i) => 
          Math.abs(time - requestTimestamps[i])
        )
        expect(Math.max(...timeDiffs)).to.be.lessThan(100)
      })
    })

    it('should implement pagination for large datasets', () => {
      cy.intercept('GET', '**/api/unified-analytics**', (req) => {
        const page = req.url.searchParams.get('page') || '1'
        const limit = req.url.searchParams.get('limit') || '50'
        
        req.reply({
          success: true,
          data: Array.from({ length: parseInt(limit) }, (_, i) => ({
            id: (parseInt(page) - 1) * parseInt(limit) + i,
            name: `Item ${i}`
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 10000,
            hasNext: parseInt(page) < 200
          }
        })
      }).as('paginatedRequest')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.wait('@paginatedRequest')
      
      cy.get('[data-cy="pagination"]').should('be.visible')
      cy.get('[data-cy="next-page"]').click()
      cy.wait('@paginatedRequest')
      
      cy.get('[data-cy="current-page"]').should('contain.text', '2')
    })
  })

  describe('Real-time Data Updates', () => {
    it('should handle WebSocket connections for real-time updates', () => {
      // Mock WebSocket connection
      cy.window().then((win) => {
        const mockWS = {
          onmessage: null,
          send: cy.stub(),
          close: cy.stub()
        }
        
        win.WebSocket = function() { return mockWS }
        
        // Simulate real-time update
        setTimeout(() => {
          if (mockWS.onmessage) {
            mockWS.onmessage({
              data: JSON.stringify({
                type: 'sentiment_update',
                data: { positive: 1000, negative: 500, neutral: 300 }
              })
            })
          }
        }, 1000)
      })
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      
      cy.get('[data-cy="realtime-indicator"]').should('be.visible')
      cy.get('[data-cy="realtime-indicator"]').should('contain.text', 'Live')
      
      // Wait for simulated update
      cy.wait(1500)
      cy.get('[data-cy="positive-count"]').should('contain.text', '1000')
    })

    it('should handle server-sent events for updates', () => {
      cy.intercept('GET', '**/api/events/sentiment', (req) => {
        req.reply({
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          body: 'data: {"type": "update", "data": {"sentiment": "positive", "count": 1}}\n\n'
        })
      }).as('serverSentEvents')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.get('[data-cy="enable-realtime"]').check()
      
      cy.wait('@serverSentEvents')
      cy.get('[data-cy="realtime-updates"]').should('be.visible')
    })

    it('should handle polling for data updates', () => {
      let pollCount = 0
      cy.intercept('GET', '**/api/unified-analytics?type=dashboard-stats', (req) => {
        pollCount++
        req.reply({
          fixture: 'dashboard-stats.json',
          headers: { 'X-Poll-Count': pollCount.toString() }
        })
      }).as('pollingRequest')
      
      cy.visitAndWait('/dashboards')
      cy.get('[data-cy="auto-refresh"]').check()
      
      // Wait for multiple polling requests
      cy.wait('@pollingRequest')
      cy.wait(5000) // Wait for next poll
      cy.wait('@pollingRequest')
      
      cy.then(() => {
        expect(pollCount).to.be.greaterThan(1)
      })
    })
  })

  describe('Data Export and Import', () => {
    it('should handle data export API calls', () => {
      cy.intercept('POST', '**/api/export/sentiment-analysis', {
        success: true,
        data: {
          downloadUrl: '/api/download/export-123.csv',
          exportId: 'export-123',
          format: 'csv'
        }
      }).as('exportRequest')
      
      cy.visitAndWait('/text-analytics/sentiment-analysis')
      cy.get('[data-cy="export-sentiment"]').click()
      
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.selectDropdownOption('select[name="format"]', 'csv')
        cy.get('button[type="submit"]').click()
      })
      
      cy.wait('@exportRequest')
      cy.get('[data-cy="export-success"]').should('be.visible')
      cy.get('[data-cy="download-link"]').should('be.visible')
    })

    it('should handle large export operations', () => {
      cy.intercept('POST', '**/api/export/**', (req) => {
        req.reply({
          delay: 3000, // Simulate processing time
          success: true,
          data: { 
            status: 'processing',
            estimatedTime: '2 minutes'
          }
        })
      }).as('largeExport')
      
      cy.visitAndWait('/text-analytics/topic-modeling')
      cy.get('[data-cy="export-topics"]').click()
      
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.get('input[name="includeAll"]').check()
        cy.get('button[type="submit"]').click()
      })
      
      cy.wait('@largeExport')
      cy.get('[data-cy="export-progress"]').should('be.visible')
      cy.get('[data-cy="estimated-time"]').should('contain.text', '2 minutes')
    })
  })
})