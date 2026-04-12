# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cognee Knowledge Graph (Shared Memory)

This project is connected to a shared Cognee knowledge graph via MCP. The project dataset is **`ex-accelerator-codebase`**. When the `cognee` MCP server is available, use it as the **primary source for storing and retrieving project knowledge**.

### Retrieving Knowledge
- Before exploring the codebase for architectural questions, **search Cognee first** using the `search` tool with `search_type: "GRAPH_COMPLETION"` for natural language questions or `"CHUNKS"` for specific passages.
- The `ex-accelerator-codebase` dataset contains comprehensive documentation of the project's routes, API endpoints, database schema, services, components, architecture, and data flows.
- If Cognee returns relevant results, use them to inform your work without redundant file reads.
- If Cognee is unavailable or returns no results, fall back to reading the codebase directly. Do not error or block on Cognee being down.

### Storing Knowledge
- When you learn something significant about the project that isn't already in the knowledge graph (new features, architectural decisions, major refactors, integration patterns), **save it to Cognee** using the `cognify` or `save_interaction` tools.
- **Always use the dataset name `ex-accelerator-codebase`** when adding data. Example: when calling the Cognee add API or cognify tool, data should target this dataset so all project knowledge stays in one place.
- Keep entries focused and descriptive — Cognee builds a knowledge graph from entities and relationships, so clear, structured text produces better results.
- Do not store ephemeral information (debugging sessions, temporary workarounds). Store durable knowledge that helps future sessions and other team members.

### Graceful Degradation
- The Cognee MCP server may not always be available (network issues, server restarts, Tailscale disconnected).
- If any Cognee tool call fails, **continue working normally** using local files and the codebase. Never block progress on Cognee availability.
- Do not repeatedly retry failed Cognee calls within the same task.

## Project Overview

This is the frontend UI component of the ex-accelerator project, built with SvelteKit 2.x, TypeScript, and Vite. It's a minimal Svelte application setup with modern tooling.

## Architecture

- **Framework**: SvelteKit 2.x with Svelte 5.x
- **Build Tool**: Vite 7.x
- **Language**: TypeScript 5.x
- **CSS Framework**: Tailwind CSS 3.x (MANDATORY for all styling)
- **Package Manager**: npm (with engine-strict=true for version enforcement)
- **Adapter**: @sveltejs/adapter-auto for automatic deployment detection
- **Runtime**: Dapr-enabled for microservices architecture
- **Database**: Unified DuckDB database with SQL queries (MANDATORY for data persistence and analytics)

## Common Commands

### Development
```bash
# Start development server
npm run dev

# Start development server with Jupyter Lab integration
npm run dev:jupyter

# Start development server with Dapr sidecar
npm run dev:dapr

# Start development server and open in browser
npm run dev -- --open

# Install dependencies
npm install
```

### Dapr Commands (Unified Deployment)
```bash
# Initialize Dapr (first time setup)
npm run dapr:init

# One-time setup: check dependencies, build telegram-scraper, start Redis
npm run dapr:setup

# Start unified deployment (UI + telegram-scraper + Dapr)
npm run dev:dapr

# Stop all Dapr services
npm run dapr:stop

# View deployment logs in real-time
npm run dapr:logs

# Preview with Dapr sidecar
npm run preview:dapr

# Test job scheduling integration
npm run test:integration
```

### Jupyter Lab Integration
```bash
# Bootstrap notebook environment (run once)
npm run jupyter:bootstrap

# Start only Jupyter Lab server
npm run jupyter:start

# Start both SvelteKit dev server and Jupyter Lab
npm run dev:jupyter
```

### Building and Type Checking
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Type check without build
npm run check

# Type check with watch mode
npm run check:watch

# Prepare/sync SvelteKit
npm run prepare
```

**IMPORTANT**: After implementing database integration, always run `npm run build` to ensure:
- TypeScript compilation succeeds
- Database service imports are resolved correctly
- Charts and data loading work properly
- No runtime errors in the dashboard

**CRITICAL**: For any new UI functionality, you MUST create corresponding Cypress test cases:
- Add component tests for new components in `cypress/component/`
- Add E2E tests for new pages in `cypress/e2e/`
- Include both positive and negative test scenarios
- Test responsive design across mobile, tablet, and desktop
- Validate accessibility and error handling
- Run `npm run cypress:run` to verify all tests pass before completion

### Testing Framework
```bash
# Run all tests
npm run test

# Run Cypress tests interactively
npm run cypress:open

# Run all E2E and component tests
npm run cypress:run

# Run E2E tests only
npm run test:e2e

# Run component tests only
npm run test:component

# Run Dapr integration tests
npm run test:integration
```

## Key Technical Details

### Project Structure
- Standard SvelteKit project structure with `src/` containing app logic
- `src/routes/+page.svelte` - Main page component
- `src/routes/text-analytics/research-investigation/+page.svelte` - Research Investigation interface
- `src/lib/components/Navigation.svelte` - Main navigation component
- `src/lib/` - Shared library components
- `src/app.html` - HTML template
- `static/` - Static assets
- `notebooks/` - Jupyter notebook templates

### Configuration
- **Vite**: Basic SvelteKit plugin configuration in `vite.config.ts`
- **Svelte**: Auto-adapter with preprocessing in `svelte.config.js`
- **TypeScript**: Standard config in `tsconfig.json`
- **Tailwind CSS**: Configuration in `tailwind.config.js` with PostCSS in `postcss.config.js`
- **npm**: Engine-strict mode enabled in `.npmrc`
- **Dapr**: Configuration in `dapr.yaml` with components in `components/` directory

### Current State
This is a fresh SvelteKit project with minimal customization - just the default welcome page. The project is ready for development but contains no custom business logic yet.

## Integration Notes

This UI project is part of a larger ex-accelerator system that includes:
- ETL pipeline (`../etl/`) for data processing
- Superset (`../superset/`) for analytics dashboards

The UI component is positioned to serve as the main user interface, potentially consuming data from the ETL pipeline and integrating with the analytics components.

## Jupyter Lab Integration

The project includes full Jupyter Lab integration for advanced text analytics research and experimentation.

### Features
- **Interactive Notebooks**: Pre-configured notebook templates for sentiment analysis, topic modeling, text classification, and more
- **Embedded Viewer**: View and interact with notebooks directly within the web application
- **Text Analytics Libraries**: Pre-installed with pandas, numpy, matplotlib, seaborn, scikit-learn, nltk, textblob, and more
- **Automatic Setup**: Bootstrap script downloads required NLTK data and creates sample notebooks

### Notebook Templates
Located in `notebooks/` directory:
- `sentiment_analysis.ipynb` - Sentiment analysis with TextBlob and VADER
- `topic_modeling.ipynb` - Topic discovery with LDA
- `text_classification.ipynb` - Custom text classifiers
- `language_detection.ipynb` - Multi-language text analysis
- `deepseek_openllm_demo.ipynb` - Comprehensive demo of DeepSeek R1 model capabilities
- `deepseek_gdelt_integration.ipynb` - AI-powered analysis of GDELT events using DeepSeek R1
- `custom_research.ipynb` - Blank template for custom research

### Getting Started
1. **Bootstrap Environment**: `npm run jupyter:bootstrap` (run once)
2. **Start Development**: `npm run dev:jupyter` (starts both SvelteKit and Jupyter Lab)
3. **Access Interface**: Navigate to `/text-analytics/research-investigation` or use the "Research Investigation" menu item
4. **Select Template**: Choose a notebook template and click "Start JupyterLab"
5. **Analyze**: Use the embedded viewer or open directly in Jupyter Lab

### Adding New Notebook Templates

To add a new Jupyter notebook template to the Research Investigation interface:

1. **Create the Notebook**: Place your `.ipynb` file in the `notebooks/` directory
2. **Update Template List**: Edit `/src/routes/text-analytics/research-investigation/+page.svelte`
3. **Add to `notebookTemplates` array**:
   ```javascript
   {
     id: 'your_notebook_id',
     name: 'Display Name',
     description: 'Brief description of what this notebook does',
     file: 'your_notebook_file.ipynb'
   }
   ```
4. **Special Considerations**:
   - For AI-powered notebooks (like DeepSeek), use an `id` containing 'deepseek' to auto-display setup instructions
   - The `file` name should match exactly what's in the `notebooks/` directory
   - Use descriptive names and clear descriptions for better user experience

**Template Structure Example**:
```javascript
{
  id: 'my_analysis_notebook',
  name: 'My Data Analysis',
  description: 'Custom analysis for specific dataset with visualization',
  file: 'my_analysis_notebook.ipynb'
}
```

The notebook will automatically appear in the Research Investigation interface with proper styling and functionality.

### Configuration
- **Jupyter Lab**: Configured for iframe embedding with CORS support
- **Python Environment**: Managed with Poetry (Python 3.12+)
- **NLTK Data**: Automatically downloaded during bootstrap
- **Server**: Runs on `http://localhost:8888` by default

## DeepSeek R1 Integration

The project includes full integration with DeepSeek R1, a state-of-the-art reasoning model, through OpenLLM.

### Features
- **Advanced AI Analysis**: Use DeepSeek R1 for complex reasoning and analysis tasks
- **GDELT Integration**: AI-powered analysis of global events and geopolitical patterns
- **Interactive Q&A**: Ask natural language questions about your data
- **Code Generation**: AI-assisted code generation for data analysis
- **OpenAI-Compatible API**: Standard API interface through OpenLLM

### Setup
1. **Install Dependencies**: Already included in Poetry configuration
2. **Download Model**: `poetry run openllm model get deepseek:r1-llama3.1-8b`
3. **Start Server**: `poetry run openllm serve deepseek:r1-llama3.1-8b --port 3000`

### Usage
- **Demo Notebook**: `deepseek_openllm_demo.ipynb` - Comprehensive capabilities demo
- **GDELT Analysis**: `deepseek_gdelt_integration.ipynb` - Real-world geopolitical analysis
- **API Endpoint**: `http://localhost:3000/v1/chat/completions`

### Requirements
- **GPU**: 24GB VRAM recommended (DeepSeek R1 8B model)
- **CPU Fallback**: Works on CPU but significantly slower
- **Memory**: 32GB+ RAM for optimal performance

## Dapr Integration

This project is configured as a unified Dapr deployment with microservices capabilities and full telegram-scraper integration for job scheduling:

### Unified Deployment Architecture
The project uses a single `dapr.yaml` configuration file that manages both applications:
- **ex-accell-ui**: SvelteKit frontend with job scheduling API endpoints
- **telegram-scraper**: Go-based crawler service running in Dapr job mode

### Dapr Components
- **State Store**: Redis-based state management (`components/statestore.yaml`)  
- **Pub/Sub**: Redis-based messaging (`components/pubsub.yaml`)
- **Secret Store**: File-based secrets management (`components/secretstore.yaml`)
- **Job Store**: Etcd-based job scheduling (`components/jobstore.yaml`)
- **Telegram Scraper**: HTTP binding to telegram-scraper service (`components/telegram-scraper-app.yaml`)

### Dapr Configuration (Multi-App Deployment)
- **UI App**: 
  - App ID: `ex-accell-ui`
  - HTTP Port: 3500 (Dapr sidecar)
  - gRPC Port: 50001 (Dapr sidecar)
  - App Port: 5173 (dev) / 4173 (preview)
- **Telegram Scraper**:
  - App ID: `telegram-scraper`
  - HTTP Port: 3502 (Dapr sidecar)
  - gRPC Port: 50002 (Dapr sidecar)
  - App Port: 3003 (scraper service)
  - Protocol: gRPC
- **State Management**:
  - Redis state store for job tracking
  - Dapr State API for persistent job states
  - Real-time job status updates
  - Scheduler Host: localhost (for job scheduling)

### Job Scheduling Integration
- **Job Handlers**: R2-D2, C-3PO, BB-8, my-scheduled-job
- **State Store APIs**:
  - `/api/jobs` - Core job scheduling and retrieval
  - `/api/job-state` - Dedicated job state management for crawlers
  - Real-time job status tracking with Redis state store
  - Automatic job state persistence during scheduling and execution
- **API Endpoints**: `/api/jobs` (POST, GET, DELETE)
- **Job Store**: Uses Dapr's built-in job scheduling capabilities
- **Storage**: Local directory `./telegram-data` for scraped content

### Prerequisites for Dapr
```bash
# Install Dapr CLI (if not already installed)
wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash

# Initialize Dapr
npm run dapr:init

# Setup deployment dependencies (Redis, telegram-scraper binary)
npm run dapr:setup

# Start Redis (required for state store and pub/sub)
docker run -d --name redis-dapr -p 6379:6379 redis:alpine
```

### Dapr API Access
When running with unified Dapr deployment, the following APIs are available:

**UI Application (port 3500):**
- State API: `http://localhost:3500/v1.0/state/statestore`
- Pub/Sub API: `http://localhost:3500/v1.0/publish/pubsub/<topic>`
- Secrets API: `http://localhost:3500/v1.0/secrets/secretstore/<key>`

**Telegram Scraper (port 3501):**
- Jobs API: `http://localhost:3501/v1.0-alpha1/jobs/{job-name}`
- Health Check: `http://localhost:3501/v1.0/healthz`

**Job Scheduling Workflow:**
1. **Web Interface**: Access `/data-capture` page to create jobs
2. **API Endpoint**: POST to `/api/jobs` (internal routing to port 3501)
3. **Job Execution**: Monitor logs via `npm run dapr:logs`

## Telegram Scraper Job Scheduling

The UI provides full integration with the telegram-scraper using Dapr's unified deployment and job scheduling capabilities. This allows users to schedule, monitor, and manage crawler jobs through a web interface.

### Quick Start
```bash
# 1. Setup dependencies (one-time)
npm run dapr:setup

# 2. Start unified deployment
npm run dev:dapr

# 3. Access web interface
# Navigate to: http://localhost:5173/data-capture?tab=crawler

# 4. Monitor job execution
npm run dapr:logs
```

### Features

- **Unified Deployment**: Single command starts both UI and telegram-scraper
- **Web-based Job Scheduling**: Create crawler jobs through the Data Capture interface
- **Multiple Execution Modes**: 
  - Immediate execution (run now)
  - Delayed execution (run after specified delay)
  - Scheduled execution (run at specific time)
- **Platform Support**: Both Telegram and YouTube crawling
- **Job Management**: View, monitor, and delete scheduled jobs
- **Real-time Status**: Live job status updates and progress tracking
- **Error Handling**: Comprehensive error reporting and validation

### Job Scheduling Workflow

1. **Configure Crawler Job**:
   - Navigate to Data Capture → Web Crawler
   - Complete the 4-step configuration process:
     - Basic Settings (job name, concurrency, etc.)
     - Platform & URLs (Telegram/YouTube channels)
     - Filters & Limits (date ranges, post limits)
     - Review & Schedule (execution timing)

2. **Schedule Job Execution**:
   - Choose execution mode (immediate, delayed, or scheduled)
   - Configure timing parameters
   - Submit job to Dapr Jobs API

3. **Monitor Job Status**:
   - View all jobs on the Schedule tab
   - Track job progress and status
   - Access job logs and results

### API Integration

The system provides the following endpoints for job management:

- **POST** `/api/jobs` - Schedule a new crawler job
- **GET** `/api/jobs` - List all scheduled jobs
- **GET** `/api/jobs?name={jobName}` - Get specific job details
- **DELETE** `/api/jobs?name={jobName}` - Delete a scheduled job

### Job Configuration Example

Following the [Dapr Jobs quickstart](https://github.com/dapr/quickstarts/tree/master/jobs/javascript/http) format:

```typescript
{
  name: "telegram-crawl-2024-01-01T12-00-00-000Z",
  dueTime: "30s", // or ISO date for scheduled execution
  data: {
    value: "telegram:{\"urls\":[\"@channel1\",\"@channel2\"],\"platform\":\"telegram\",\"crawlId\":\"my-crawl-001\",\"maxPosts\":1000,\"skipMedia\":true,\"timeAgo\":\"30d\"}"
  }
}
```

The `value` field contains a colon-separated format: `platform:jsonConfig` similar to the quickstart's `droid:task` format.

### Development Setup

To test the complete job scheduling workflow, following the [Dapr Jobs quickstart](https://github.com/dapr/quickstarts/tree/master/jobs/javascript/http) approach:

#### Option 1: Multi-App Dapr Run (Recommended)
```bash
# 1. Initialize Dapr (first time only)
npm run dapr:init

# 2. Start both applications with multi-app configuration
npm run start:dapr-multi
```

#### Option 2: Individual App Start
```bash
# 1. Initialize Dapr (first time only)
npm run dapr:init

# 2. Start telegram-scraper in job mode
npm run telegram-scraper:start

# 3. Start UI with Dapr sidecar  
npm run dev:dapr
```

#### Access Points:
- **UI**: `http://localhost:5173`
- **Dapr Jobs API**: `http://localhost:3500/v1.0-alpha1/jobs/telegram-scraper`
- **Telegram Scraper**: `http://localhost:3501` (Dapr sidecar)

### Testing

The implementation includes comprehensive test coverage:

- **E2E Tests**: Full user workflow testing (`cypress/e2e/job-scheduler.cy.ts`)
- **Component Tests**: Individual component validation (`cypress/component/JobScheduler.cy.ts`)
- **API Tests**: Backend job scheduling validation
- **Error Handling**: Edge cases and failure scenarios

Run tests with:
```bash
npm run cypress:run
```

## Dapr Job Scheduler Testing

### Test Coverage Overview

The project includes comprehensive testing for the Dapr SDK job scheduler integration:

#### 1. API Endpoint Tests (`cypress/e2e/job-scheduler-api.cy.ts`)
- **Dapr SDK Integration**: Tests service invocation patterns
- **Job Data Transformation**: Validates data format for `telegram-scraper` JobData struct
- **Error Handling**: Connection errors, validation failures, timeouts
- **Platform Support**: Both Telegram and YouTube job configurations
- **State Store Integration**: Job state tracking and persistence
- **Concurrent Operations**: Multiple job scheduling and resource management

#### 2. Dapr SDK Integration Tests (`cypress/e2e/dapr-sdk-integration.cy.ts`)
- **Service Invocation**: Direct app-to-app communication via Dapr SDK
- **Job Handler Registration**: Predefined job names (R2-D2, C-3PO, BB-8, my-scheduled-job)
- **gRPC Communication**: Protocol-specific testing for job-service communication
- **Multi-App Deployment**: Port configuration and service discovery
- **Performance Testing**: Load testing and concurrent job handling
- **Resource Cleanup**: Memory management and connection lifecycle

#### 3. Component Tests (`cypress/component/DaprJobScheduler.cy.ts`)
- **UI Components**: Dapr-specific form elements and status indicators
- **Connection Status**: Real-time Dapr sidecar and service connectivity
- **Job Status Display**: State store integration with job execution logs
- **Error Messages**: Dapr-specific error handling and user feedback
- **Data Transformation**: Frontend form data to JobData struct mapping

### Testing Best Practices

#### API Testing Pattern
```typescript
describe('Dapr SDK Job Scheduling', () => {
  it('should schedule job via service invocation', () => {
    const jobRequest = {
      name: 'test-job',
      dueTime: '30s',
      data: {
        droid: 'test-job',
        task: 'crawl:telegram',
        platform: 'telegram',
        urls: ['@testchannel']
      }
    };

    cy.intercept('POST', '/api/jobs', {
      statusCode: 200,
      body: {
        success: true,
        job: { method: 'dapr-sdk', scheduled: true },
        message: 'Job scheduled successfully'
      }
    }).as('scheduleJob');

    cy.request('POST', '/api/jobs', jobRequest);
    cy.wait('@scheduleJob');
  });
});
```

#### Component Testing Pattern
```typescript
describe('Dapr Job Components', () => {
  it('should display service status', () => {
    mount(`
      <div class="flex items-center">
        <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
        <span>Dapr Sidecar (localhost:3500)</span>
      </div>
    `);
    
    cy.contains('Dapr Sidecar').should('be.visible');
    cy.get('.bg-green-500').should('exist');
  });
});
```

### Test Data Patterns

#### Telegram Job Configuration
```typescript
const telegramJob = {
  name: 'telegram-test-job',
  dueTime: '1m',
  data: {
    droid: 'telegram-test-job',
    task: 'crawl:telegram',
    platform: 'telegram',
    urls: ['@channel1', '@channel2'],
    maxPosts: 1000,
    concurrency: 2,
    skipMedia: true,
    timeAgo: '30d'
  }
};
```

#### YouTube Job Configuration
```typescript
const youtubeJob = {
  name: 'youtube-test-job',
  dueTime: '15m',
  data: {
    droid: 'youtube-test-job', 
    task: 'crawl:youtube',
    platform: 'youtube',
    urls: ['UCChannel1', 'UCChannel2'],
    youtubeApiKey: 'test-api-key',
    samplingMethod: 'channel',
    minChannelVideos: 50,
    sampleSize: 100
  }
};
```

### Error Testing Scenarios

#### Connection Failures
- Dapr sidecar unavailable (port 3500)
- telegram-scraper service unreachable (port 6481)
- State store (Redis) connection issues
- gRPC communication failures

#### Validation Errors  
- Missing required job fields
- Invalid platform configurations
- Malformed job data structures
- Large payload handling

#### Timeout Scenarios
- Long-running job scheduling operations
- Service invocation timeouts
- State store operation delays

### Running Tests

#### Development Testing
```bash
# Run all job scheduler tests
npm run cypress:run -- --spec "cypress/e2e/*job*"

# Run API tests only
npm run cypress:run -- --spec "cypress/e2e/job-scheduler-api.cy.ts"

# Run Dapr integration tests
npm run cypress:run -- --spec "cypress/e2e/dapr-sdk-integration.cy.ts"

# Run component tests
npm run cypress:run -- --component --spec "cypress/component/*Job*.cy.ts"
```

#### CI/CD Integration
```bash
# Complete test suite (used in CI)
npm run cypress:run

# Test with coverage reporting
npm run test:coverage

# Integration test with live Dapr services
npm run test:integration
```

### Test Environment Setup

#### Prerequisites
- Dapr CLI installed and initialized (`dapr init`)
- Redis running for state store (automatic via `npm run dapr:setup`)
- telegram-scraper binary built and available

#### Mock Services
Tests use comprehensive mocking for:
- Dapr SDK service invocation responses
- State store operations
- gRPC communication patterns
- Job execution workflows

#### Real Integration Testing
For end-to-end validation:
1. Start unified deployment: `npm run dev:dapr`
2. Run integration tests: `npm run test:integration`
3. Monitor logs: `npm run dapr:logs`

This ensures the complete Dapr job scheduling pipeline functions correctly from UI → Dapr SDK → telegram-scraper → job execution.

## Database Integration Guidelines

**CRITICAL: This project uses a unified DuckDB database (`unified_social_analytics.db`) for all data operations. All analytics modules connect to the same database for cross-table analysis capabilities.**

### Unified Database Architecture

The application uses a single DuckDB database that combines all analytics modules:

**Database File**: `unified_social_analytics.db` - Single source of truth for all analytics  
**Schema File**: `unified_social_analytics_schema.sql` - Complete database structure  
**Connection Service**: `src/lib/services/duckdb.ts` (UnifiedDuckDBService)

**Core Tables**:
- `posts` - Foundation table for all analytics (linked to all modules)
- `data_sources` - Social media platforms (Twitter, Facebook, Instagram, etc.)
- `crawlers` - Data collection processes

**Analytics Module Tables**:
- **Sentiment Analysis**: `sentiment_classifications`, `emotion_analysis`, `sentiment_temporal_trends`, `sentiment_keywords`
- **Topic Modeling**: `topics`, `topic_keywords`, `document_topics`, `topic_relationships`, `topic_trends`
- **Language Detection**: `languages`, `language_detection`, `language_mixing`, `language_trends`
- **Engagement Analysis**: `post_engagement`, `content_types`, `daily_engagement`, `hashtag_engagement`
- **Android Analytics**: `android_devices`, `android_app_usage`, `android_system_metrics`

**Cross-Table Analysis Views** (Pre-built for complex queries):
- `unified_post_analysis` - Every post with ALL analytics data (sentiment, topics, language, engagement)
- `cross_platform_sentiment` - Sentiment analysis across all platforms
- `topic_platform_performance` - Topic performance by platform
- `language_sentiment_correlation` - Language-sentiment relationships
- `content_performance_analysis` - Content performance by characteristics
- `analytics_dashboard_summary` - Comprehensive dashboard metrics

### Mandatory Database Architecture

When asked to implement database integration or data-driven features, you MUST use the unified database:

1. **Use Unified Connection** (`src/lib/services/duckdb.ts`):
   - Import `unifiedDb` from the DuckDB service
   - Connect to the unified analytics database
   - Use cross-table analysis views for complex queries

2. **Database Service Pattern**:
   - All services connect to the same unified database
   - Use `unifiedDb.queryByType()` for predefined query types
   - Use `unifiedDb.query()` for custom SQL queries
   - Leverage cross-table analysis views for advanced insights

3. **Cross-Table Analysis Integration**:
   - Use `unified_post_analysis` view for comprehensive post data
   - Query multiple modules simultaneously (sentiment + topics + language + engagement)
   - Enable platform comparisons and correlation analysis
   - Avoid separate database connections

### Database Service Pattern

```typescript
import { unifiedDb } from './duckdb';

class FeatureDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return;
    // Connect to unified DuckDB service
    await unifiedDb.connect();
    this.initialized = true;
  }

  async getFeatureData(filters: any = {}) {
    if (!this.initialized) await this.connect();
    
    // Use unified database for cross-table analysis
    return unifiedDb.queryByType('feature-data', filters);
  }

  async getCrossTableAnalysis(filters: any = {}) {
    if (!this.initialized) await this.connect();
    
    // Advanced cross-table analysis using unified views
    return unifiedDb.getUnifiedPostAnalysis(filters);
  }

  async exportFeatureData(filters: any = {}) {
    // Export with cross-table analysis data
    const data = await this.getFeatureData(filters);
    const crossData = await this.getCrossTableAnalysis(filters);
    
    return {
      exportDate: new Date().toISOString(),
      data,
      crossTableAnalysis: crossData,
      filters
    };
  }
}

export const featureDb = new FeatureDatabase();
```

### Dashboard Integration Pattern

```svelte
<script lang="ts">
  import { unifiedDb } from '$lib/services/duckdb';
  
  let loading = true;
  let featureData = [];
  let crossTableData = [];
  
  async function loadFeatureData() {
    try {
      // Load feature-specific data
      featureData = await unifiedDb.queryByType('feature-data', filters);
      
      // Load cross-table analysis for advanced insights
      crossTableData = await unifiedDb.getUnifiedPostAnalysis(filters);
      
      loading = false;
    } catch (error) {
      console.error('Unified database error:', error);
      throw error; // No fallback - database required
    }
  }
  
  onMount(loadFeatureData);
  
  // Reactive filtering with unified database queries
  $: if (filtersChanged && !loading) {
    loadFeatureData();
  }
</script>

{#if loading}
  <div>Loading unified analytics data...</div>
{:else}
  <!-- Render data-driven content with cross-table insights -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Feature-specific data -->
    <div>Feature Data: {featureData.length} items</div>
    
    <!-- Cross-table analysis insights -->
    <div>Cross-Table Analysis: {crossTableData.length} posts analyzed</div>
  </div>
{/if}
```

### When to Use Unified Database Integration

**ALWAYS use unified DuckDB approach when:**
- Implementing analytics dashboards or data visualizations
- Asked to "use SQL tables and queries" or "database-driven"
- Creating features that process, filter, or analyze data
- Building cross-platform or cross-module analysis features
- Implementing search, filtering, or reporting functionality
- Enabling correlation analysis between different analytics modules

**Cross-Table Analysis is REQUIRED for:**
- Comparing sentiment across platforms
- Analyzing topic performance by platform
- Language-sentiment correlation studies
- Content type effectiveness analysis
- Multi-dimensional filtering and insights

### Unified Database Implementation

The application now uses a single database with these key services:

- **Core Connection**: `src/lib/services/duckdb.ts` (UnifiedDuckDBService)
- **Dashboard**: `src/lib/services/dashboardDb.ts` - Cross-platform dashboard metrics
- **Sentiment Analysis**: `src/lib/services/sentimentAnalysisDb.ts` - Multi-platform sentiment
- **Topic Modeling**: `src/lib/services/topicModelingDb.ts` - Cross-platform topic analysis
- **Language Detection**: `src/lib/services/languageDetectionDb.ts` - Language patterns
- **Engagement Analysis**: `src/lib/services/engagementAnalysisDb.ts` - Performance metrics

**Schema File**: `unified_social_analytics_schema.sql` - Complete unified structure

### Forbidden Data Approaches

❌ **NEVER do this:**
```typescript
// Hardcoded in-memory data
let topics = [
  { id: 1, name: 'Tech', posts: 100 },
  { id: 2, name: 'Health', posts: 50 }
];

// Direct array manipulation
const filteredTopics = topics.filter(t => t.posts > 75);
```

✅ **ALWAYS do this instead:**
```typescript
// Database-driven approach
let topics = [];
let loading = true;

async function loadTopics() {
  topics = await topicDb.getTopics(filters);
  loading = false;
}
```

## CSS and Styling Guidelines

**CRITICAL: This project uses Tailwind CSS exclusively for all styling. Never use vanilla CSS, CSS modules, or any other styling approach.**

### Mandatory Styling Rules

1. **ALWAYS use Tailwind CSS classes** - Never write custom CSS styles
2. **No `<style>` blocks** - All styling must be done with Tailwind classes
3. **No inline styles** - Use Tailwind utility classes instead
4. **Component styling** - Use Tailwind classes in the `class` attribute

### Common Tailwind Patterns for This Project

#### Layout & Spacing
```html
<!-- Containers and layout -->
<div class="container mx-auto px-4">
<div class="max-w-4xl mx-auto">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- Flexbox patterns -->
<div class="flex items-center justify-between">
<div class="flex flex-col space-y-4">
```

#### Colors (Use project color scheme)
```html
<!-- Primary colors -->
<div class="bg-blue-600 text-white">
<button class="bg-blue-600 hover:bg-blue-700">

<!-- Secondary/neutral colors -->
<div class="bg-gray-100 text-gray-900">
<div class="border border-gray-300">
```

#### Typography
```html
<!-- Headings -->
<h1 class="text-4xl font-bold text-gray-900">
<h2 class="text-2xl font-semibold text-gray-800">

<!-- Body text -->
<p class="text-lg text-gray-600">
<span class="text-sm text-gray-500">
```

#### Interactive Elements
```html
<!-- Buttons -->
<button class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">

<!-- Links -->
<a class="text-blue-600 hover:text-blue-800 underline">

<!-- Forms -->
<input class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
```

#### Responsive Design
```html
<!-- Mobile-first responsive classes -->
<div class="text-base md:text-lg lg:text-xl">
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
<div class="p-4 md:p-6 lg:p-8">
```

### Forbidden Styling Approaches

❌ **NEVER do this:**
```svelte
<style>
  .my-component {
    background-color: blue;
  }
</style>

<div style="background-color: blue;">

<div class="my-custom-class">
```

✅ **ALWAYS do this instead:**
```svelte
<div class="bg-blue-600 text-white p-4 rounded-lg">
```

### Tailwind Configuration

The project uses a standard Tailwind configuration with:
- Content paths: `./src/**/*.{html,js,svelte,ts}`
- Default theme with custom extensions available in `tailwind.config.js`
- PostCSS integration for processing

### Development Workflow

1. Use Tailwind utility classes for all styling
2. Refer to [Tailwind CSS documentation](https://tailwindcss.com/docs) for class references
3. Use responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
4. Use state variants: `hover:`, `focus:`, `active:`, `disabled:`
5. Combine utilities for complex designs instead of writing custom CSS