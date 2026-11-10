# Social Explorer (Ex-Accell UI)

A powerful social media analytics platform for collecting, analyzing, and visualizing data from multiple platforms. Built with SvelteKit, Dapr, and DuckDB for high-performance unified analytics.

## What is Social Explorer?

Social Explorer helps researchers and analysts:

- **Collect data** from social media platforms (Telegram, YouTube) via automated crawlers
- **Analyze text** with sentiment analysis, topic modeling, language detection, and engagement metrics
- **Visualize insights** through interactive dashboards with cross-platform comparisons
- **Organize work** with projects and workspaces to manage multiple research initiatives

## Key Features

### Analytics Modules

| Module | Description |
|--------|-------------|
| **Dashboards** | Real-time analytics and custom visualizations |
| **Sentiment Analysis** | NLP-powered sentiment and emotion detection |
| **Topic Modeling** | Discover themes and trends across your data |
| **Language Detection** | Multi-language text analysis and patterns |
| **Engagement Analysis** | Performance metrics and content effectiveness |
| **GDELT Events** | Global event data analysis |
| **Android Analytics** | Mobile device interaction analysis |

### Data Collection

- **Web Crawlers** - Schedule automated data collection from Telegram and YouTube
- **Job Scheduling** - Create one-time or recurring crawl jobs via web interface
- **Real-time Monitoring** - Track job progress and execution logs

### Research Organization

- **Projects** - Group related research initiatives together
- **Workspaces** - Organize datasets within projects with isolated analytics
- **Cross-platform Analysis** - Compare insights across different social media platforms

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Go | 1.21+ | Telegram scraper service |
| Docker | Latest | Redis container |
| Dapr CLI | Latest | Service orchestration |

### First-Time Setup

1. **Install Dapr CLI** (if not already installed):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/dapr/cli/master/install/install.sh | /bin/bash
   dapr init
   ```

2. **Install dependencies and configure services**:
   ```bash
   npm install
   npm run dapr:setup
   ```

3. **Start the application**:
   ```bash
   npm run dev:dapr
   ```

4. **Open your browser** at [http://localhost:5173](http://localhost:5173)

### Development Modes

```bash
# Full deployment with Dapr (recommended for most development)
npm run dev:dapr

# Standard development server (no Dapr services)
npm run dev

# Development with Jupyter Lab integration
npm run dev:jupyter
```

## Project Structure

```
ex-accell-ui/
├── src/
│   ├── routes/              # SvelteKit pages and API endpoints
│   │   ├── api/             # REST API endpoints
│   │   ├── dashboards/      # Dashboard pages
│   │   ├── projects/        # Project management
│   │   ├── text-analytics/  # Analytics modules
│   │   └── workspaces/      # Workspace management
│   └── lib/
│       ├── components/      # Reusable UI components
│       ├── services/        # Database and API services
│       └── stores/          # Svelte stores for state management
├── components/              # Dapr component configurations
├── notebooks/               # Jupyter notebook templates
├── cypress/                 # E2E and component tests
└── sql/                     # Database schemas
```

## Architecture

### System Overview

```
                           ┌────────────────────────────────────┐
                           │         Social Explorer UI         │
                           │         (SvelteKit + Dapr)         │
                           └───────────────┬────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
    │   Analytics     │         │  Data Capture   │         │   Job Queue     │
    │   (DuckDB)      │         │  (Crawlers)     │         │   (Dapr Jobs)   │
    └─────────────────┘         └─────────────────┘         └─────────────────┘
              │                            │                            │
              │                            ▼                            │
              │                 ┌─────────────────┐                     │
              └────────────────►│ Telegram Scraper│◄────────────────────┘
                                │   (Go Service)  │
                                └─────────────────┘
```

### Technology Stack

- **Frontend**: SvelteKit 2.x, Svelte 5, TypeScript, Tailwind CSS
- **Backend**: Node.js, DuckDB, PostgreSQL
- **Services**: Dapr (state, pub/sub, jobs), Redis
- **Crawlers**: Go-based Telegram/YouTube scraper
- **Analytics**: ECharts, Leaflet (maps)

### Database Architecture

Social Explorer uses a **unified DuckDB database** for high-performance analytics:

- **Single source of truth**: `unified_social_analytics.db`
- **Cross-module analysis**: Query across sentiment, topics, language, and engagement
- **Pre-built views**: Optimized for common analytical queries
- **Schema**: See `sql/unified_social_analytics_schema.sql`

## Available Commands

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run dev:dapr` | Start with Dapr services (recommended) |
| `npm run dev:jupyter` | Start with Jupyter Lab |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

### Dapr Services

| Command | Description |
|---------|-------------|
| `npm run dapr:init` | Initialize Dapr (first-time only) |
| `npm run dapr:setup` | Setup dependencies (Redis, scraper) |
| `npm run dapr:stop` | Stop all Dapr services |
| `npm run dapr:logs` | View service logs |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests |
| `npm run test:e2e` | Run E2E tests only |
| `npm run test:component` | Run component tests only |
| `npm run cypress:open` | Open Cypress UI |
| `npm run check` | TypeScript type checking |

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Dapr Components

Located in `components/` directory:

| Component | File | Purpose |
|-----------|------|---------|
| State Store | `statestore.yaml` | Redis-backed state |
| Pub/Sub | `pubsub.yaml` | Event messaging |
| Secrets | `secretstore.yaml` | Secure configuration |
| Job Store | `jobstore.yaml` | Job scheduling |

## API Endpoints

### Projects & Workspaces

- `GET/POST /api/projects` - Manage projects
- `GET/POST /api/workspaces` - Manage workspaces

### Analytics

- `GET /api/sentiment-analysis` - Sentiment data
- `GET /api/topic-modeling` - Topic analysis
- `GET /api/language-detection` - Language stats
- `GET /api/engagement-analysis` - Engagement metrics

### Jobs

- `POST /api/jobs` - Schedule crawler job
- `GET /api/jobs` - List scheduled jobs
- `DELETE /api/jobs?name={name}` - Delete job

## Troubleshooting

### Port already in use

```bash
lsof -i :5173
npm run dev -- --port 5174
```

### Redis not running

```bash
docker ps | grep redis
docker start redis-dapr
```

### Dapr issues

```bash
dapr --version
dapr list
npm run dapr:logs
```

### Database connection issues

```bash
# Check if DuckDB database exists
ls -la unified_social_analytics.db

# Reinitialize database
npm run build  # Database initializes on build
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - AI assistant context and development guidelines
- **[ARCHITECTURE_SUMMARY.txt](./ARCHITECTURE_SUMMARY.txt)** - Detailed architecture overview
- **[docs/](./docs/)** - Additional documentation

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the code style in `CLAUDE.md`
4. Write tests for new functionality
5. Run `npm run check && npm run test` to verify
6. Commit: `git commit -m 'Add your feature'`
7. Push: `git push origin feature/your-feature`
8. Open a Pull Request

## License

This project is part of the Social Explorer platform.

---

Built with SvelteKit, Dapr, and DuckDB
