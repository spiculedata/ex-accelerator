# Ex-Accelerator

A social media analytics platform for collecting, analyzing, and visualizing data from multiple social media platforms.

## Overview

Ex-Accelerator is a full-stack analytics platform that helps researchers and analysts:

- **Collect data** from social media platforms (Telegram, YouTube)
- **Analyze content** with sentiment analysis, topic modeling, and language detection
- **Visualize insights** through interactive dashboards
- **Organize research** with projects and workspaces

## Repository Structure

```
ex-accelerator/
├── ex-accell-ui/    # Main web application (SvelteKit + Dapr)
└── etl/             # ETL pipeline for data processing
```

## Getting Started

### Main Application (ex-accell-ui)

The primary application is in the `ex-accell-ui/` directory:

```bash
cd ex-accell-ui
npm install
npm run dapr:setup
npm run dev:dapr
```

See [ex-accell-ui/README.md](./ex-accell-ui/README.md) for detailed setup instructions.

### Prerequisites

- Node.js 18+
- Go 1.21+ (for Telegram scraper)
- Docker (for Redis)
- Dapr CLI

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | SvelteKit 2.x, Svelte 5, TypeScript, Tailwind CSS |
| Analytics Database | DuckDB |
| Service Mesh | Dapr |
| State Store | Redis |
| Crawlers | Go (Telegram/YouTube scraper) |
| Visualization | ECharts, Leaflet |

## Features

### Analytics Modules

- **Sentiment Analysis** - NLP-powered sentiment and emotion detection
- **Topic Modeling** - Theme and trend discovery
- **Language Detection** - Multi-language analysis
- **Engagement Analysis** - Performance metrics
- **GDELT Events** - Global event analysis
- **Android Analytics** - Mobile interaction analysis

### Data Collection

- Automated web crawlers for Telegram and YouTube
- Job scheduling via web interface
- Real-time progress monitoring

### Research Organization

- Projects for grouping research initiatives
- Workspaces for dataset isolation
- Cross-platform comparative analysis

## Documentation

- [ex-accell-ui/README.md](./ex-accell-ui/README.md) - Main application documentation
- [ex-accell-ui/CLAUDE.md](./ex-accell-ui/CLAUDE.md) - Development guidelines

## License

This project is part of the Ex-Accelerator platform.
