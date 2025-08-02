# Ex-Accell UI

A modern, Dapr-enabled frontend application built with SvelteKit for the Ex-Accelerator platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker (for Redis)
- Dapr CLI

### Get Started in 3 Steps

```bash
# 1. Install dependencies
npm install

# 2. Start Redis (required for Dapr)
docker run -d --name redis-dapr -p 6379:6379 redis:alpine

# 3. Run with Dapr
npm run dev:dapr
```

Visit [http://localhost:5173](http://localhost:5173) to see your app! 🎉

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
npm run dev          # Standard development server
npm run dev:dapr     # Development with Dapr sidecar (recommended)
```

### Building & Testing
```bash
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Type checking
```

### Dapr Operations
```bash
npm run dapr:init    # Initialize Dapr
npm run dapr:stop    # Stop Dapr application
```

## 🏗 What's Inside

This is a **SvelteKit 2.x** application enhanced with **Dapr** for microservices capabilities:

- ⚡ **SvelteKit 2.x** - Modern web framework
- 🔷 **TypeScript** - Type safety
- 🚀 **Vite** - Lightning fast builds  
- 🔧 **Dapr** - Microservices runtime
- 🐳 **Docker** - Containerization ready

## 🌟 Key Features

### Unified DuckDB Analytics
- **Cross-Table Analysis** - Single database for all analytics modules
- **Multi-Platform Insights** - Compare sentiment, topics, and engagement across platforms
- **Advanced Correlations** - Language-sentiment relationships and topic performance analysis
- **Real-Time Dashboards** - Comprehensive analytics from unified data source

### Dapr Integration
- **State Management** - Redis-backed persistent state
- **Pub/Sub Messaging** - Event-driven communication
- **Secrets Management** - Secure configuration
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

## 📚 Documentation

- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Comprehensive development documentation
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant context and commands

## 🌐 System Integration

This UI is part of the larger Ex-Accelerator ecosystem:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Ex-Accell │    │     ETL     │    │  Superset   │
│      UI     │◄──►│   Pipeline  │◄──►│ Analytics   │
│  (This App) │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
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
dapr --version  # Check Dapr installation
dapr list       # See running Dapr apps
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
