# Developer Guide - Ex-Accell UI

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Development Workflows](#development-workflows)
- [Styling with Tailwind CSS](#styling-with-tailwind-css)
- [Dapr Integration](#dapr-integration)
- [API Integration](#api-integration)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Ex-Accell UI is a modern frontend application built with SvelteKit and enhanced with Dapr for microservices capabilities. This guide provides comprehensive information for developers working on this project.

### Tech Stack
- **Frontend**: SvelteKit 2.x + Svelte 5.x
- **Language**: TypeScript 5.x
- **CSS Framework**: Tailwind CSS 3.x
- **Build Tool**: Vite 7.x
- **Runtime**: Dapr-enabled
- **Containerization**: Docker
- **Package Manager**: npm

## Prerequisites

### Required Software
```bash
# Node.js (version 18+)
node --version  # Should be 18+

# npm (comes with Node.js)
npm --version

# Dapr CLI
dapr --version

# Docker (for Redis and containerization)
docker --version

# Git
git --version
```

### Installation Steps
```bash
# 1. Install Node.js (if not installed)
# Visit https://nodejs.org/ or use a version manager like nvm

# 2. Install Dapr CLI
curl -fsSL https://raw.githubusercontent.com/dapr/cli/master/install/install.sh | /bin/bash

# 3. Initialize Dapr
dapr init

# 4. Start Redis (required for Dapr components)
docker run -d --name redis-dapr -p 6379:6379 redis:alpine
```

## Quick Start

### Standard Development
```bash
# Clone and setup
git clone <repository-url>
cd ex-accell-ui

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Dapr-Enabled Development
```bash
# Ensure Redis is running
docker start redis-dapr

# Start with Dapr sidecar
npm run dev:dapr

# Application available at http://localhost:5173
# Dapr sidecar API at http://localhost:3500
```

## Architecture Deep Dive

### Project Structure
```
ex-accell-ui/
├── src/
│   ├── routes/          # SvelteKit pages and layouts
│   ├── lib/             # Shared components and utilities
│   ├── app.html         # Main HTML template
│   └── app.d.ts         # Global type definitions
├── static/              # Static assets
├── components/          # Dapr component configurations
│   ├── statestore.yaml  # Redis state store
│   ├── pubsub.yaml      # Redis pub/sub
│   └── secretstore.yaml # File-based secrets
├── dapr.yaml           # Dapr application configuration
├── secrets.json        # Local secrets (not in production)
├── Dockerfile          # Container configuration
└── package.json        # Dependencies and scripts
```

### SvelteKit Conventions
- **Routes**: File-based routing in `src/routes/`
- **Components**: Reusable components in `src/lib/`
- **Layouts**: Shared layouts using `+layout.svelte`
- **Load Functions**: Data loading with `+page.ts` or `+page.server.ts`
- **Actions**: Form handling with `+page.server.ts` actions

### Dapr Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SvelteKit     │    │   Dapr Sidecar  │    │   Redis         │
│   (Port 5173)   │◄──►│   (Port 3500)   │◄──►│   (Port 6379)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │
        │                        ▼
        │              ┌─────────────────┐
        └─────────────►│   External APIs │
                       └─────────────────┘
```

## Development Workflows

### Creating a New Page
```bash
# Create a new route
touch src/routes/dashboard/+page.svelte
touch src/routes/dashboard/+page.ts  # For data loading
```

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;
</script>

<h1>Dashboard</h1>
<p>Welcome, {data.user.name}!</p>
```

```typescript
// src/routes/dashboard/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  // Load data here
  return {
    user: { name: 'Developer' }
  };
};
```

### Creating Reusable Components
```svelte
<!-- src/lib/components/Button.svelte -->
<script lang="ts">
  export let variant: 'primary' | 'secondary' = 'primary';
  export let disabled = false;
  
  $: buttonClasses = variant === 'primary' 
    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
    : 'bg-gray-200 hover:bg-gray-300 text-gray-900';
</script>

<button 
  class="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed {buttonClasses}"
  {disabled}
  on:click
>
  <slot />
</button>
```

### State Management
```typescript
// src/lib/stores/app.ts
import { writable } from 'svelte/store';

export const user = writable({ name: '', email: '' });
export const loading = writable(false);
```

## Styling with Tailwind CSS

**CRITICAL: This project uses Tailwind CSS exclusively. All styling must be done using Tailwind utility classes.**

### Setup and Configuration

Tailwind CSS is integrated with SvelteKit through PostCSS:

- **Configuration**: `tailwind.config.js`
- **PostCSS**: `postcss.config.js`
- **Styles**: `src/app.css` (contains Tailwind directives)
- **Content**: Scans `./src/**/*.{html,js,svelte,ts}` for classes

### Core Styling Principles

#### 1. Utility-First Approach
Always use Tailwind utility classes instead of custom CSS:

```svelte
<!-- ✅ CORRECT: Use Tailwind utilities -->
<div class="bg-blue-600 text-white p-4 rounded-lg shadow-md">
  <h2 class="text-xl font-bold mb-2">Card Title</h2>
  <p class="text-blue-100">Card content goes here</p>
</div>

<!-- ❌ NEVER: Don't use custom styles -->
<div class="custom-card">
  <h2 class="custom-title">Card Title</h2>
  <p>Card content goes here</p>
</div>

<style>
  .custom-card { /* Don't do this */ }
</style>
```

#### 2. Responsive Design
Use Tailwind's responsive prefixes for mobile-first design:

```svelte
<!-- Mobile-first responsive design -->
<div class="
  w-full 
  sm:w-1/2 
  md:w-1/3 
  lg:w-1/4 
  xl:w-1/5
  p-2 
  sm:p-4 
  md:p-6
">
  <h3 class="text-lg sm:text-xl md:text-2xl font-semibold">
    Responsive Heading
  </h3>
</div>

<!-- Grid layouts -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  <!-- Grid items -->
</div>
```

#### 3. Component Patterns

##### Buttons
```svelte
<!-- Primary button -->
<button class="
  bg-blue-600 hover:bg-blue-700 
  text-white font-medium 
  px-4 py-2 rounded-lg 
  transition-colors duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Primary Action
</button>

<!-- Secondary button -->
<button class="
  bg-white hover:bg-gray-50 
  text-gray-900 border border-gray-300 
  px-4 py-2 rounded-lg 
  transition-colors duration-200
">
  Secondary Action
</button>
```

##### Cards
```svelte
<!-- Card component -->
<div class="bg-white rounded-xl shadow-lg overflow-hidden">
  <div class="p-6">
    <h3 class="text-xl font-semibold text-gray-900 mb-2">Card Title</h3>
    <p class="text-gray-600 mb-4">Card description text</p>
    <div class="flex space-x-2">
      <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
        Action
      </button>
    </div>
  </div>
</div>
```

##### Forms
```svelte
<!-- Form inputs -->
<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      Email Address
    </label>
    <input 
      type="email"
      class="
        w-full px-3 py-2 
        border border-gray-300 rounded-md 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        disabled:bg-gray-100 disabled:cursor-not-allowed
      "
      placeholder="Enter your email"
    />
  </div>
  
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">
      Message
    </label>
    <textarea 
      class="
        w-full px-3 py-2 
        border border-gray-300 rounded-md 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        resize-vertical
      "
      rows="4"
      placeholder="Enter your message"
    ></textarea>
  </div>
</div>
```

### Layout Patterns

#### Flex Layouts
```svelte
<!-- Header with navigation -->
<header class="bg-white border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center space-x-4">
        <h1 class="text-xl font-bold text-gray-900">Ex-Accell UI</h1>
      </div>
      <nav class="hidden md:flex space-x-6">
        <a href="/" class="text-gray-600 hover:text-gray-900">Home</a>
        <a href="/dashboard" class="text-gray-600 hover:text-gray-900">Dashboard</a>
      </nav>
    </div>
  </div>
</header>

<!-- Content area -->
<main class="flex-1 overflow-y-auto">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Page content -->
  </div>
</main>
```

#### Grid Layouts
```svelte
<!-- Dashboard grid -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <!-- Sidebar -->
  <div class="lg:col-span-3">
    <div class="bg-white rounded-lg shadow p-6">
      <!-- Sidebar content -->
    </div>
  </div>
  
  <!-- Main content -->
  <div class="lg:col-span-9">
    <div class="space-y-6">
      <!-- Main content blocks -->
    </div>
  </div>
</div>
```

### Advanced Patterns

#### Dynamic Classes with Svelte
```svelte
<script lang="ts">
  export let status: 'success' | 'warning' | 'error' = 'success';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  
  $: statusClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200'
  }[status];
  
  $: sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }[size];
</script>

<div class="border rounded-lg {statusClasses} {sizeClasses}">
  <slot />
</div>
```

#### Conditional Styling
```svelte
<script lang="ts">
  export let isActive = false;
  export let isDisabled = false;
</script>

<button 
  class="
    px-4 py-2 rounded-lg font-medium transition-all duration-200
    {isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}
    {isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
  "
  disabled={isDisabled}
>
  <slot />
</button>
```

### Color Scheme

Use consistent colors throughout the application:

- **Primary**: `blue-600` (default), `blue-700` (hover)
- **Secondary**: `gray-200` (background), `gray-700` (text)
- **Success**: `green-600`, `green-100` (background)
- **Warning**: `yellow-600`, `yellow-100` (background)
- **Error**: `red-600`, `red-100` (background)
- **Text**: `gray-900` (primary), `gray-600` (secondary), `gray-500` (muted)

### Animation and Transitions

Use Tailwind's transition utilities for smooth interactions:

```svelte
<!-- Hover effects -->
<button class="
  bg-blue-600 hover:bg-blue-700 
  transform hover:scale-105 
  transition-all duration-200 ease-in-out
">
  Animated Button
</button>

<!-- Loading states -->
<div class="animate-pulse bg-gray-200 h-4 rounded mb-2"></div>
<div class="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
```

### Development Best Practices

1. **Use class ordering**: Group classes logically (layout, spacing, colors, typography)
2. **Extract repeated patterns**: Create reusable components for common UI patterns
3. **Responsive design**: Always consider mobile-first design
4. **Accessibility**: Use proper contrast ratios and focus states
5. **Performance**: Tailwind purges unused classes automatically

### Debugging Tailwind

- Use browser dev tools to inspect applied classes
- Check `tailwind.config.js` for custom configurations
- Verify `src/app.css` includes Tailwind directives
- Ensure content paths in config include all component files

## Dapr Integration

### State Management
```typescript
// Save state
const saveUserState = async (userData: any) => {
  const response = await fetch('http://localhost:3500/v1.0/state/statestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      key: 'user-profile',
      value: userData
    }])
  });
};

// Retrieve state
const getUserState = async () => {
  const response = await fetch('http://localhost:3500/v1.0/state/statestore/user-profile');
  return response.json();
};
```

### Pub/Sub Messaging
```typescript
// Publish message
const publishEvent = async (topic: string, data: any) => {
  await fetch(`http://localhost:3500/v1.0/publish/pubsub/${topic}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

// Subscribe to messages (in a server route)
// src/routes/api/webhook/+server.ts
export async function POST({ request }) {
  const data = await request.json();
  console.log('Received message:', data);
  return new Response('OK');
}
```

### Secrets Management
```typescript
// Retrieve secrets
const getSecret = async (key: string) => {
  const response = await fetch(`http://localhost:3500/v1.0/secrets/secretstore/${key}`);
  return response.json();
};

// Usage
const apiKey = await getSecret('api/key');
```

## API Integration

### ETL Pipeline Integration
```typescript
// src/lib/api/etl.ts
const ETL_BASE_URL = 'http://localhost:8000'; // ETL service

export const getProcessedData = async () => {
  const response = await fetch(`${ETL_BASE_URL}/api/processed-data`);
  return response.json();
};

export const triggerProcessing = async (dataSource: string) => {
  const response = await fetch(`${ETL_BASE_URL}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: dataSource })
  });
  return response.json();
};
```

### Superset Integration
```typescript
// src/lib/api/analytics.ts
const SUPERSET_BASE_URL = 'http://localhost:8088'; // Superset service

export const getChartData = async (chartId: number) => {
  const response = await fetch(`${SUPERSET_BASE_URL}/api/v1/chart/${chartId}/data`);
  return response.json();
};
```

## Testing Strategy

### Unit Testing Setup
```bash
# Install testing dependencies
npm install -D @testing-library/svelte @testing-library/jest-dom jest @types/jest
```

```javascript
// jest.config.js
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.svelte$': ['svelte-jester', { preprocess: true }]
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts']
};
```

### Component Testing
```typescript
// src/lib/components/Button.test.ts
import { render, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

test('button renders with correct text', () => {
  const { getByText } = render(Button, { props: { text: 'Click me' } });
  expect(getByText('Click me')).toBeInTheDocument();
});

test('button handles click events', async () => {
  let clicked = false;
  const { getByRole } = render(Button, {
    props: { text: 'Click me' }
  });
  
  const button = getByRole('button');
  button.addEventListener('click', () => { clicked = true; });
  
  await fireEvent.click(button);
  expect(clicked).toBe(true);
});
```

### Integration Testing
```typescript
// src/routes/dashboard/+page.test.ts
import { render, waitFor } from '@testing-library/svelte';
import Dashboard from './+page.svelte';

test('dashboard loads user data', async () => {
  const mockData = { user: { name: 'Test User' } };
  const { getByText } = render(Dashboard, { props: { data: mockData } });
  
  await waitFor(() => {
    expect(getByText('Welcome, Test User!')).toBeInTheDocument();
  });
});
```

## Deployment

### Development Deployment
```bash
# With Dapr
npm run dev:dapr

# Without Dapr
npm run dev
```

### Production Build
```bash
# Build the application
npm run build

# Preview production build
npm run preview

# With Dapr
npm run preview:dapr
```

### Docker Deployment
```bash
# Build Docker image
docker build -t ex-accell-ui .

# Run container
docker run -p 3000:3000 ex-accell-ui

# With docker-compose (recommended)
# Create docker-compose.yml with Redis and app services
```

### Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ex-accell-ui
  annotations:
    dapr.io/enabled: "true"
    dapr.io/app-id: "ex-accell-ui"
    dapr.io/app-port: "3000"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ex-accell-ui
  template:
    metadata:
      labels:
        app: ex-accell-ui
    spec:
      containers:
      - name: ex-accell-ui
        image: ex-accell-ui:latest
        ports:
        - containerPort: 3000
```

## Troubleshooting

### Common Issues

#### Dapr Sidecar Not Starting
```bash
# Check Dapr installation
dapr --version

# Reinitialize Dapr
dapr uninstall
dapr init

# Check Redis connection
docker ps | grep redis
```

#### Port Conflicts
```bash
# Check what's using port 5173
lsof -i :5173

# Use different port
npm run dev -- --port 5174
```

#### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run check
```

#### Redis Connection Issues
```bash
# Start Redis container
docker run -d --name redis-dapr -p 6379:6379 redis:alpine

# Test Redis connection
docker exec -it redis-dapr redis-cli ping
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm run dev:dapr

# Check Dapr logs
dapr logs --app-id ex-accell-ui
```

### Performance Monitoring
```bash
# Build analysis
npm run build -- --analyze

# Bundle size check
npx bundlesize
```

## Best Practices

### Code Organization
- Keep components small and focused
- Use TypeScript for better type safety
- Implement proper error handling
- Follow SvelteKit conventions

### State Management
- Use Svelte stores for client-side state
- Leverage Dapr state store for persistence
- Implement proper data validation

### Security
- Never commit secrets to version control
- Use Dapr secrets management
- Validate all user inputs
- Implement proper authentication

### Performance
- Use SvelteKit's preloading features
- Implement proper caching strategies
- Optimize bundle size
- Use lazy loading for large components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style
- Use Prettier for formatting
- Follow TypeScript best practices
- Write meaningful commit messages
- Add JSDoc comments for public APIs

---

For more information, see:
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Dapr Documentation](https://docs.dapr.io/)
- [Project README](./README.md)