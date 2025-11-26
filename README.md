# Delta5 (d5)

Modern full-stack application with Node.js backend, Go microservices, and React frontend.

## 🚀 Quick Start

### New Developer Setup

```bash
# 1. Install git hooks (REQUIRED)
make install-hooks

# 2. Start development environment
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

📖 **Full setup guide:** See [DEVELOPMENT-SETUP.md](./DEVELOPMENT-SETUP.md)

## 📋 Architecture

```
┌─────────────────────────────────────────────────┐
│ Frontend (React + Vite)                         │
│ Port: 5173 (dev)                                │
└─────────────────────────────────────────────────┘
                      ↓ HTTP
┌─────────────────────────────────────────────────┐
│ Backend-v2 (Go)                                 │
│ Port: 3002                                      │
│ API: /api/v2                                    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Backend (Node.js) - Legacy                      │
│ Port: 3000                                      │
│ API: /api/v1                                    │
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

**Database Separation:**
- **Development**: Uses MongoDB on port 27017, database `delta5-dev`, persistent storage
- **E2E Tests**: Uses MongoDB on port 27018, database `delta5`, isolated and reseeded per test run
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
make seed-dev          # Seed dev MongoDB (port 27017) with initial users
make seed-e2e          # Seed E2E MongoDB (port 27018) with test users
make reset-dev-db      # Reset dev database to clean state
make fix-permissions   # Fix data directory ownership (no sudo)
make cleanup-old-data  # Remove legacy mongodb directory
make clean-e2e         # Clean test artifacts
```

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
- CORS configuration
- Input validation & sanitization

## 📄 License

[Add license information]

## 👥 Team

[Add team information]

---

**Last Updated:** November 23, 2025  
**E2E Test Status:** Backend 281/281 ✅ | Frontend 38/54 ⚠️
