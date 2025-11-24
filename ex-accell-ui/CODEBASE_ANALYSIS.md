# EX-ACCELERATOR UI - COMPREHENSIVE CODEBASE EXPLORATION

**Project**: ex-accell-ui (SvelteKit 2.x Frontend)
**Framework Stack**: SvelteKit 2.x, Svelte 5.x, TypeScript 5.x, Vite 7.x, Tailwind CSS 3.x
**Database**: Unified DuckDB (unified_social_analytics.db)
**Deployment**: Dapr-enabled microservices architecture
**Total Source Size**: 1.4MB | Services LOC: 8,559 lines
**Test Suite**: 18 Cypress test files (E2E + Component)

---

## 1. PROJECT STRUCTURE MAPPING

### Root Directory Layout
```
/Users/tombarber/Projects/ex-accelerator/ex-accell-ui/
├── src/                          # Source code (1.4MB)
│   ├── lib/                       # Shared libraries
│   │   ├── components/            # Svelte components
│   │   ├── services/              # Database & business logic services
│   │   ├── stores/                # Svelte stores (state management)
│   │   └── countryMapping.ts      # Country mapping utility
│   ├── routes/                    # SvelteKit routes & API endpoints
│   └── app.html                   # HTML template
├── components/                    # Dapr configuration components
├── sql/                           # Database schemas & migrations
│   ├── schemas/                   # 13 SQL schema files
│   └── migrations/                # Database migrations
├── cypress/                       # Testing (18 test files)
│   ├── e2e/                       # End-to-end tests
│   ├── component/                 # Component tests
│   └── support/                   # Test utilities
├── notebooks/                     # Jupyter notebook templates
├── python-workflows/              # Generated workflow instances
├── deployed-workflows/            # Deployed workflow artifacts
├── vite.config.ts                 # Vite build configuration
├── svelte.config.js               # SvelteKit configuration
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── dapr.yaml                      # Dapr multi-app deployment config
├── package.json                   # NPM dependencies & scripts
├── pyproject.toml                 # Python project config
└── unified_social_analytics.db    # Main DuckDB database

```

### Source Directory Deep Dive

```
/src/
├── lib/
│   ├── components/
│   │   └── Navigation.svelte      # Main navigation component
│   ├── services/                  # 24 service files (8,559 LOC total)
│   │   ├── CORE DATABASE SERVICES:
│   │   │   ├── duckdb.ts          # Unified DuckDB connection & queries
│   │   │   ├── databaseInit.ts    # Database initialization
│   │   │   └── dashboardDb.ts     # Dashboard metrics queries
│   │   ├── ANALYTICS SERVICES:
│   │   │   ├── sentimentAnalysisDb.ts
│   │   │   ├── topicModelingDb.ts
│   │   │   ├── languageDetectionDb.ts
│   │   │   ├── engagementAnalysisDb.ts
│   │   │   ├── hashtagAnalysisDb.ts
│   │   │   ├── trigramsDb.ts
│   │   │   ├── androidAnalyticsDb.ts
│   │   │   └── androidResearchDb.ts
│   │   ├── DAPR SERVICES:
│   │   │   ├── daprClient.ts      # Dapr SDK client
│   │   │   ├── daprWorkflowExecutor.ts
│   │   │   ├── daprWorkflowGenerator.ts
│   │   │   ├── hybridDaprWorkflowExecutor.ts
│   │   │   ├── pythonDaprWorkflowExecutor.ts
│   │   │   └── pythonDaprWorkflowGenerator.ts
│   │   ├── JOB SCHEDULING:
│   │   │   ├── jobSchedulerService.ts
│   │   │   ├── jobStateStore.ts
│   │   │   ├── workflowExecutionService.ts
│   │   │   └── serverWorkflowService.ts
│   │   └── overviewDb.ts
│   ├── stores/
│   │   └── projectStore.ts        # Project state management
│   └── countryMapping.ts          # Country code utilities
├── routes/                        # SvelteKit route handlers
│   ├── +layout.svelte             # Root layout
│   ├── +page.svelte               # Dashboard homepage
│   ├── api/                       # API endpoints (32 server files)
│   │   ├── ANALYTICS API:
│   │   │   ├── sentiment-analysis/+server.ts
│   │   │   ├── topic-modeling/+server.ts
│   │   │   ├── language-detection/+server.ts
│   │   │   ├── engagement-analysis/+server.ts
│   │   │   ├── hashtag-analysis/+server.ts
│   │   │   └── overview/+server.ts
│   │   ├── DATA OPERATIONS API:
│   │   │   ├── unified-analytics/+server.ts (core)
│   │   │   ├── unified-analytics/query/+server.ts
│   │   │   ├── unified-analytics/seed/+server.ts
│   │   │   └── android-analytics/+server.ts
│   │   ├── JOB SCHEDULING API:
│   │   │   ├── jobs/+server.ts    # Main job scheduling endpoint
│   │   │   ├── job-state/+server.ts
│   │   │   ├── job-monitor/+server.ts
│   │   │   └── workflows/[id]/execute/+server.ts
│   │   ├── WORKFLOW API:
│   │   │   ├── workflows/+server.ts
│   │   │   ├── workflow-executions/+server.ts
│   │   │   ├── generate-python-workflow/+server.ts
│   │   │   ├── deploy-workflow/+server.ts
│   │   │   └── test-python-workflow/+server.ts
│   │   ├── GDELT API:
│   │   │   ├── gdelt/+server.ts
│   │   │   └── gdelt/mentions/+server.ts
│   │   ├── TESTING/DEBUG API:
│   │   │   ├── health/+server.ts
│   │   │   ├── test-dapr-connection/+server.ts
│   │   │   ├── debug-ui-state/+server.ts
│   │   │   ├── simple-log-test/+server.ts
│   │   │   └── test-crawler-logs/+server.ts
│   │   └── ANDROID API:
│   │       └── android-research/+server.ts
│   ├── FEATURE ROUTES:
│   │   ├── +page.svelte           # Main dashboard
│   │   ├── dashboards/+page.svelte
│   │   ├── data-capture/+page.svelte
│   │   ├── data-management/+page.svelte
│   │   ├── data-processing/+page.svelte
│   │   ├── analytics-correlation/+page.svelte
│   │   ├── gdelt/+page.svelte
│   │   ├── image-processing/+page.svelte
│   │   ├── projects/+page.svelte
│   │   ├── android-analytics/+page.svelte
│   │   ├── android-research/+page.svelte
│   │   ├── test/+page.svelte
│   │   └── TEXT-ANALYTICS MODULE:
│   │       ├── +page.svelte
│   │       ├── sentiment-analysis/+page.svelte
│   │       ├── topic-modeling/+page.svelte
│   │       ├── language-detection/+page.svelte
│   │       ├── engagement-analysis/+page.svelte
│   │       ├── hashtag-analysis/+page.svelte
│   │       ├── trigrams/+page.svelte
│   │       ├── jupyter/+page.svelte
│   │       └── research-investigation/+page.svelte
└── app.html                       # HTML template

```

---

## 2. DATABASE ARCHITECTURE

### Unified DuckDB System

**Primary Database File**: `/Users/tombarber/Projects/ex-accelerator/ex-accell-ui/unified_social_analytics.db`

**Connection Service**: `src/lib/services/duckdb.ts` (UnifiedDuckDBService)

**Database API Endpoint**: `/api/unified-analytics`

### Database Schema Files (13 Total)

Located in `/sql/schemas/`:

1. **sentiment_analysis_schema.sql** - Sentiment classification, emotion analysis, trends
2. **topic_modeling_schema.sql** - Topics, keywords, document relationships
3. **language_detection_schema.sql** - Language detection and mixing patterns
4. **engagement_analysis_schema.sql** - Post engagement metrics
5. **hashtag_analysis_schema.sql** - Hashtag performance analysis
6. **android_analytics_schema.sql** - Android device metrics
7. **android_research_schema.sql** - Android behavioral analysis
8. **dashboard_schema.sql** - Dashboard aggregation views
9. **complete_engagement_schema.sql** - Comprehensive engagement metrics
10. **language_detection_standalone_schema.sql** - Alternative language detection schema
11-13. Additional migration and utility schemas

### Core Database Tables

**Foundation Table**:
- `posts` - Central table linked to all analytics modules

**Data Source Management**:
- `data_sources` - Social media platform definitions
- `crawlers` - Data collection process tracking

**Analytics Module Tables**:
- **Sentiment**: `sentiment_classifications`, `emotion_analysis`, `sentiment_temporal_trends`, `sentiment_keywords`
- **Topics**: `topics`, `topic_keywords`, `document_topics`, `topic_relationships`, `topic_trends`
- **Language**: `languages`, `language_detection`, `language_mixing`, `language_trends`
- **Engagement**: `post_engagement`, `content_types`, `daily_engagement`, `hashtag_engagement`
- **Android**: `android_devices`, `android_app_usage`, `android_system_metrics`

### Cross-Table Analysis Views

Pre-built views for complex queries:
- `unified_post_analysis` - All posts with complete analytics data
- `cross_platform_sentiment` - Sentiment across platforms
- `topic_platform_performance` - Topic effectiveness by platform
- `language_sentiment_correlation` - Language-sentiment relationships
- `content_performance_analysis` - Content characteristics vs performance
- `analytics_dashboard_summary` - Comprehensive dashboard metrics

### Database Service Layer

**Core Service**: `src/lib/services/duckdb.ts`

```typescript
class UnifiedDuckDBService {
  - async connect()                           // Connect to unified analytics API
  - async query(sql, params)                  // Execute custom SQL
  - async queryByType(queryType, params)      // Use predefined query types
  - async getUnifiedPostAnalysis(filters)     // Cross-table analysis
  - async getCrossPlatformSentiment(filters)
  - async getTopicPlatformPerformance(filters)
  - async getLanguageSentimentCorrelation(filters)
  - async getContentPerformanceAnalysis(filters)
  - async getAnalyticsDashboardSummary()
  - isConnected()
}
```

**Module-Specific Services** (8 analytics services):

1. **dashboardDb.ts** - Dashboard metrics aggregation
2. **sentimentAnalysisDb.ts** - Sentiment analysis queries
3. **topicModelingDb.ts** - Topic discovery and trends
4. **languageDetectionDb.ts** - Language detection analytics
5. **engagementAnalysisDb.ts** - Engagement metrics
6. **hashtagAnalysisDb.ts** - Hashtag performance
7. **trigramsDb.ts** - N-gram analysis
8. **androidAnalyticsDb.ts** - Android device metrics
9. **androidResearchDb.ts** - Android behavioral research
10. **overviewDb.ts** - Overview dashboard data

---

## 3. API ENDPOINT INVENTORY

### Total API Endpoints: 32 Server Files

#### ANALYTICS ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/sentiment-analysis` | `api/sentiment-analysis/+server.ts` | GET, POST | Sentiment analysis queries |
| `/api/topic-modeling` | `api/topic-modeling/+server.ts` | GET, POST | Topic discovery and analysis |
| `/api/language-detection` | `api/language-detection/+server.ts` | GET, POST | Language detection analytics |
| `/api/engagement-analysis` | `api/engagement-analysis/+server.ts` | GET, POST | Engagement metrics |
| `/api/hashtag-analysis` | `api/hashtag-analysis/+server.ts` | GET, POST | Hashtag analytics |
| `/api/overview` | `api/overview/+server.ts` | GET | Dashboard overview metrics |
| `/api/gdelt` | `api/gdelt/+server.ts` | GET, POST | GDELT data access |
| `/api/gdelt/mentions` | `api/gdelt/mentions/+server.ts` | GET | GDELT mention filtering |

#### UNIFIED ANALYTICS ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/unified-analytics` | `api/unified-analytics/+server.ts` | GET | Core unified query interface |
| `/api/unified-analytics/query` | `api/unified-analytics/query/+server.ts` | POST | Custom SQL execution |
| `/api/unified-analytics/seed` | `api/unified-analytics/seed/+server.ts` | POST | Database seeding |

#### JOB SCHEDULING ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/jobs` | `api/jobs/+server.ts` | GET, POST, DELETE | Job scheduling core API |
| `/api/job-state` | `api/job-state/+server.ts` | GET, POST, PUT | Job state management |
| `/api/job-monitor` | `api/job-monitor/+server.ts` | GET | Job monitoring and logs |

#### WORKFLOW EXECUTION ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/workflows` | `api/workflows/+server.ts` | GET, POST | Workflow management |
| `/api/workflows/[id]` | `api/workflows/[id]/+server.ts` | GET, PUT, DELETE | Workflow details |
| `/api/workflows/[id]/execute` | `api/workflows/[id]/execute/+server.ts` | POST | Execute workflow |
| `/api/workflow-executions` | `api/workflow-executions/+server.ts` | GET, POST | Execution history |
| `/api/workflow-executions/[id]` | `api/workflow-executions/[id]/+server.ts` | GET | Execution details |
| `/api/workflow-executions/[id]/manage` | `api/workflow-executions/[id]/manage/+server.ts` | POST, PUT | Manage execution |

#### PYTHON WORKFLOW ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/generate-python-workflow` | `api/generate-python-workflow/+server.ts` | POST | Generate workflow code |
| `/api/deploy-workflow` | `api/deploy-workflow/+server.ts` | POST | Deploy workflow |
| `/api/test-python-workflow` | `api/test-python-workflow/+server.ts` | POST | Test workflow |
| `/api/test-real-workflow` | `api/test-real-workflow/+server.ts` | POST | Test actual workflow |

#### ANDROID ANALYTICS ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/android-analytics` | `api/android-analytics/+server.ts` | GET, POST | Android device metrics |
| `/api/android-research` | `api/android-research/+server.ts` | GET, POST | Android research data |

#### DEBUGGING/TESTING ENDPOINTS

| Endpoint | File | HTTP Methods | Purpose |
|----------|------|--------------|---------|
| `/api/health` | `api/health/+server.ts` | GET | Health check |
| `/api/test-dapr-connection` | `api/test-dapr-connection/+server.ts` | GET, POST | Dapr connection test |
| `/api/test-crawler-logs` | `api/test-crawler-logs/+server.ts` | GET | Crawler log testing |
| `/api/debug-ui-state` | `api/debug-ui-state/+server.ts` | GET, POST | UI state debugging |
| `/api/simple-log-test` | `api/simple-log-test/+server.ts` | GET | Simple logging test |
| `/api/log-monitor` | `api/log-monitor/+server.ts` | GET | Log monitoring |

---

## 4. SERVICE LAYER ARCHITECTURE

### 24 Service Files (8,559 Total Lines of Code)

#### DATABASE SERVICES (3 files)

**duckdb.ts** (172 lines)
- UnifiedDuckDBService singleton class
- Query execution via `/api/unified-analytics`
- Predefined query types support
- Cross-table analysis methods
- Graceful error handling

**databaseInit.ts** (3,378 lines)
- Database initialization logic
- Schema setup utilities
- Connection pooling

**dashboardDb.ts** (7,959 lines)
- Overview statistics queries
- Module status monitoring
- Recent activity tracking
- Workspace information

#### ANALYTICS SERVICES (8 files)

**sentimentAnalysisDb.ts** (11,663 lines)
- Sentiment classification queries
- Emotion analysis
- Temporal trend analysis
- Sentiment distribution by platform

**topicModelingDb.ts** (11,746 lines)
- Topic discovery queries
- Topic-document relationships
- Topic evolution tracking
- Inter-topic correlations

**languageDetectionDb.ts** (12,229 lines)
- Language detection queries
- Language mixing analysis
- Multilingual content handling
- Language trend analysis

**engagementAnalysisDb.ts** (10,950 lines)
- Engagement metrics calculation
- Content type performance
- Daily engagement trends
- Hashtag engagement ranking

**hashtagAnalysisDb.ts** (9,123 lines)
- Hashtag performance queries
- Trend identification
- Co-occurrence analysis
- Hashtag network mapping

**trigramsDb.ts** (12,619 lines)
- N-gram extraction queries
- Trigram frequency analysis
- Pattern identification
- Linguistic analysis

**androidAnalyticsDb.ts** (8,389 lines)
- Android device metrics
- App usage statistics
- System performance monitoring
- Device analytics aggregation

**androidResearchDb.ts** (14,996 lines)
- Android behavioral analysis
- Device phenotyping
- Usage pattern research
- Interaction tracking

#### DAPR SERVICES (6 files)

**daprClient.ts** (6,540 lines)
- DaprClient initialization
- Service invocation patterns
- gRPC/HTTP protocol support
- Connection lifecycle management

**daprWorkflowExecutor.ts** (26,147 lines)
- Dapr workflow execution orchestration
- State management integration
- Error handling and retries
- Workflow monitoring

**daprWorkflowGenerator.ts** (19,665 lines)
- Workflow definition generation
- Activity pattern templates
- Dapr SDK code generation

**hybridDaprWorkflowExecutor.ts** (25,307 lines)
- Hybrid execution strategies
- Multi-protocol support
- Fallback handling

**pythonDaprWorkflowExecutor.ts** (9,866 lines)
- Python workflow execution
- Script generation and deployment

**pythonDaprWorkflowGenerator.ts** (31,813 lines)
- Python workflow code generation
- Package dependency management
- Deployment script creation

#### JOB SCHEDULING SERVICES (4 files)

**jobSchedulerService.ts** (4,423 lines)
- Job scheduling API client
- Request validation
- Job status queries
- Time parsing utilities

**jobStateStore.ts** (10,633 lines)
- Job state persistence
- Redis state store integration
- Job tracking and monitoring
- State transition management

**workflowExecutionService.ts** (16,598 lines)
- Workflow execution tracking
- Execution history management
- Performance metrics collection

**serverWorkflowService.ts** (10,277 lines)
- Server-side workflow operations
- Execution orchestration

#### UTILITY SERVICES (1 file)

**overviewDb.ts** (12,354 lines)
- Overview dashboard aggregation
- Cross-module summary queries

---

## 5. COMPONENT ARCHITECTURE

### Components Inventory

Located in `/src/lib/components/`:

1. **Navigation.svelte** (17,901 bytes)
   - Main navigation component
   - Responsive menu system
   - Project selection
   - Module navigation
   - User workspace controls

### Component Import Patterns

Typical pattern used across routes:
```typescript
import Navigation from '$lib/components/Navigation.svelte';
```

---

## 6. DAPR INTEGRATION

### Dapr Configuration

**Configuration File**: `dapr.yaml`

**Multi-App Deployment Setup**:

```yaml
version: 1
common:
  resourcesPath: ./components
apps:
  - appID: ex-accell-ui
    appDirPath: ./
    appPort: 5173
    appProtocol: http
    daprHTTPPort: 3500
    daprGRPCPort: 50001
    appHealthCheckPath: "/api/health"
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
  - appID: telegram-scraper
    appDirPath: /Users/tombarber/Projects/telegram-scraper
    appPort: 6481
    appProtocol: grpc
    daprHTTPPort: 3502
    daprGRPCPort: 50002
    command: ["./telegram-scraper", "--mode", "dapr-job", "--dapr-port", "6481"]
```

### Dapr Components

Located in `/components/`:

1. **statestore.yaml** - Redis state store for job tracking
2. **pubsub.yaml** - Redis pub/sub messaging
3. **secretstore.yaml** - File-based secrets management
4. **telegram-scraper-app.yaml** - HTTP binding to telegram-scraper service

### Dapr API Access

**UI Application (port 3500)**:
- State API: `http://localhost:3500/v1.0/state/statestore`
- Pub/Sub API: `http://localhost:3500/v1.0/publish/pubsub/<topic>`
- Secrets API: `http://localhost:3500/v1.0/secrets/secretstore/<key>`

**Telegram Scraper (port 3502)**:
- Jobs API: `http://localhost:3502/v1.0-alpha1/jobs/{job-name}`

### Job Scheduling Workflow

**Service Invocation Path**:
1. UI → `/api/jobs` endpoint (port 5173)
2. Dapr SDK → Dapr sidecar (port 3500)
3. Service invocation → telegram-scraper app (port 6481)
4. Job execution via Dapr Jobs API

**Job Data Structure** (TypeScript):
```typescript
interface JobScheduleRequest {
  name: string;
  dueTime: string;  // ISO date or relative (e.g., "30s")
  data: {
    droid: string;
    task: string;
    platform: 'telegram' | 'youtube';
    urls?: string[];
    maxPosts?: number;
    concurrency?: number;
    skipMedia?: boolean;
    timeAgo?: string;
    // ... additional platform-specific fields
  };
}
```

---

## 7. JUPYTER LAB INTEGRATION

### Notebook Templates

Located in `/notebooks/`:

**Available Templates**:
1. `sentiment_analysis.ipynb` - TextBlob and VADER sentiment
2. `topic_modeling.ipynb` - LDA topic discovery
3. `text_classification.ipynb` - Custom text classifiers
4. `language_detection.ipynb` - Multi-language analysis
5. `deepseek_openllm_demo.ipynb` - DeepSeek R1 reasoning model
6. `deepseek_gdelt_integration.ipynb` - AI analysis of GDELT events
7. `ollama_gdelt_integration.ipynb` - Ollama local AI deployment
8. `custom_research.ipynb` - Blank template

**Access Point**: `/text-analytics/research-investigation`

**Server**: Runs on `http://localhost:8888`

---

## 8. PAGE ROUTES SUMMARY

### Main Pages (13 top-level routes)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/routes/+page.svelte` | Dashboard homepage with overview |
| `/dashboards` | `src/routes/dashboards/+page.svelte` | Analytics dashboards |
| `/data-capture` | `src/routes/data-capture/+page.svelte` | Job scheduling UI |
| `/data-management` | `src/routes/data-management/+page.svelte` | Data lifecycle management |
| `/data-processing` | `src/routes/data-processing/+page.svelte` | ETL workflows |
| `/analytics-correlation` | `src/routes/analytics-correlation/+page.svelte` | Cross-module analysis |
| `/gdelt` | `src/routes/gdelt/+page.svelte` | GDELT data interface |
| `/image-processing` | `src/routes/image-processing/+page.svelte` | Image analysis (planned) |
| `/projects` | `src/routes/projects/+page.svelte` | Project management |
| `/android-analytics` | `src/routes/android-analytics/+page.svelte` | Android metrics |
| `/android-research` | `src/routes/android-research/+page.svelte` | Android research |
| `/test` | `src/routes/test/+page.svelte` | Testing utilities |
| `/text-analytics` | `src/routes/text-analytics/+page.svelte` | Text analytics hub |

### Text Analytics Sub-Routes (8 nested routes)

| Route | File | Purpose |
|-------|------|---------|
| `/text-analytics/sentiment-analysis` | `sentiment-analysis/+page.svelte` | Sentiment dashboards |
| `/text-analytics/topic-modeling` | `topic-modeling/+page.svelte` | Topic discovery |
| `/text-analytics/language-detection` | `language-detection/+page.svelte` | Language analytics |
| `/text-analytics/engagement-analysis` | `engagement-analysis/+page.svelte` | Engagement metrics |
| `/text-analytics/hashtag-analysis` | `hashtag-analysis/+page.svelte` | Hashtag performance |
| `/text-analytics/trigrams` | `trigrams/+page.svelte` | N-gram analysis |
| `/text-analytics/jupyter` | `jupyter/+page.svelte` | Jupyter Lab wrapper |
| `/text-analytics/research-investigation` | `research-investigation/+page.svelte` | Notebook interface |

### Project Sub-Routes (3 nested routes)

| Route | File | Purpose |
|-------|------|---------|
| `/projects` | `projects/+page.svelte` | Project list |
| `/projects/new` | `projects/new/+page.svelte` | Create new project |
| `/projects/[id]` | `projects/[id]/+page.svelte` | Project details |

---

## 9. TEST SUITE ARCHITECTURE

### Test Files: 18 Total (Cypress)

**E2E Tests** (15 files):
1. `01-homepage.cy.ts` - Homepage functionality
2. `02-navigation.cy.ts` - Navigation flows
3. `03-dashboard.cy.ts` - Dashboard features
4. `04-sentiment-analysis.cy.ts` - Sentiment module
5. `05-topic-modeling.cy.ts` - Topic modeling
6. `06-data-capture.cy.ts` - Job scheduling UI
7. `07-projects.cy.ts` - Project management
8. `08-error-handling.cy.ts` - Error scenarios
9. `09-api-integration.cy.ts` - API tests
10. `job-scheduler.cy.ts` - Job scheduler workflow
11. `job-scheduler-api.cy.ts` - Job API testing
12. `dapr-sdk-integration.cy.ts` - Dapr SDK patterns

**Component Tests** (3 files):
1. `Navigation.cy.ts` - Navigation component
2. `JobScheduler.cy.ts` - Job scheduler component
3. `DaprJobScheduler.cy.ts` - Dapr-specific components

**Test Support Files** (2 files):
1. `support/commands.ts` - Custom Cypress commands
2. `support/e2e.ts` - E2E configuration
3. `support/component.ts` - Component test setup

### Test Coverage Areas

- UI component interaction
- API endpoint validation
- Dapr SDK integration
- Job scheduling workflows
- Error handling and validation
- Cross-browser compatibility
- Responsive design (mobile, tablet, desktop)
- Accessibility validation

---

## 10. CONFIGURATION FILES

### Build & Framework

**vite.config.ts** (210 bytes)
```typescript
import adapter from '@sveltejs/adapter-auto';
// SvelteKit plugin configuration
```

**svelte.config.js** (662 bytes)
- Vite preprocessing
- Automatic adapter selection

**tsconfig.json** (649 bytes)
- Strict type checking
- Module resolution: bundler
- Source maps enabled

### Package Management

**package.json** (2,242 bytes)
- Node version enforcement via engine-strict
- Dev dependencies: SvelteKit, Vite, TypeScript, Tailwind, Cypress
- Production dependencies:
  - `@dapr/dapr` ^3.5.2 - Dapr SDK
  - `@duckdb/node-api` ^1.3.2-alpha.25 - DuckDB
  - `echarts` ^5.6.0 - Charts library
  - `leaflet` ^1.9.4 - Maps library
  - `dapr-client` ^3.4.0 - Dapr client
  - `countries-list` ^3.1.1 - Country data

**pyproject.toml** (692 bytes)
- Python project metadata
- Poetry dependency management
- Python 3.12+ required

### Tailwind CSS

**tailwind.config.js** (existing)
- Utility-first styling
- Color schemes and theming
- Custom extensions

---

## 11. DEPENDENCY GRAPH ANALYSIS

### Critical Dependencies

**Framework**:
- SvelteKit 2.22.0 → Svelte 5.0.0
- Vite 7.0.4 (build)

**Styling**:
- Tailwind CSS 4.1.11
- PostCSS 8.5.6
- Autoprefixer 10.4.21

**Database**:
- @duckdb/node-api 1.3.2-alpha.25 (DuckDB client)

**Dapr Integration**:
- @dapr/dapr 3.5.2 (Dapr SDK for service invocation)
- dapr-client 3.4.0 (Additional Dapr utilities)

**Visualization**:
- echarts 5.6.0 (Analytics charts)
- leaflet 1.9.4 (Map visualization)

**Utilities**:
- countries-list 3.1.1 (Country data)
- http-proxy-middleware 3.0.5 (Proxy utilities)

**Testing**:
- Cypress 14.5.3 (E2E and component testing)

### Component Import Chain Example

```
Navigation.svelte
  ├── $lib/stores/projectStore.ts
  └── @sveltejs/kit (navigation, goto)

Dashboard Page (+page.svelte)
  ├── Navigation.svelte
  ├── overviewDb.ts (database queries)
  ├── projectStore.ts (state)
  └── @sveltejs/kit (routing)

Analytics Page
  ├── Navigation.svelte
  ├── Specific *AnalyticsDb.ts service
  ├── unifiedDb service (DuckDB)
  └── Fetch API → /api/* endpoints
```

---

## 12. KEY FUNCTIONALITY AREAS

### Dashboard & Overview

**Homepage** (`src/routes/+page.svelte`)
- Real-time statistics (active projects, posts analyzed)
- App module cards with status
- Recent activity feed
- System health indicators
- Quick action buttons
- Workspace information

**Services Used**:
- `overviewDb.ts` for all dashboard data
- `projectStore.ts` for project context
- `@sveltejs/kit` for navigation

### Analytics Modules

**Text Analytics Hub** (`/text-analytics`)
- Sentiment Analysis dashboard
- Topic Modeling explorer
- Language Detection analytics
- Engagement metrics
- Hashtag performance
- N-gram analysis
- Jupyter Lab integration
- Research Investigation interface

**Each Module Uses**:
- Dedicated analytics service (*AnalyticsDb.ts)
- Unified DuckDB queries
- Corresponding API endpoint

### Job Scheduling System

**Data Capture** (`/data-capture`)
- Web crawler job configuration
- Multi-step wizard (4 steps)
- Platform selection (Telegram/YouTube)
- URL input and management
- Filter and limit configuration
- Execution mode selection (immediate/delayed/scheduled)

**Services**:
- `jobSchedulerService.ts` - Client API
- `jobStateStore.ts` - State management
- `/api/jobs` endpoint - Server implementation
- Dapr SDK for service invocation

**Job Status Tracking**:
- Real-time monitoring via Job Monitor
- State persistence in Redis
- Execution log access
- Status dashboard

### Project Management

**Projects** (`/projects`)
- Create new projects
- Project listing
- Project details view
- Project-scoped analytics

**Store**: `projectStore.ts` (Svelte store)

### Workflow System

**Workflow Execution**:
- Python workflow generation
- Dapr-based deployment
- Execution tracking
- Result storage

**Services**:
- `pythonDaprWorkflowGenerator.ts` - Code generation
- `pythonDaprWorkflowExecutor.ts` - Execution
- `workflowExecutionService.ts` - Tracking

### Jupyter Integration

**Research Investigation** (`/text-analytics/research-investigation`)
- Notebook template selection
- Jupyter Lab launcher
- Embedded notebook viewer
- 8 pre-built notebook templates
- Custom research environment

---

## 13. DATA FLOW ARCHITECTURE

### Request Flow Example: Sentiment Analysis Query

```
User Browser
  ↓
+page.svelte (sentiment-analysis)
  ↓
sentimentAnalysisDb.ts
  ↓ fetch()
/api/sentiment-analysis/+server.ts
  ↓
unifiedDb.queryByType() or unifiedDb.query()
  ↓ fetch()
/api/unified-analytics/query
  ↓
DuckDB (unified_social_analytics.db)
  ↓
SQL result
  ↓
JSON response → Browser → Chart rendering (echarts)
```

### Job Scheduling Flow

```
User: Data Capture Page
  ↓ Form Submission
/api/jobs POST
  ↓
jobSchedulerService validation
  ↓
DaprClient.invokeService()
  ↓ gRPC
Dapr Sidecar (port 3500)
  ↓
Service Invocation
telegram-scraper (port 6481)
  ↓
Job Execution (Dapr Jobs API)
  ↓
Result stored in Redis state store
  ↓
UI polls /api/job-monitor for status
  ↓
Real-time updates displayed
```

### Database Service Pattern

```
UI Component
  ↓
Service Method (e.g., sentimentAnalysisDb.getSentimentByPlatform())
  ↓
unifiedDb.queryByType() or fetch('/api/unified-analytics')
  ↓
API converts to SQL query
  ↓
DuckDB execution
  ↓
Results marshaled to JSON
  ↓
Service transforms to component format
  ↓
UI renders data (with Tailwind CSS)
```

---

## 14. TECHNICAL SPECIFICATIONS

### Framework Versions
- **SvelteKit**: 2.22.0 (SSR/SSG)
- **Svelte**: 5.0.0 (Component framework)
- **TypeScript**: 5.0.0 (Type safety)
- **Vite**: 7.0.4 (Build tool)
- **Node.js**: 18+ (engine requirement)
- **npm**: 8.x (package manager)

### Styling Stack
- **Tailwind CSS**: 4.1.11 (utility-first)
- **PostCSS**: 8.5.6 (CSS transformation)
- **Tailwind plugins**: @tailwindcss/forms, @tailwindcss/typography, @tailwindcss/aspect-ratio

### Data & Persistence
- **Primary DB**: DuckDB (unified_social_analytics.db)
- **State Store**: Redis (via Dapr)
- **Cache**: In-memory (component state)

### Deployment
- **Adapter**: @sveltejs/adapter-auto
- **Container**: Docker (Dockerfile present)
- **Orchestration**: Dapr (multi-app deployment)
- **Process Manager**: npm scripts

### API Communication
- **Primary**: Fetch API (HTTP)
- **Dapr**: gRPC + HTTP protocols
- **Proxy**: http-proxy-middleware

---

## 15. FILE STATISTICS & METRICS

### Code Metrics

| Category | Count | Size |
|----------|-------|------|
| Service files | 24 | 8,559 LOC |
| Route pages | 21 | Various |
| API endpoints | 32 | Various |
| Components | 1 | 17,901 bytes |
| SQL schemas | 13 | Various |
| Test files | 18 | Various |
| Configuration files | 8 | Various |

### Project Size
- **Total Source**: 1.4MB
- **Source Code**: 8,559 LOC (services)
- **Database**: 12,288 bytes (current)
- **Node Modules**: ~340MB (not included in analysis)

### Development Tools
- **Testing**: Cypress (component + E2E)
- **Type Checking**: svelte-check
- **Linting**: (potentially via SvelteKit)
- **Build**: Vite with SvelteKit adapter

---

## 16. EXTENSION POINTS & CUSTOMIZATION

### Adding New Analytics Modules

**Pattern**:
1. Create `src/lib/services/newModuleDb.ts` (database service)
2. Create `/api/new-module/+server.ts` (API endpoint)
3. Create `src/routes/text-analytics/new-module/+page.svelte` (UI page)
4. Add SQL schema in `sql/schemas/new_module_schema.sql`
5. Add Cypress tests in `cypress/e2e/` and `cypress/component/`

### Adding New API Endpoints

**Pattern**:
1. Create route directory: `/api/new-endpoint/`
2. Implement `+server.ts` with request handlers
3. Import necessary services
4. Return JSON responses

### Adding Jupyter Notebooks

**Pattern**:
1. Create `.ipynb` file in `/notebooks/`
2. Update `research-investigation/+page.svelte` notebookTemplates array
3. Include proper metadata (id, name, description, file)

### Dapr Service Integration

**Pattern**:
1. Update `dapr.yaml` with new app config
2. Create component YAML in `/components/`
3. Use DaprClient for service invocation
4. Implement corresponding API endpoint

---

## 17. BUILD & DEPLOYMENT

### Development Workflow

```bash
npm run dev                    # Standard dev server (port 5173)
npm run dev:jupyter          # Dev + Jupyter Lab (port 8888)
npm run dev:dapr             # Dev + Dapr deployment
npm run check                # Type checking
npm run cypress:open         # Interactive testing
```

### Production Build

```bash
npm run build                # Production build
npm run preview              # Preview production build
npm run preview:dapr         # Preview with Dapr
```

### Database Operations

```bash
npm run dapr:init            # Initialize Dapr
npm run dapr:setup           # Setup dependencies
npm run dapr:logs            # Monitor Dapr logs
npm run dapr:stop            # Stop services
```

### Testing

```bash
npm run test                 # Run all tests
npm run cypress:run          # Headless testing
npm run test:e2e             # E2E only
npm run test:component       # Component only
npm run test:integration     # Integration tests
```

---

## 18. SUMMARY & KEY INSIGHTS

### Architecture Overview

The ex-accelerator UI is a modern, full-stack analytics frontend built with:

1. **Frontend**: SvelteKit 2.x with Svelte 5.x components
2. **Styling**: Tailwind CSS utility-first framework
3. **Data**: Unified DuckDB database with cross-table analysis views
4. **Services**: 24 specialized service files handling analytics, workflows, and job scheduling
5. **APIs**: 32 REST endpoints covering analytics, job scheduling, and workflow management
6. **Integration**: Dapr microservices for distributed job execution
7. **Analytics**: Jupyter Lab integration for advanced research

### Key Strengths

- **Unified Database**: Single source of truth for all analytics data
- **Cross-Module Analysis**: Pre-built views for complex queries
- **Modular Services**: Each analytics domain has dedicated service layer
- **Comprehensive APIs**: 32 endpoints covering all features
- **Dapr Integration**: Distributed job scheduling and execution
- **Type Safety**: Full TypeScript implementation
- **Testing**: Comprehensive Cypress test suite (18 files)

### Critical Components

1. `duckdb.ts` - Central database service
2. `/api/unified-analytics/*` - Core data access layer
3. `/api/jobs` - Job scheduling interface
4. 8 analytics services - Domain-specific queries
5. Dapr client & workflow executors - Distributed orchestration

---

**Report Generated**: 2025-11-10
**Codebase Analyzed**: /Users/tombarber/Projects/ex-accelerator/ex-accell-ui
**Total Analysis Time**: Comprehensive

