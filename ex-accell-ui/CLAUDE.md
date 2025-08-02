# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Dapr Commands
```bash
# Initialize Dapr (first time setup)
npm run dapr:init

# Stop Dapr application
npm run dapr:stop

# Start with Dapr sidecar (development)
npm run dev:dapr

# Preview with Dapr sidecar
npm run preview:dapr
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

This project is configured to run with Dapr for microservices capabilities:

### Dapr Components
- **State Store**: Redis-based state management (`components/statestore.yaml`)  
- **Pub/Sub**: Redis-based messaging (`components/pubsub.yaml`)
- **Secret Store**: File-based secrets management (`components/secretstore.yaml`)

### Dapr Configuration
- **App ID**: `ex-accell-ui`
- **HTTP Port**: 3500 (Dapr sidecar)
- **gRPC Port**: 50001 (Dapr sidecar)
- **App Port**: 5173 (dev) / 4173 (preview) / 3000 (production)

### Prerequisites for Dapr
```bash
# Install Dapr CLI (if not already installed)
wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash

# Initialize Dapr
dapr init

# Start Redis (required for state store and pub/sub)
docker run -d --name redis-dapr -p 6379:6379 redis:alpine
```

### Dapr API Access
When running with Dapr, the following APIs are available:
- State API: `http://localhost:3500/v1.0/state/statestore`
- Pub/Sub API: `http://localhost:3500/v1.0/publish/pubsub/<topic>`
- Secrets API: `http://localhost:3500/v1.0/secrets/secretstore/<key>`

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