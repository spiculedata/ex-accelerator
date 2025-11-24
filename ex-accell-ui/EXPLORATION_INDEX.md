# EX-ACCELERATOR UI - CODEBASE EXPLORATION INDEX

This directory contains comprehensive documentation of the ex-accelerator UI codebase, generated through systematic exploration and analysis.

## Documentation Files

### 1. CODEBASE_ANALYSIS.md (Main Reference)
**1,089 lines | Comprehensive documentation**

Complete technical reference covering:
- Project structure mapping (src/, routes/, services/)
- 24 service files with line counts and purposes
- 32 API endpoints organized by category
- Database architecture (DuckDB unified schema)
- 13 SQL schema files overview
- Dapr integration details
- 18 Cypress test files
- Component architecture
- Configuration files summary
- 21 page routes
- Jupyter Lab integration
- Technology specifications
- Dependency analysis
- Data flow patterns

**Use when**: You need detailed technical reference, specific file locations, or understanding complete architecture.

### 2. ARCHITECTURE_SUMMARY.txt (Visual Overview)
**ASCII visualization | Quick architecture reference**

Includes:
- Layered architecture diagram (UI → Services → APIs → Database)
- Dapr multi-app deployment diagram
- Database schema overview
- Data flow patterns (4 main patterns)
- Service dependency map
- Testing coverage summary
- Configuration files list
- Critical dependencies
- Jupyter integration details
- Route structure (21 routes)
- Development commands
- Key metrics and statistics

**Use when**: You need quick visual understanding, architecture overview, or finding a specific command.

### 3. QUICK_REFERENCE.md (Developer Cheat Sheet)
**Markdown cheat sheet | Fast lookup guide**

Covers:
- Finding services by purpose
- Finding pages by feature
- API endpoints by category
- Database quick reference
- Common development tasks (code examples)
- Configuration commands
- Debugging tips
- File location cheat sheet
- Port numbers
- Common issues and solutions
- Key concepts
- Related repositories

**Use when**: You're actively developing and need quick code examples or command lookups.

## Quick Navigation

### By Task

**I want to...**

- **Query analytics data**
  - File: CODEBASE_ANALYSIS.md → Section 2 (Database Architecture)
  - Reference: QUICK_REFERENCE.md → Query Data example
  - Service: `src/lib/services/duckdb.ts`

- **Add a new analytics module**
  - File: QUICK_REFERENCE.md → Add New Analytics Module
  - Services: `src/lib/services/*AnalyticsDb.ts` pattern
  - Routes: `src/routes/api/*` and `src/routes/text-analytics/*`

- **Schedule a job**
  - File: ARCHITECTURE_SUMMARY.txt → Job Scheduling Flow
  - Service: `src/lib/services/jobSchedulerService.ts`
  - API: `/api/jobs` endpoint

- **Integrate Dapr**
  - File: CODEBASE_ANALYSIS.md → Section 6 (Dapr Integration)
  - Config: `dapr.yaml`
  - Service: `src/lib/services/daprClient.ts`

- **Add tests**
  - File: QUICK_REFERENCE.md → Test examples
  - Location: `cypress/` directory
  - Reference: CODEBASE_ANALYSIS.md → Section 9 (Test Suite)

- **Deploy with Docker**
  - File: ARCHITECTURE_SUMMARY.txt → Development Commands
  - Config: `dapr.yaml`, `Dockerfile`
  - Command: `npm run dev:dapr`

### By Component

**Database Services (3 files)**
- CODEBASE_ANALYSIS.md → Section 4 → DATABASE SERVICES
- Main file: `src/lib/services/duckdb.ts`

**Analytics Services (8 files)**
- CODEBASE_ANALYSIS.md → Section 4 → ANALYTICS SERVICES
- Examples: sentimentAnalysisDb.ts, topicModelingDb.ts, etc.

**Dapr Services (6 files)**
- CODEBASE_ANALYSIS.md → Section 4 → DAPR SERVICES
- Main: daprClient.ts, daprWorkflowExecutor.ts

**Job Scheduling Services (4 files)**
- CODEBASE_ANALYSIS.md → Section 4 → JOB SCHEDULING SERVICES
- Main: jobSchedulerService.ts, jobStateStore.ts

**API Endpoints (32 total)**
- CODEBASE_ANALYSIS.md → Section 3 (API Endpoint Inventory)
- QUICK_REFERENCE.md → API Endpoints by Category
- Location: `src/routes/api/`

**Routes (21 total)**
- CODEBASE_ANALYSIS.md → Section 8 (Page Routes Summary)
- ARCHITECTURE_SUMMARY.txt → Route Structure
- Location: `src/routes/`

### By Technology

**SvelteKit/Svelte**
- Main config: vite.config.ts, svelte.config.js
- Entry: src/app.html
- Pages: src/routes/
- Components: src/lib/components/

**TypeScript**
- Config: tsconfig.json
- Services: src/lib/services/
- Tests: cypress/

**Tailwind CSS**
- Config: tailwind.config.js
- Usage: All components and pages use Tailwind utility classes

**DuckDB**
- Database: unified_social_analytics.db
- Schemas: sql/schemas/
- Service: src/lib/services/duckdb.ts

**Dapr**
- Config: dapr.yaml
- Components: components/
- Services: src/lib/services/dapr*.ts

**Cypress**
- E2E tests: cypress/e2e/
- Component tests: cypress/component/
- Support: cypress/support/

**Jupyter**
- Notebooks: notebooks/
- Access: /text-analytics/research-investigation
- 8 available templates

## File Locations Quick Map

```
/src/
├── lib/services/              24 services (8,559 LOC)
├── lib/components/            Navigation.svelte
├── lib/stores/                projectStore.ts
├── routes/                    21 pages + 32 API endpoints
└── app.html

/sql/schemas/                  13 SQL schema files

/cypress/                      18 test files

/components/                   Dapr configuration

/notebooks/                    8 Jupyter templates

Configuration Files:
├── vite.config.ts
├── svelte.config.js
├── tsconfig.json
├── tailwind.config.js
├── dapr.yaml
├── package.json
├── pyproject.toml
└── cypress.config.ts
```

## Key Statistics

| Metric | Count |
|--------|-------|
| Service Files | 24 |
| Service Lines of Code | 8,559 |
| API Endpoints | 32 |
| Page Routes | 21 |
| Test Files | 18 |
| SQL Schemas | 13 |
| Dapr Services | 6 |
| Analytics Services | 8 |
| Job Services | 4 |
| Database Services | 3 |

## Ports Reference

| Service | Port | Protocol |
|---------|------|----------|
| SvelteKit Frontend | 5173 | HTTP |
| Dapr Sidecar (UI) | 3500 | HTTP/gRPC |
| Jupyter Lab | 8888 | HTTP |
| Dapr Sidecar (telegram-scraper) | 3502 | HTTP/gRPC |
| telegram-scraper | 6481 | gRPC |
| Redis | 6379 | RESP |

## Development Quick Start

```bash
# Standard development
npm run dev                    # http://localhost:5173

# With analytics research tools
npm run dev:jupyter           # + Jupyter Lab on 8888

# With full microservices
npm run dev:dapr              # + Dapr sidecars + Redis

# Type checking
npm run check

# Testing
npm run test                  # All tests
npm run cypress:open          # Interactive testing

# Production
npm run build
npm run preview
```

## Debugging Quick Reference

| Problem | Solution |
|---------|----------|
| Database not connected | Check `/api/health` and `/api/unified-analytics` |
| Job not scheduling | Verify `npm run dev:dapr` is running, check logs |
| Tests failing | Clear cache: `rm -rf .svelte-kit cypress/.cache` |
| Jupyter not accessible | Run `npm run jupyter:bootstrap` then `npm run dev:jupyter` |
| Type errors | Run `npm run check` to verify TypeScript |

## Related Documentation

- **Project Guidelines**: CLAUDE.md (in project root)
- **ETL Pipeline**: ../etl/ directory
- **Analytics Dashboards**: ../superset/ directory
- **Data Scraper**: ../telegram-scraper/ directory

## Search Tips

To find something quickly in CODEBASE_ANALYSIS.md:

- Service by name: Search for "Service Layer Architecture" then service name
- API by path: Search for "API ENDPOINT INVENTORY" then endpoint path
- Route by URL: Search for "PAGE ROUTES SUMMARY" then route path
- Database table: Search for "Core Database Tables" then table name
- Configuration: Search for "CONFIGURATION FILES"

## Document Update Frequency

These documents were generated during comprehensive codebase exploration on 2025-11-10.

**Last Updated**: 2025-11-10
**Exploration Scope**: Very thorough (all major directories and services)
**Document Location**: /Users/tombarber/Projects/ex-accelerator/ex-accell-ui/

---

**Start Here**: New to the codebase?
1. Read ARCHITECTURE_SUMMARY.txt for visual overview
2. Consult QUICK_REFERENCE.md for specific tasks
3. Reference CODEBASE_ANALYSIS.md for detailed information

**Actively Developing?**
1. Keep QUICK_REFERENCE.md open for commands and code examples
2. Use CODEBASE_ANALYSIS.md for API/service details
3. Refer to ARCHITECTURE_SUMMARY.txt for deployment decisions

