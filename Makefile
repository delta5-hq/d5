.PHONY: help dev dev-frontend dev-backend dev-backend-v2 start-mongodb-dev start-mongodb-e2e stop ci-local ci-full lint-backend lint-frontend build-backend build-backend-v2 build-frontend test-backend e2e-backend e2e-frontend seed-e2e seed-dev install-hooks test-hook clean-e2e clean-all reset-dev-db clean-dev-db fix-permissions cleanup-old-data

# Configuration variables (DRY principle)
JWT_SECRET := GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO
BACKEND_PORT := 3002
API_ROOT := /api/v2
MONGO_DEV_URI := mongodb://localhost:27017/delta5-dev
MONGO_E2E_URI := mongodb://localhost:27018/delta5
FRONTEND_PORT := 5173

help:
	@echo "Available targets:"
	@echo ""
	@echo "Development:"
	@echo "  make dev                 - Start full stack (MongoDB-dev + backend-v2 + frontend)"
	@echo "  make dev-frontend        - Start frontend dev server only"
	@echo "  make dev-backend-v2      - Start backend-v2 in dev mode"
	@echo "  make start-mongodb-dev   - Start development MongoDB (port 27017, persistent)"
	@echo "  make start-mongodb-e2e   - Start E2E MongoDB (port 27018, test-only)"
	@echo "  make stop                - Stop all dev services"
	@echo ""
	@echo "CI/Testing:"
	@echo "  make ci-local            - Fast pre-commit checks (lint + build + test)"
	@echo "  make ci-full             - Full CI pipeline (lint + build + test + E2E)"
	@echo "  make e2e-backend         - Run backend-v2 E2E tests (281 tests)"
	@echo "  make e2e-frontend        - Run frontend E2E tests (54 tests)"
	@echo "  make test-backend        - Run backend unit tests"
	@echo ""
	@echo "Setup:"
	@echo "  make seed-dev            - Seed dev MongoDB with initial users"
	@echo "  make seed-e2e            - Seed E2E MongoDB with test users"
	@echo "  make reset-dev-db        - Reset dev database to clean state"
	@echo "  make clean-dev-db        - Remove all dev database data"
	@echo "  make fix-permissions     - Fix data directory ownership (no sudo required)"
	@echo "  make cleanup-old-data    - Remove old mongodb data directory"
	@echo "  make install-hooks       - Install git hooks (pre-commit + pre-push)"
	@echo "  make test-hook           - Test pre-commit hook with broken code"
	@echo ""
	@echo "Build:"
	@echo "  make build-backend       - Build Node.js backend"
	@echo "  make build-backend-v2    - Build backend-v2"
	@echo "  make build-frontend      - Build frontend"
	@echo ""
	@echo "Maintenance:"
	@echo "  make lint-backend        - Lint backend"
	@echo "  make lint-frontend       - Lint frontend"
	@echo "  make clean-e2e           - Clean all E2E test artifacts"
	@echo "  make clean-all           - Clean all build and test artifacts"

seed-dev:
	@echo "→ Seeding development MongoDB (port 27017)..."
	@MONGO_PORT=27017 bash backend-v2/seed-e2e-users.sh
	@echo "✓ Development users seeded"

seed-e2e:
	@echo "→ Seeding E2E MongoDB (port 27018)..."
	@MONGO_PORT=27018 bash backend-v2/seed-e2e-users.sh

start-mongodb-dev:
	@echo "→ Starting development MongoDB (port 27017)..."
	@docker-compose up -d mongodb-dev
	@echo "→ Waiting for MongoDB..."
	@sleep 3
	@echo "✓ Development MongoDB ready"

start-mongodb-e2e:
	@echo "→ Starting E2E MongoDB (port 27018)..."
	@docker-compose up -d mongodb-e2e
	@echo "→ Waiting for MongoDB..."
	@sleep 3
	@echo "✓ E2E MongoDB ready"

dev-backend-v2: start-mongodb-dev seed-dev
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build
	@echo "→ Starting backend-v2 in dev mode..."
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_DEV_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=false \
		$(MAKE) start
	@echo "✓ Backend-v2 running on http://localhost:$(BACKEND_PORT)"

dev-frontend:
	@echo "→ Starting frontend dev server..."
	@cd frontend && pnpm dev

dev: start-mongodb-dev seed-dev
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_DEV_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=false \
		$(MAKE) start
	@echo "✓ Backend-v2 running on http://localhost:$(BACKEND_PORT)"
	@echo ""
	@echo "→ Starting frontend dev server..."
	@if lsof -ti:$(FRONTEND_PORT) >/dev/null 2>&1; then \
		echo "  ✗ Port $(FRONTEND_PORT) occupied, cleaning..."; \
		lsof -ti:$(FRONTEND_PORT) | xargs -r kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "✓ Frontend will be available at http://localhost:$(FRONTEND_PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop..."
	@cd frontend && pnpm dev

stop:
	@echo "→ Stopping all services..."
	@cd backend-v2 && $(MAKE) stop 2>/dev/null || true
	@docker-compose stop mongodb-dev mongodb-e2e 2>/dev/null || true
	@echo "  → Killing processes on port 5173..."
	@lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@sleep 1
	@if lsof -ti:5173 >/dev/null 2>&1; then \
		echo "  ✗ Port 5173 still occupied"; \
		exit 1; \
	fi
	@echo "✓ All services stopped"

ci-local: lint-backend build-backend build-backend-v2 build-frontend lint-frontend test-backend
	@echo "✓ Pre-commit checks passed"

lint-backend:
	@echo "→ Linting backend..."
	@cd backend && npm run lint

build-backend:
	@echo "→ Building backend..."
	@cd backend && npm run build > /tmp/d5-backend-build.log 2>&1 || \
		(tail -30 /tmp/d5-backend-build.log && exit 1)

build-backend-v2:
	@echo "→ Building backend-v2..."
	@cd backend-v2 && docker build --target builder -t backend-v2-test . > /tmp/d5-backend-v2-build.log 2>&1 || \
		(tail -30 /tmp/d5-backend-v2-build.log && exit 1)

build-frontend:
	@echo "→ Building frontend..."
	@cd frontend && npm run build > /tmp/d5-frontend-build.log 2>&1 || \
		(tail -30 /tmp/d5-frontend-build.log && exit 1)

lint-frontend:
	@echo "→ Linting frontend..."
	@cd frontend && npm run lint

test-backend:
	@echo "→ Running backend unit tests..."
	@cd backend && npm test

e2e-backend: start-mongodb-e2e seed-e2e
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2 for E2E tests..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_E2E_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=true \
		$(MAKE) start
	@sleep 3
	@echo "→ Running backend-v2 E2E tests..."
	@TEST_EXIT=0; cd backend && E2E_SERVER_URL=http://localhost:$(BACKEND_PORT) E2E_API_BASE_PATH=$(API_ROOT) E2E_MONGO_URI=$(MONGO_E2E_URI) npm run test:e2e || TEST_EXIT=$$?; \
		cd ../backend-v2 && $(MAKE) stop; \
		exit $$TEST_EXIT

e2e-frontend: start-mongodb-e2e seed-e2e
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_E2E_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=true \
		$(MAKE) start
	@sleep 3
	@echo "→ Starting frontend dev server..."
	@cd frontend && bash -c 'nohup pnpm dev > /tmp/vite-e2e.log 2>&1 & echo $$! > /tmp/vite-e2e.pid'
	@sleep 5
	@echo "→ Running frontend E2E tests..."
	@TEST_EXIT=0; cd frontend && E2E_ADMIN_USER=admin E2E_ADMIN_PASS='P@ssw0rd!' CI=true npm run test:e2e:ci || TEST_EXIT=$$?; \
		kill $$(cat /tmp/vite-e2e.pid 2>/dev/null) 2>/dev/null || true; \
		cd ../backend-v2 && $(MAKE) stop; \
		exit $$TEST_EXIT

ci-full: ci-local e2e-backend e2e-frontend
	@echo "✓ Full CI pipeline completed"

install-hooks:
	@echo "→ Installing git hooks..."
	@cp .git-hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@cp .git-hooks/pre-push .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "✓ Git hooks installed (pre-commit + pre-push)"

test-hook:
	@echo "→ Testing pre-commit hook with broken code..."
	@echo "const broken = 'test" > backend/src/test-hook-validation.js
	@echo "Testing: Syntax error should be caught..."
	@make lint-backend 2>&1 | grep -q "error" && echo "✓ Hook would catch syntax errors" || echo "✗ Hook failed to catch error"
	@rm -f backend/src/test-hook-validation.js
	@echo "→ Testing build failure detection..."
	@echo "package invalid" > backend-v2/test-invalid.go
	@make build-backend-v2 2>&1 && echo "✗ Build should have failed" || echo "✓ Hook would catch build errors"
	@rm -f backend-v2/test-invalid.go
	@echo "✓ Hook validation complete"

reset-dev-db: stop
	@echo "→ Resetting development database..."
	@docker-compose stop mongodb-dev 2>/dev/null || true
	@docker rm -f d5-mongodb-dev 2>/dev/null || true
	@rm -rf data/mongodb-dev
	@echo "✓ Development database removed"
	@$(MAKE) start-mongodb-dev
	@$(MAKE) seed-dev
	@echo "✓ Development database reset to clean state"

clean-dev-db: stop
	@echo "→ Removing development database data..."
	@docker-compose stop mongodb-dev 2>/dev/null || true
	@docker rm -f d5-mongodb-dev 2>/dev/null || true
	@rm -rf data/mongodb-dev
	@echo "✓ Development database data removed"

fix-permissions:
	@echo "→ Fixing data directory permissions..."
	@docker-compose stop mongodb-dev mongodb-e2e 2>/dev/null || true
	@if [ -d "data/mongodb-dev" ]; then \
		docker run --rm -v $(PWD)/data:/data alpine chown -R $(shell id -u):$(shell id -g) /data/mongodb-dev 2>/dev/null || true; \
	fi
	@if [ -d "data/mongodb-e2e" ]; then \
		docker run --rm -v $(PWD)/data:/data alpine chown -R $(shell id -u):$(shell id -g) /data/mongodb-e2e 2>/dev/null || true; \
	fi
	@echo "✓ Data directory permissions fixed (owned by user $(shell id -un))"

cleanup-old-data:
	@echo "→ Cleaning up old MongoDB data directory..."
	@docker-compose stop 2>/dev/null || true
	@docker rm -f d5_mongodb_1 2>/dev/null || true
	@if [ -d "data/mongodb" ]; then \
		docker run --rm -v $(PWD)/data:/data alpine rm -rf /data/mongodb 2>/dev/null || true; \
		echo "✓ Old data/mongodb directory removed"; \
	else \
		echo "✓ No old data/mongodb directory found"; \
	fi

clean-e2e:
	@echo "→ Cleaning E2E test artifacts..."
	@rm -f frontend/junit.xml frontend/e2e.log frontend-e2e-output.log
	@rm -f backend/junit.xml backend/e2e.log backend-e2e-output.log
	@rm -rf frontend/test-results frontend/playwright-report frontend/blob-report
	@rm -rf backend/coverage
	@rm -f backend.log .dev-server.log nohup.out
	@rm -f /tmp/vite-e2e.log /tmp/vite-e2e.pid
	@echo "✓ E2E artifacts cleaned"

clean-all: clean-e2e
	@echo "→ Cleaning all build artifacts..."
	@rm -f /tmp/d5-backend-build.log /tmp/d5-backend-v2-build.log /tmp/d5-frontend-build.log
	@cd backend && rm -rf build/ coverage/ || true
	@cd frontend && rm -rf dist/ dist-ssr/ || true
	@cd backend-v2 && rm -f backend-v2 || true
	@echo "✓ All artifacts cleaned"

# Backwards compatibility alias
build-go: build-backend-v2
