# Delta5 (d5)

Modern full-stack application with Node.js backend, Go microservices, and React frontend.

## 🚀 Quick Start

### New Developer Setup

```bash
# 1. Check and install build tools
make setup-build-tools

# 2. Install git hooks (REQUIRED)
make install-hooks

# 3. Start development environment
make dev
```

This will:
- Start MongoDB container
- Seed test users
- Build and start backend-v2
- Start frontend dev server

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3002/api/v2

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
make stop-all
```

### Database Separation:**
- **Development**: Uses MongoDB on port 27017, database `delta5-dev`, persistent storage
- **E2E Tests**: Uses MongoDB on port 27018, database `delta5`, isolated and reseeded per test run
- **CI E2E Tests**: Uses MongoDB on port 27017, database `delta5_${CI_JOB_ID}`, temporary per-job isolation
- Development and test databases are completely isolated to prevent data pollution

### Testing

```bash
# Backend E2E tests (281 tests, ~6s)
make e2e-backend

# Frontend E2E tests (54 tests, ~2min)
make e2e-frontend

# Full CI pipeline
make ci-full
```

### Git Workflow

**Pre-commit hook (~2min):**
- Lint + Build validation
- Runs automatically on every commit

**Pre-push hook (~5min):**
- All pre-commit checks
- Backend E2E tests (281 tests)
- Frontend E2E tests (54 tests)
- Runs automatically before push

**Bypass if needed:**
```bash
git commit --no-verify  # Skip pre-commit
git push --no-verify    # Skip pre-push
```

## 📦 Project Structure

```
.
├── backend/           # Node.js backend (legacy)
│   ├── src/          # Source code
│   └── e2e/          # E2E tests (281 tests)
│
├── backend-v2/        # Go backend (active)
│   ├── internal/     # Internal packages
│   └── logs/         # Runtime logs
│
├── frontend/          # React + Vite frontend
│   ├── src/          # Source code
│   └── e2e/          # Playwright E2E tests (54 tests)
│
├── .git-hooks/        # Git hooks (pre-commit + pre-push)
├── docker-compose.yml # MongoDB + services
└── Makefile          # Build + test automation
```

## 🧪 Testing Strategy

### Backend E2E (281 tests, 100% passrate)
- **Framework:** Jest + Supertest
- **Target:** backend-v2 (Go) on port 3002
- **Duration:** ~6 seconds
- **Run:** `make e2e-backend`

### Frontend E2E (54 tests, 70% passrate)
- **Framework:** Playwright
- **Target:** Full stack (frontend + backend-v2)
- **Duration:** ~2 minutes
- **Run:** `make e2e-frontend`

### Quality Gates
1. **Pre-commit:** Lint + Build (~2min)
2. **Pre-push:** All + E2E tests (~5min)
3. **CI Pipeline:** All + Security scans

## 🔧 Common Commands

```bash
make help              # Show all available targets
make install-hooks     # Install git hooks

# Development
make dev               # Full stack (MongoDB-dev + backend-v2 + frontend)
make dev-frontend      # Frontend only
make dev-backend-v2    # Backend-v2 only
make start-mongodb-dev # Development MongoDB (port 27017)
make start-mongodb-e2e # E2E MongoDB (port 27018)
make stop-all          # Stop all services

# Testing
make ci-local          # Fast checks (lint + build)
make ci-full           # Full CI pipeline
make e2e-backend       # Backend E2E tests
make e2e-frontend      # Frontend E2E tests

# Utilities
make seed-dev          # Seed dev MongoDB (27017) with initial users
make seed-e2e          # Seed E2E MongoDB (27018) with test users  
make reset-dev-db      # Reset dev database to clean state
make fix-permissions   # Fix data directory ownership (no sudo)
make cleanup-old-data  # Remove legacy mongodb directory
make clean-e2e         # Clean test artifacts
```

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
docker-compose restart mongodb
make seed-e2e
```

### E2E Tests Failing
```bash
make clean-e2e
make stop-all
make dev-backend-v2
make e2e-backend
```

See [DEVELOPMENT-SETUP.md](./DEVELOPMENT-SETUP.md#troubleshooting) for more troubleshooting steps.

## 📝 Contributing

1. Install git hooks: `make install-hooks`
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes with passing tests
4. Commit (pre-commit hook validates)
5. Push (pre-push hook runs E2E tests)
6. Create pull request

## 🔒 Security

- JWT authentication with configurable secrets
- RBAC (Role-Based Access Control)
- MongoDB authentication

## 🗺️ API Routing Reference

Frontend connects to single API: `/api/v2/*`

### Go Backend (Direct Handlers)

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

**Adding new AI/scraping feature:**
1. Check `backend-v2/internal/gateway/routes.go` for proxy patterns
2. Implement in `backend/src/` (Node.js)
3. Add proxy route to `gateway/routes.go`
- CORS configuration
- Input validation & sanitization

## 📄 License

[Add license information]

## 👥 Team

[Add team information]

---

**Last Updated:** November 23, 2025  
**E2E Test Status:** Backend 281/281 ✅ | Frontend 38/54 ⚠️
