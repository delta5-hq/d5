.PHONY: help lint test build e2e dev dev-frontend dev-backend-v2 start-mongodb-dev start-mongodb-e2e start-backend-e2e start-backend-v2-e2e start-frontend-e2e stop stop-dev stop-e2e ci-local ci-full lint-backend lint-backend-v2 lint-docker-backend lint-docker-backend-v2 lint-docker-frontend lint-frontend check-no-legacy-version-symbols check-suffix-grammar-parity sync-suffix-grammar forbid-range-assertions forbid-staged-agent-artifacts build-backend build-backend-v2 build-frontend test-backend test-backend-v2 test-frontend test-scripts e2e-backend-v2 e2e-frontend e2e-frontend-throttled e2e-db-init e2e-db-drop dev-db-init dev-db-reset dev-db-drop setup-build-tools install-hooks test-hook clean-e2e clean-all fix-permissions cleanup-old-data e2e-disk-preflight probe-version probe-version-e2e

# Configuration
DOCKER_NETWORK := d5-dev-network
JWT_SECRET := test-jwt-secret-change-in-production
BACKEND_PORT := 3002
NODEJS_BACKEND_PORT := 3001
API_ROOT := /api/v2
MONGO_DEV_DATABASE := delta5-dev
MONGO_DEV_URI := mongodb://localhost:27017/$(MONGO_DEV_DATABASE)
MONGO_E2E_DATABASE := delta5-e2e
MONGO_E2E_URI := mongodb://localhost:27018/$(MONGO_E2E_DATABASE)
FRONTEND_PORT := 5173
E2E_BACKEND_V2_PORT := 3003
E2E_NODEJS_BACKEND_PORT := 3005
E2E_FRONTEND_PORT := 5174
SUFFIX_GRAMMAR_BACKEND := backend/src/controllers/commandExecutor/reliability/core/suffixGrammarShapes.json
SUFFIX_GRAMMAR_FRONTEND := frontend/src/shared/lib/reliability/suffix-grammar-shapes.json

help:
	@echo "Available targets:"
	@echo ""
	@echo "Quick Commands (all modules):"
	@echo "  make lint                - Lint all modules (backend + backend-v2 + frontend)"
	@echo "  make test                - Test all modules (backend + backend-v2 unit tests)"
	@echo "  make build               - Build all modules (backend + backend-v2 + frontend)"
	@echo "  make e2e                 - Run all E2E tests (backend-v2 + frontend)"
	@echo ""
	@echo "Development:"
	@echo "  make dev                 - Start full stack (MongoDB-dev + backend-v2 + Node.js backend + frontend)"
	@echo "  make dev-frontend        - Start frontend dev server only"
	@echo "  make dev-backend-v2      - Start backend-v2 in dev mode"
	@echo "  make start-mongodb-dev   - Start development MongoDB (port 27017, persistent)"
	@echo "  make start-mongodb-e2e   - Start E2E MongoDB (port 27018, test-only)"
	@echo "  make stop                - Stop all dev services"
	@echo ""
	@echo "CI/Testing:"
	@echo "  make ci-local            - Fast pre-commit checks (lint + build + test)"
	@echo "  make ci-full             - Full CI pipeline (lint + build + test + E2E)"
	@echo "  make e2e-backend-v2      - Run backend-v2 (Go) E2E tests"
	@echo "  make e2e-frontend        - Run frontend Playwright E2E tests (gated by MANUAL_RUN=1)"
	@echo "  make e2e-frontend-throttled - Run frontend E2E tests (throttled: slowMo=50ms)"
	@echo "  make test-backend        - Run backend unit tests"
	@echo "  make test-backend-v2     - Run backend-v2 unit tests"
	@echo "  make test-frontend       - Run frontend unit tests (Vitest)"
	@echo "  make test-scripts        - Run shell script unit tests (version.sh)"
	@echo "  make probe-version       - Verify running dev services match working-tree version (run before web-qa)"
	@echo "  make probe-version-e2e   - Same check against E2E ports"
	@echo ""
	@echo "Setup:"
	@echo "  make e2e-db-init         - Initialize E2E database with test fixtures"
	@echo "  make e2e-db-drop         - Drop E2E database"
	@echo "  make dev-db-init         - Initialize development database"
	@echo "  make dev-db-reset        - Reset development database to clean state"
	@echo "  make dev-db-drop         - Drop development database"
	@echo "  make setup-build-tools   - Check build tools and show installation links"
	@echo "  make fix-permissions     - Fix data directory ownership (no sudo required)"
	@echo "  make cleanup-old-data    - Remove old mongodb data directory"
	@echo "  make install-hooks       - Install git hooks (pre-commit + pre-push)"
	@echo ""
	@echo "Build:"
	@echo "  make build-backend       - Build Node.js backend"
	@echo "  make build-backend-v2    - Build backend-v2"
	@echo "  make build-frontend      - Build frontend"
	@echo ""
	@echo "Maintenance:"
	@echo "  make lint-backend        - Lint backend"
	@echo "  make lint-backend-v2     - Lint backend-v2 (with Docker fallback)"
	@echo "  make lint-docker-backend - Lint backend Dockerfile"
	@echo "  make lint-docker-backend-v2 - Lint backend-v2 Dockerfile"
	@echo "  make lint-docker-frontend - Lint frontend Dockerfile"
	@echo "  make lint-frontend       - Lint frontend"
	@echo "  make clean-e2e           - Clean all E2E test artifacts"
	@echo "  make clean-all           - Clean all build and test artifacts"

# Centralized commands (all modules)
check-no-legacy-version-symbols:
	@bash scripts/ci-helpers.sh check_no_legacy_version_symbols

check-suffix-grammar-parity:
	@diff $(SUFFIX_GRAMMAR_FRONTEND) $(SUFFIX_GRAMMAR_BACKEND) > /dev/null 2>&1 \
	  || (echo "ERROR: suffix-grammar-shapes.json is out of sync — run: make sync-suffix-grammar" && exit 1)
	@echo "✓ suffix-grammar-shapes.json parity confirmed"

sync-suffix-grammar:
	@cp $(SUFFIX_GRAMMAR_BACKEND) $(SUFFIX_GRAMMAR_FRONTEND)
	@echo "✓ suffix-grammar-shapes.json synced frontend ← backend"

lint: lint-backend lint-backend-v2 lint-docker-backend-v2 lint-docker-backend lint-docker-frontend lint-frontend check-no-legacy-version-symbols check-suffix-grammar-parity
	@echo "✓ All modules linted"

test: test-backend test-backend-v2 test-frontend test-scripts
	@echo "✓ All modules tested"

build: build-backend build-backend-v2 build-frontend
	@echo "✓ All modules built"

e2e: e2e-backend-v2 e2e-frontend
	@echo "✓ All E2E tests completed"

e2e-db-init:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users seed-users
	@echo "→ Initializing E2E database (port 27018)..."
	@DROP_DB=true MONGO_PORT=27018 bash backend-v2/e2e-db-init.sh
	@echo "✓ E2E database initialized"

e2e-db-drop:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users seed-users
	@echo "→ Dropping E2E database (port 27018)..."
	@MONGO_PORT=27018 bash backend-v2/e2e-db-drop.sh
	@echo "✓ E2E database dropped"

dev-db-init:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users seed-users
	@echo "→ Initializing development database (port 27017)..."
	@MONGO_PORT=27017 bash backend-v2/e2e-db-init.sh
	@echo "✓ Development database initialized"

dev-db-reset:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users seed-users
	@echo "→ Resetting development database..."
	@DROP_DB=true MONGO_PORT=27017 bash backend-v2/e2e-db-init.sh
	@echo "✓ Development database reset"

dev-db-drop:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users seed-users
	@echo "→ Dropping development database (port 27017)..."
	@MONGO_PORT=27017 bash backend-v2/e2e-db-drop.sh
	@echo "✓ Development database dropped"

start-mongodb-dev:
	@echo "→ Starting development MongoDB (port 27017)..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb-dev
	@echo "→ Waiting for MongoDB..."
	@sleep 3
	@echo "✓ Development MongoDB ready"

start-mongodb-e2e:
	@echo "→ Starting E2E MongoDB (port 27018)..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb-e2e
	@echo "→ Waiting for MongoDB..."
	@sleep 3
	@echo "✓ E2E MongoDB ready"

dev-backend-v2: start-mongodb-dev
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build
	@echo "→ Starting backend-v2 in dev mode..."
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_DEV_URI)' \
		MONGO_DATABASE='$(MONGO_DEV_DATABASE)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=false \
		$(MAKE) start
	@echo "✓ Backend-v2 running on http://localhost:$(BACKEND_PORT)"

dev-frontend:
	@echo "→ Starting frontend dev server..."
	@cd frontend && pnpm dev --host 0.0.0.0

dev: start-mongodb-dev
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_DEV_URI)' \
		MONGO_DATABASE='$(MONGO_DEV_DATABASE)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=false \
		$(MAKE) start
	@echo "✓ Backend-v2 running on http://localhost:$(BACKEND_PORT)"
	@echo ""
	@echo "→ Building Node.js backend..."
	@cd backend && pnpm run build
	@echo "→ Starting Node.js backend..."
	@if lsof -ti:$(NODEJS_BACKEND_PORT) >/dev/null 2>&1; then \
		echo "  ✗ Port $(NODEJS_BACKEND_PORT) occupied, cleaning..."; \
		lsof -ti:$(NODEJS_BACKEND_PORT) | xargs -r kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@PORT=$(NODEJS_BACKEND_PORT) \
		MONGO_URI='$(MONGO_DEV_URI)' \
		JWT_SECRET='$(JWT_SECRET)' \
		nohup node backend/build/index.js > backend/backend.log 2>&1 & \
		echo $$! > backend/backend.pid
	@sleep 3
	@if [ -f backend/backend.pid ] && kill -0 $$(cat backend/backend.pid) 2>/dev/null; then \
		echo "✓ Node.js backend running on http://localhost:$(NODEJS_BACKEND_PORT) (PID $$(cat backend/backend.pid))"; \
	else \
		echo "✗ Node.js backend failed to start"; \
		cat backend/backend.log 2>/dev/null || true; \
		exit 1; \
	fi
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
	@cd frontend && pnpm dev --host 0.0.0.0

stop-dev:
	@echo "→ Stopping dev services..."
	@cd backend-v2 && $(MAKE) stop 2>/dev/null || true
	@if [ -f backend/backend.pid ]; then \
		PID=$$(cat backend/backend.pid); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID 2>/dev/null || true; echo "  → Stopped Node.js backend (PID $$PID)"; fi; \
		rm -f backend/backend.pid; \
	fi
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml stop mongodb-dev 2>/dev/null || true
	@docker ps -q --filter "name=mongodb-dev" | xargs -r docker stop 2>/dev/null || true
	@lsof -ti:$(FRONTEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:$(NODEJS_BACKEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:$(BACKEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@echo "✓ Dev services stopped"

stop-e2e:
	@echo "→ Stopping e2e services..."
	@if [ -f backend/backend-e2e.pid ]; then \
		PID=$$(cat backend/backend-e2e.pid); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID 2>/dev/null || true; echo "  → Stopped e2e Node.js backend (PID $$PID)"; fi; \
		rm -f backend/backend-e2e.pid; \
	fi
	@if [ -f backend-v2/logs/backend-e2e.pid ]; then \
		PID=$$(cat backend-v2/logs/backend-e2e.pid); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID 2>/dev/null || true; echo "  → Stopped e2e backend-v2 (PID $$PID)"; fi; \
		rm -f backend-v2/logs/backend-e2e.pid; \
	fi
	@if [ -f /tmp/vite-e2e.pid ]; then \
		PID=$$(cat /tmp/vite-e2e.pid); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID 2>/dev/null || true; echo "  → Stopped e2e vite (PID $$PID)"; fi; \
		rm -f /tmp/vite-e2e.pid; \
	fi
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml stop mongodb-e2e 2>/dev/null || true
	@docker ps -q --filter "name=mongodb-e2e" | xargs -r docker stop 2>/dev/null || true
	@lsof -ti:$(E2E_FRONTEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:$(E2E_BACKEND_V2_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@lsof -ti:$(E2E_NODEJS_BACKEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@echo "✓ E2E services stopped"

stop: stop-dev stop-e2e
	@echo "✓ All services stopped"

forbid-range-assertions:
	@bash scripts/ci/forbid-range-assertions-on-counts.sh

forbid-staged-agent-artifacts:
	@bash scripts/ci/forbid-staged-agent-artifacts.sh

ci-local: lint build test forbid-range-assertions forbid-staged-agent-artifacts
	@echo "✓ Pre-commit checks passed"

probe-version:
	@bash scripts/probe-version.sh \
		"go-backend=http://localhost:$(BACKEND_PORT)/api/v2/version" \
		"node-backend=http://localhost:$(NODEJS_BACKEND_PORT)/version" \
		"frontend=http://localhost:$(FRONTEND_PORT)/version"

probe-version-e2e:
	@bash scripts/probe-version.sh \
		"go-backend=http://localhost:$(E2E_BACKEND_V2_PORT)/api/v2/version" \
		"node-backend=http://localhost:$(E2E_NODEJS_BACKEND_PORT)/version" \
		"frontend=http://localhost:$(E2E_FRONTEND_PORT)/version"

lint-backend:
	@bash scripts/ci-helpers.sh lint_node backend

lint-backend-v2:
	@bash scripts/ci-helpers.sh lint_go backend-v2

lint-docker-backend:
	@bash scripts/ci-helpers.sh lint_dockerfile Dockerfile backend

lint-docker-backend-v2:
	@bash scripts/ci-helpers.sh lint_dockerfile Dockerfile backend-v2

lint-docker-frontend:
	@bash scripts/ci-helpers.sh lint_dockerfile Dockerfile frontend

build-backend:
	@bash scripts/ci-helpers.sh build_node backend

build-backend-v2:
	@bash scripts/ci-helpers.sh build_go backend-v2 backend-v2

build-frontend:
	@bash scripts/ci-helpers.sh build_node frontend

lint-frontend:
	@bash scripts/ci-helpers.sh lint_node frontend

test-backend-v2:
	@bash scripts/ci-helpers.sh test_go backend-v2

test-backend:
	@bash scripts/ci-helpers.sh test_node backend

test-frontend:
	@echo "→ Running frontend unit tests..."
	@cd frontend && npm test -- --run

test-scripts:
	@echo "→ Running shell script tests..."
	@bash scripts/version.test.sh
	@bash scripts/probe-version.test.sh
	@node --test scripts/ci/__tests__/legacy-version-symbol-gate.test.mjs
	@node --test scripts/ci/__tests__/range-assertion-gate.test.mjs
	@node --test scripts/ci/__tests__/staged-agent-artifact-gate.test.mjs
	@node --test scripts/ci/__tests__/determinism-gate.test.mjs

start-backend-e2e:
	@echo "→ Building Node.js backend..."
	@cd backend && pnpm run build > /dev/null 2>&1
	@echo "→ Starting Node.js backend for E2E (port $(E2E_NODEJS_BACKEND_PORT))..."
	@lsof -ti:$(E2E_NODEJS_BACKEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@PORT=$(E2E_NODEJS_BACKEND_PORT) \
		MONGO_URI='$(MONGO_E2E_URI)' \
		JWT_SECRET='$(JWT_SECRET)' \
		MOCK_EXTERNAL_SERVICES=true \
		OPENAI_API_KEY= \
		CLAUDE_API_KEY= \
		PERPLEXITY_API_KEY= \
		DEEPSEEK_API_KEY= \
		QWEN_API_KEY= \
		YANDEX_API_KEY= \
		YANDEX_FOLDER_ID= \
		nohup node backend/build/index.js > backend/backend-e2e.log 2>&1 & \
		echo $$! > backend/backend-e2e.pid
	@sleep 3
	@if [ -f backend/backend-e2e.pid ] && kill -0 $$(cat backend/backend-e2e.pid) 2>/dev/null; then \
		echo "✓ Node.js backend e2e running on http://localhost:$(E2E_NODEJS_BACKEND_PORT) (PID $$(cat backend/backend-e2e.pid))"; \
	else \
		echo "✗ Node.js backend e2e failed to start"; \
		tail -10 backend/backend-e2e.log 2>/dev/null || true; \
		exit 1; \
	fi

start-backend-v2-e2e:
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2 for E2E (port $(E2E_BACKEND_V2_PORT))..."
	@lsof -ti:$(E2E_BACKEND_V2_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@cd backend-v2 && mkdir -p logs && ( \
		JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_E2E_URI)' \
		MONGO_DATABASE='$(MONGO_E2E_DATABASE)' \
		PORT=$(E2E_BACKEND_V2_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=true \
		NODEJS_BACKEND_URL=http://localhost:$(E2E_NODEJS_BACKEND_PORT) \
		nohup ./backend-v2 > logs/backend-e2e.log 2>&1 & echo $$! > logs/backend-e2e.pid )
	@sleep 3
	@if [ -f backend-v2/logs/backend-e2e.pid ] && kill -0 $$(cat backend-v2/logs/backend-e2e.pid) 2>/dev/null; then \
		echo "✓ Backend-v2 e2e running on http://localhost:$(E2E_BACKEND_V2_PORT) (PID $$(cat backend-v2/logs/backend-e2e.pid))"; \
	else \
		echo "✗ Backend-v2 e2e failed to start"; \
		tail -10 backend-v2/logs/backend-e2e.log 2>/dev/null || true; \
		exit 1; \
	fi
	@until curl -s http://localhost:$(E2E_BACKEND_V2_PORT)$(API_ROOT)/health > /dev/null 2>&1; do sleep 1; done

start-frontend-e2e:
	@echo "→ Starting E2E frontend (port $(E2E_FRONTEND_PORT))..."
	@lsof -ti:$(E2E_FRONTEND_PORT) 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@cd frontend && VITE_V2_API_URL=http://localhost:$(E2E_BACKEND_V2_PORT) \
		VITE_BASE_API_URL=http://localhost:$(E2E_BACKEND_V2_PORT) \
		nohup pnpm dev --port $(E2E_FRONTEND_PORT) > /tmp/vite-e2e.log 2>&1 & \
		echo $$! > /tmp/vite-e2e.pid
	@sleep 5
	@if [ -f /tmp/vite-e2e.pid ] && kill -0 $$(cat /tmp/vite-e2e.pid) 2>/dev/null; then \
		echo "✓ Vite e2e running on http://localhost:$(E2E_FRONTEND_PORT) (PID $$(cat /tmp/vite-e2e.pid))"; \
	else \
		echo "✗ Vite e2e failed to start"; \
		tail -10 /tmp/vite-e2e.log 2>/dev/null || true; \
		exit 1; \
	fi

e2e-disk-preflight:
	@bash scripts/ci-helpers.sh assert_e2e_disk_free $(E2E_DISK_MIN_GB)

e2e-backend-v2: e2e-disk-preflight start-mongodb-e2e e2e-db-init start-backend-e2e start-backend-v2-e2e
	@echo "→ Running backend-v2 E2E tests..."
	@TEST_EXIT=0; cd backend-v2/e2e && npm ci --silent --no-audit --no-fund < /dev/null && \
		E2E_SERVER_URL=http://localhost:$(E2E_BACKEND_V2_PORT) E2E_API_BASE_PATH=$(API_ROOT) E2E_MONGO_URI=$(MONGO_E2E_URI) CI=true npm test < /dev/null || TEST_EXIT=$$?; \
		cd ../.. && $(MAKE) stop-e2e > /dev/null 2>&1 || true; \
		exit $$TEST_EXIT

e2e-frontend:
	@if [ "$(MANUAL_RUN)" != "1" ]; then \
		echo ""; \
		echo "⚠  REFUSED: full e2e-frontend run is not permitted for agentic / unattended runs."; \
		echo ""; \
		echo "   The full Playwright suite takes 1+ hour. Under any agent harness with"; \
		echo "   per-step timeouts (typical 15-60 min) it WILL hit the timeout, the retry"; \
		echo "   will discard ~100% of the prior attempt's reasoning, and the environment"; \
		echo "   will crash or stall waiting on a dead session."; \
		echo ""; \
		echo "   Run focused tests instead, e.g.:"; \
		echo "     CI=1 E2E_BASE_URL=http://localhost:$(E2E_FRONTEND_PORT) npx playwright test e2e/<single-spec>.spec.ts --workers=1 --project=chromium"; \
		echo ""; \
		echo "   If you are a human and explicitly want the full 1+ hour run:"; \
		echo "     MANUAL_RUN=1 make e2e-frontend"; \
		echo ""; \
		exit 1; \
	fi
	@bash scripts/ci-helpers.sh assert_e2e_disk_free $(E2E_DISK_MIN_GB)
	@$(MAKE) start-mongodb-e2e e2e-db-init start-backend-e2e start-backend-v2-e2e start-frontend-e2e
	@echo "→ Running frontend E2E tests..."
	@TEST_EXIT=0; cd frontend && \
		E2E_BASE_URL=http://localhost:$(E2E_FRONTEND_PORT) \
		E2E_ADMIN_USER=admin \
		E2E_ADMIN_PASS='P@ssw0rd!' \
		CI=true \
		npm run test:e2e:ci || TEST_EXIT=$$?; \
		cd .. && $(MAKE) stop-e2e > /dev/null 2>&1 || true; \
		exit $$TEST_EXIT

e2e-frontend-throttled: e2e-disk-preflight start-mongodb-e2e e2e-db-init start-backend-e2e start-backend-v2-e2e start-frontend-e2e
	@echo "→ Running frontend E2E tests (throttled)..."
	@TEST_EXIT=0; cd frontend && \
		E2E_BASE_URL=http://localhost:$(E2E_FRONTEND_PORT) \
		E2E_ADMIN_USER=admin \
		E2E_ADMIN_PASS='P@ssw0rd!' \
		CI=true \
		npm run test:e2e:throttled || TEST_EXIT=$$?; \
		cd .. && $(MAKE) stop-e2e > /dev/null 2>&1 || true; \
		exit $$TEST_EXIT

ci-full: ci-local e2e
	@echo "✓ Full CI pipeline completed"

install-hooks:
	@echo "→ Installing git hooks..."
	@cp .git-hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@cp .git-hooks/pre-push .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@# Keepalive prevents the ref-discovery SSH session from idling out
	@# during ci-full, which otherwise breaks the post-hook pack upload.
	@git config --local core.sshCommand "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=240 -o TCPKeepAlive=yes"
	@echo "✓ Git hooks installed (pre-commit + pre-push) with SSH keepalive"

setup-build-tools:
	@bash scripts/setup-build-tools.sh

fix-permissions:
	@echo "→ Fixing data directory permissions..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml stop mongodb-dev mongodb-e2e 2>/dev/null || true
	@if [ -d "data/mongodb-dev" ]; then \
		docker run --rm --network $(DOCKER_NETWORK) -v $(PWD)/data:/data alpine chown -R $(shell id -u):$(shell id -g) /data/mongodb-dev 2>/dev/null || true; \
	fi
	@if [ -d "data/mongodb-e2e" ]; then \
		docker run --rm --network $(DOCKER_NETWORK) -v $(PWD)/data:/data alpine chown -R $(shell id -u):$(shell id -g) /data/mongodb-e2e 2>/dev/null || true; \
	fi
	@echo "✓ Data directory permissions fixed (owned by user $(shell id -un))"

cleanup-old-data:
	@echo "→ Cleaning up old MongoDB data directory..."
	@docker-compose stop 2>/dev/null || true
	@docker rm -f d5_mongodb_1 2>/dev/null || true
	@if [ -d "data/mongodb" ]; then \
		docker run --rm --network $(DOCKER_NETWORK) -v $(PWD)/data:/data alpine rm -rf /data/mongodb 2>/dev/null || true; \
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
	@rm -f backend-v2/logs/backend-e2e.pid backend-v2/logs/backend-e2e.log
	@rm -f backend/backend-e2e.pid backend/backend-e2e.log
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
