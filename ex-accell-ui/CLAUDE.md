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