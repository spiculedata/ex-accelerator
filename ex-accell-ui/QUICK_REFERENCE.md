# EX-ACCELERATOR UI - QUICK REFERENCE GUIDE

## Finding Things Fast

### Services by Purpose

**Need to query data?**
- Unified queries: `src/lib/services/duckdb.ts`
- Sentiment data: `src/lib/services/sentimentAnalysisDb.ts`
- Topics: `src/lib/services/topicModelingDb.ts`
- Languages: `src/lib/services/languageDetectionDb.ts`
- Engagement: `src/lib/services/engagementAnalysisDb.ts`
- Hashtags: `src/lib/services/hashtagAnalysisDb.ts`
- Android: `src/lib/services/androidAnalyticsDb.ts` or `androidResearchDb.ts`
- Dashboard overview: `src/lib/services/overviewDb.ts`

**Need to schedule jobs?**
- Job API client: `src/lib/services/jobSchedulerService.ts`
- Job state: `src/lib/services/jobStateStore.ts`
- API endpoint: `src/routes/api/jobs/+server.ts`

**Need to execute workflows?**
- Service: `src/lib/services/pythonDaprWorkflowExecutor.ts`
- Code generator: `src/lib/services/pythonDaprWorkflowGenerator.ts`
- Tracking: `src/lib/services/workflowExecutionService.ts`

**Need Dapr integration?**
- Client: `src/lib/services/daprClient.ts`
- Executors: `daprWorkflowExecutor.ts`, `hybridDaprWorkflowExecutor.ts`

### Pages by Feature

**Analytics dashboards?**
- `/text-analytics` - Text analytics hub
- `/text-analytics/sentiment-analysis` - Sentiment
- `/text-analytics/topic-modeling` - Topics
- `/text-analytics/language-detection` - Language
- `/text-analytics/engagement-analysis` - Engagement
- `/text-analytics/hashtag-analysis` - Hashtags
- `/text-analytics/trigrams` - N-grams
- `/dashboards` - All dashboards

**Job scheduling?**
- `/data-capture` - Create and monitor jobs

**Research & experimentation?**
- `/text-analytics/research-investigation` - Jupyter notebooks

**Project management?**
- `/projects` - Manage projects
- `/projects/new` - Create new project

### API Endpoints by Category

**Analytics Data:**
```
GET/POST /api/sentiment-analysis
GET/POST /api/topic-modeling
GET/POST /api/language-detection
GET/POST /api/engagement-analysis
GET/POST /api/hashtag-analysis
GET      /api/overview
GET/POST /api/gdelt
GET      /api/gdelt/mentions
```

**Core Data Access:**
```
GET      /api/unified-analytics
POST     /api/unified-analytics/query
POST     /api/unified-analytics/seed
```

**Job Scheduling:**
```
GET/POST/DELETE /api/jobs
GET/POST/PUT    /api/job-state
GET             /api/job-monitor
```

**Workflows:**
```
GET/POST        /api/workflows
GET/PUT/DELETE  /api/workflows/[id]
POST            /api/workflows/[id]/execute
GET/POST        /api/workflow-executions
GET             /api/workflow-executions/[id]
POST/PUT        /api/workflow-executions/[id]/manage
```

**Testing:**
```
GET /api/health
GET /api/test-dapr-connection
GET /api/test-crawler-logs
GET /api/debug-ui-state
```

## Database Quick Reference

**Primary Database:** `unified_social_analytics.db` (DuckDB)

**Main Tables:**
- `posts` - All posts (central table)
- `data_sources` - Platform definitions
- `crawlers` - Data collection tracking

**Cross-Table Views:**
```sql
unified_post_analysis           -- All posts + all analytics
cross_platform_sentiment        -- Sentiment by platform
topic_platform_performance      -- Topics by platform
language_sentiment_correlation  -- Language + sentiment
content_performance_analysis    -- Content characteristics
analytics_dashboard_summary     -- Dashboard metrics
```

## Common Development Tasks

### Add a New Analytics Module

1. Create service: `src/lib/services/myModuleDb.ts`
2. Create API: `src/routes/api/my-module/+server.ts`
3. Create page: `src/routes/text-analytics/my-module/+page.svelte`
4. Add schema: `sql/schemas/my_module_schema.sql`
5. Add tests: Cypress E2E and component tests

### Add a New Route

1. Create directory: `src/routes/my-route/`
2. Add page: `+page.svelte`
3. Optionally add API: `+server.ts` for server functions
4. Import Navigation component and required services

### Query Data

```typescript
// In a service file
import { unifiedDb } from './duckdb';

// Method 1: Custom SQL
const results = await unifiedDb.query('SELECT * FROM posts LIMIT 10');

// Method 2: Predefined query type
const results = await unifiedDb.queryByType('sentiment-by-platform', {platform: 'twitter'});

// Method 3: Cross-table analysis
const analysis = await unifiedDb.getUnifiedPostAnalysis({filters: {...}});
```

### Schedule a Job

```typescript
// In a component
import { jobSchedulerService } from '$lib/services/jobSchedulerService';

const jobRequest = {
  name: 'telegram-crawl-2025-01-01T12-00-00',
  dueTime: '30s',  // or ISO date string
  data: {
    droid: 'telegram-crawl-job',
    task: 'crawl:telegram',
    platform: 'telegram',
    urls: ['@channel1', '@channel2'],
    maxPosts: 1000,
    concurrency: 2
  }
};

const result = await jobSchedulerService.scheduleJob(jobRequest);
```

### Test a Component

```typescript
// cypress/component/MyComponent.cy.ts
import MyComponent from '../src/routes/my-route/+page.svelte';

describe('MyComponent', () => {
  it('should render', () => {
    cy.mount(MyComponent);
    cy.contains('Expected text').should('be.visible');
  });
});
```

### Test an API Endpoint

```typescript
// cypress/e2e/my-api.cy.ts
describe('My API', () => {
  it('should return data', () => {
    cy.request('GET', '/api/my-endpoint').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
    });
  });
});
```

## Configuration Quick Reference

**Development:**
- Dev server: `npm run dev` (port 5173)
- With Jupyter: `npm run dev:jupyter` (+ port 8888)
- With Dapr: `npm run dev:dapr` (+ Dapr ports)

**Building:**
- Build: `npm run build`
- Check types: `npm run check`
- Watch types: `npm run check:watch`

**Testing:**
- All tests: `npm run test`
- Interactive: `npm run cypress:open`
- E2E only: `npm run test:e2e`
- Component only: `npm run test:component`

**Database:**
- Init Dapr: `npm run dapr:init`
- Setup deps: `npm run dapr:setup`
- View logs: `npm run dapr:logs`
- Stop all: `npm run dapr:stop`

## Debugging Tips

**Check if DuckDB is connected:**
```typescript
import { unifiedDb } from '$lib/services/duckdb';
console.log(unifiedDb.isConnected());
```

**View Dapr logs:**
```bash
npm run dapr:logs
```

**Health check:**
```bash
curl http://localhost:5173/api/health
```

**Test Dapr connection:**
```bash
curl http://localhost:5173/api/test-dapr-connection
```

**Check job status:**
```bash
curl http://localhost:5173/api/jobs?name=your-job-name
```

## File Location Cheat Sheet

```
Project Root: /Users/tombarber/Projects/ex-accelerator/ex-accell-ui/

Services:     src/lib/services/
Components:   src/lib/components/
Pages:        src/routes/
API Routes:   src/routes/api/
Database:     sql/schemas/
Tests:        cypress/
Config:       vite.config.ts, svelte.config.js, tsconfig.json
Dapr:         dapr.yaml, components/
Notebooks:    notebooks/
```

## Important Port Numbers

- **Frontend**: 5173 (SvelteKit)
- **Dapr (UI)**: 3500 (HTTP), 50001 (gRPC)
- **Jupyter**: 8888
- **Dapr (telegram-scraper)**: 3502 (HTTP), 50002 (gRPC)
- **telegram-scraper**: 6481 (gRPC)
- **Redis**: 6379 (default)

## Environment Variables

Key env vars (if needed):
- `NODE_ENV` - Set by npm/Vite
- `DAPR_HOST` - localhost (default)
- `DAPR_HTTP_PORT` - 3500 (UI), 3502 (scraper)

## Documentation Files

Generated analysis files:
- `CODEBASE_ANALYSIS.md` - Comprehensive codebase documentation
- `ARCHITECTURE_SUMMARY.txt` - Architecture overview
- `CLAUDE.md` - Project guidelines and setup

## Related Repositories

- **telegram-scraper**: `/Users/tombarber/Projects/telegram-scraper`
- **ETL pipeline**: `../etl/`
- **Superset analytics**: `../superset/`

## Key Concepts

**Unified Database**: Single DuckDB database with cross-module views for complex queries

**Dapr Integration**: Microservices orchestration for job scheduling and workflow execution

**Service Layer**: 24 services handling database queries, analytics, jobs, workflows

**Cross-Table Analysis**: Pre-built SQL views for multi-module insights

**Jupyter Integration**: 8 notebook templates for research and experimentation

## Common Issues & Solutions

**DuckDB connection fails?**
- Check `/api/unified-analytics` endpoint
- Verify database file exists: `unified_social_analytics.db`
- See logs in browser console

**Dapr job not scheduling?**
- Verify Dapr is running: `npm run dev:dapr`
- Check `/api/health` returns OK
- Check Dapr logs: `npm run dapr:logs`

**Jupyter Lab not accessible?**
- Run: `npm run jupyter:bootstrap`
- Start: `npm run dev:jupyter`
- Access: `http://localhost:8888`

**Tests failing?**
- Clear cache: `rm -rf .svelte-kit cypress/.cache`
- Rebuild: `npm run build`
- Run with open browser: `npm run cypress:open`

---

**Last Updated**: 2025-11-10
**Project Location**: /Users/tombarber/Projects/ex-accelerator/ex-accell-ui

