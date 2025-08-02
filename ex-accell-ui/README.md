# Ex-Accell UI

A modern, unified Dapr deployment combining SvelteKit frontend with telegram-scraper job scheduling for the Ex-Accelerator platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Go 1.21+ (for telegram-scraper)
- Docker (for Redis)
- Dapr CLI

### Get Started in 2 Steps

```bash
# 1. Install dependencies and setup deployment
npm install
npm run dapr:setup

# 2. Start unified deployment (UI + telegram-scraper)
npm run dev:dapr
```

Visit [http://localhost:5173](http://localhost:5173) to see your app! 🎉  
Access job scheduling at [http://localhost:5173/data-capture](http://localhost:5173/data-capture) 📋

## 📋 What You Need

### First Time Setup
```bash
# Install Dapr CLI (if not already installed)
curl -fsSL https://raw.githubusercontent.com/dapr/cli/master/install/install.sh | /bin/bash

# Initialize Dapr
dapr init
```

## 🛠 Available Commands

### Development
```bash
npm run dev             # Standard development server
npm run dev:dapr        # Unified deployment (UI + telegram-scraper)
```

### Deployment Management
```bash
npm run dapr:setup      # Setup dependencies (Redis, telegram-scraper)
npm run dapr:stop       # Stop all Dapr services
npm run dapr:logs       # View deployment logs
```

### Building & Testing
```bash
npm run build           # Build for production
npm run preview         # Preview production build
npm run check           # Type checking
npm run test:integration # Test job scheduling integration
```

## 🏗 What's Inside

This is a **unified Dapr deployment** combining multiple services:

- ⚡ **SvelteKit 2.x** - Modern web framework with TypeScript
- 🔧 **Dapr Multi-App** - Unified microservices deployment
- 📋 **Telegram Scraper** - Go-based job scheduling integration
- 🚀 **Job Scheduling** - Web-based crawler job management
- 🐳 **Docker** - Redis and containerization support

## 🌟 Key Features

### Unified DuckDB Analytics
- **Cross-Table Analysis** - Single database for all analytics modules
- **Multi-Platform Insights** - Compare sentiment, topics, and engagement across platforms
- **Advanced Correlations** - Language-sentiment relationships and topic performance analysis
- **Real-Time Dashboards** - Comprehensive analytics from unified data source

### Telegram Scraper Integration
- **Job Scheduling** - Web-based crawler job creation and management
- **Multi-App Deployment** - Single command starts UI and scraper services
- **Real-time Monitoring** - Live job execution logs and status
- **Platform Support** - Telegram and YouTube content crawling

### Dapr Integration
- **Unified Deployment** - Multi-app configuration in single dapr.yaml
- **State Management** - Redis-backed persistent state
- **Job Store** - Etcd-based job scheduling and execution
- **Service Discovery** - Microservices connectivity

### Modern Development
- **Hot Reload** - Instant feedback during development
- **TypeScript** - Enhanced developer experience
- **Component-Based** - Modular, reusable UI components
- **Server-Side Rendering** - Fast initial page loads

## 🔧 Configuration

### Database Architecture

The application uses a **unified DuckDB database** for all analytics:

- **Single Database**: `unified_social_analytics.db` - Contains all analytics modules
- **Cross-Platform Analysis**: Sentiment, topics, language detection, and engagement in one place
- **Advanced Views**: Pre-built analytical views for complex cross-table queries
- **Schema**: `unified_social_analytics_schema.sql` - Complete database structure

### Dapr Components

- **State Store**: Redis (`components/statestore.yaml`)
- **Pub/Sub**: Redis messaging (`components/pubsub.yaml`) 
- **Secrets**: File-based secrets (`components/secretstore.yaml`)
- **Job Store**: Etcd-based job scheduling (`components/jobstore.yaml`)
- **Telegram Scraper**: Service binding (`components/telegram-scraper-app.yaml`)

## 📚 Documentation

- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Comprehensive development documentation
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant context and commands

## 🌐 System Integration

This UI is part of the larger Ex-Accelerator ecosystem:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Ex-Accell │    │ Telegram    │    │     ETL     │
│      UI     │◄──►│  Scraper    │◄──►│   Pipeline  │
│  (Frontend) │    │ (Job Mode)  │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       │                                      │
       ▼                                      ▼
┌─────────────┐                      ┌─────────────┐
│  Job Queue  │                      │  Superset   │
│ (Dapr Jobs) │                      │ Analytics   │
└─────────────┘                      └─────────────┘
```

## 🚨 Troubleshooting

### Common Issues

**Port already in use?**
```bash
lsof -i :5173  # Check what's using the port
npm run dev -- --port 5174  # Use different port
```

**Redis connection failed?**
```bash
docker ps | grep redis  # Check if Redis is running
docker start redis-dapr  # Start Redis if stopped
```

**Dapr not working?**
```bash
dapr --version       # Check Dapr installation
dapr list            # See running Dapr apps
npm run dapr:logs    # View deployment logs
```

**Telegram scraper issues?**
```bash
npm run dapr:setup   # Re-run setup to check dependencies
ls -la /Users/tombarber/Projects/telegram-scraper/telegram-scraper  # Check binary exists
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Need Help?

- 📖 Check the [Developer Guide](./DEVELOPER_GUIDE.md) for detailed information
- 🐛 Found a bug? Open an issue
- 💡 Have a suggestion? We'd love to hear it!

## 📄 License

This project is part of the Ex-Accelerator platform.

---

**Happy coding!** 🎯
