# Delta5 (d5)

Modern full-stack application with Node.js backend, Go microservices, and React frontend.

## 🚀 Quick Start

### New Developer Setup

```bash
# 1. Check and install build tools
make setup-build-tools

# 2. Install git hooks (REQUIRED)
make install-hooks

# 3. Initialize dev database (first time only)
make dev-db-init

# 4. Start development environment
make dev
```

This will:
- Start MongoDB container
- Build and start backend-v2
- Build and start Node.js backend
- Start frontend dev server

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3002/api/v2


## 📝 Contributing

1. Install git hooks: `make install-hooks`
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes with passing tests
4. Commit (pre-commit hook validates)
5. Push (pre-push hook runs E2E tests)
6. Create pull request

## 🛠️ Development

### Running Services

```bash
# Full stack development (MongoDB-dev + backend-v2 + frontend)
make dev

# Frontend only (backend-v2 must be running separately)
make dev-frontend

# Backend-v2 only (with dev MongoDB)
make dev-backend-v2

# Start development MongoDB only (port 27017)
make start-mongodb-dev

# Start E2E MongoDB only (port 27018)
make start-mongodb-e2e

# Stop all services
make stop
```

## 📋 Architecture

### Dual Backend

```
┌─────────────────────────────────────────────────┐
│ Frontend (React + Vite)                         │
│ Port: 5173 (dev)                                │
│ API: /api/v2/* (unified entry point)            │
└─────────────────────────────────────────────────┘
                      ↓ HTTP
┌─────────────────────────────────────────────────┐
│ Backend-v2 (Go)                                 │
│ Port: 3002                                      │
│ API: /api/v2                                    │
│                                                 │
│ Direct Handlers:                                │
│ • /auth, /user, /workflow, /template           │
│ • /macro, /sync, /statistics                   │
│                                                 │
│ Proxy to Node.js:                               │
│ • /execute (langchain)                          │
│ • /integration/scrape_* (cheerio, pdf-parse)   │
│ • /integration/*/completions (LLM SDKs)        │
└─────────────────────────────────────────────────┘
                      ↓ proxy
┌─────────────────────────────────────────────────┐
│ Backend (Node.js)                               │
│ Port: 3001                                      │
│ API: /api/v1                                    │
│                                                 │
│ Purpose: External API orchestration             │
│ • Workflow execution (langchain)                │
│ • Web scraping (cheerio)                        │
│ • LLM proxy (OpenAI, Claude, Yandex, etc.)     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ MongoDB - Development                           │
│ Port: 27017                                     │
│ Database: delta5-dev                            │
│ Persistent: ./data/mongodb-dev                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ MongoDB - E2E Tests                             │
│ Port: 27018                                     │
│ Database: delta5                                │
│ Persistent: ./data/mongodb-e2e                  │
│ Note: Isolated from dev, reseeded per test run  │
└─────────────────────────────────────────────────┘
```

### Database Separation:
- **Development**: Uses MongoDB on port 27017, database `delta5-dev`, persistent storage
- **E2E Tests**: Uses MongoDB on port 27018, database `delta5`, isolated and reseeded per test run
- **CI E2E Tests**: Uses MongoDB on port 27017, database `delta5_${CI_JOB_ID}`, temporary per-job isolation
- Development and test databases are completely isolated to prevent data pollution

## 📊 Database Configuration

### Local Environment

| Database | Port | Name | Purpose | URI |
|----------|------|------|---------|-----|
| Development | 27017 | `delta5-dev` | Persistent dev data | `mongodb://localhost:27017/delta5-dev` |
| E2E Tests | 27018 | `delta5` | Test isolation | `mongodb://localhost:27018/delta5` |

### CI Environment

| Database | Port | Name | Purpose | URI |
|----------|------|------|---------|-----|
| E2E Tests | 27017 | `delta5_${CI_JOB_ID}` | Per-job isolation | `mongodb://mongo:27017/delta5_${CI_JOB_ID}` |

**Configuration Variables:**
- `MONGO_URI`: Backend application runtime connection
- `E2E_MONGO_URI`: Test harness direct DB access (cleanup, assertions)

## 🐛 Troubleshooting

### Git Hooks Not Working
```bash
make install-hooks
```

### MongoDB Connection Failed
```bash
make stop
make start-mongodb-dev
make dev-db-init
```

### E2E Tests Failing
```bash
make clean-e2e
make stop
make start-mongodb-e2e
make e2e-db-init
make e2e-backend
```

### Go Backend

| Route | Handler | Purpose |
|-------|---------|---------|
| `/api/v2/auth/*` | Go | Authentication, signup, login |
| `/api/v2/user/*` | Go | User management |
| `/api/v2/workflow/*` | Go | Workflow CRUD |
| `/api/v2/template/*` | Go | Template CRUD |
| `/api/v2/macro/*` | Go | Macro CRUD |
| `/api/v2/sync/*` | Go | Data synchronization |
| `/api/v2/statistics/*` | Go | Analytics, waitlist |
| `/api/v2/llmvector/*` | Go | Vector storage |
| `/api/v2/urlthumbnail/*` | Go | URL thumbnail generation |

### Node.js Backend (Proxied via Go)

| Route | Actual Handler | Purpose | Reason |
|-------|---------------|---------|--------|
| `/api/v2/execute` | Node.js `/api/v1/execute` | Workflow execution | `langchain` dependency |
| `/api/v2/integration/scrape_*` | Node.js `/api/v1/integration/scrape_*` | Web scraping | `cheerio`, `pdf-parse` |
| `/api/v2/integration/chat/completions` | Node.js `/api/v1/integration/chat/completions` | OpenAI proxy | Node.js SDK mature |
| `/api/v2/integration/*/completions` | Node.js `/api/v1/integration/*/completions` | LLM proxies | Multiple LLM SDKs |
| `/api/v2/integration/*/embeddings` | Node.js `/api/v1/integration/*/embeddings` | Embedding proxies | LLM SDKs |

**Why proxy?**
- Go lacks mature ports of `langchain`, `cheerio`, `pdf-parse`
- Node.js has established ecosystem for AI/scraping operations
- Single API surface (`/api/v2`) simplifies frontend
- Proxy code self-documents which routes require Node.js

## 👥 Team

Boris Vasilenko - author, maintainer
