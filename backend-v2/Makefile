.PHONY: help build build-docker start stop restart dev e2e logs logs-follow clean status test

# Configuration (allow override from environment)
BINARY_NAME := backend-v2
PORT ?= 3002
MONGO_URI ?= mongodb://localhost:27017/delta5
JWT_SECRET ?= GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO
API_ROOT ?= /api/v2
MOCK_EXTERNAL_SERVICES ?= false
DOCKER_IMAGE := d5-backend-v2
DOCKER_TAG := latest
LOG_DIR := logs

help:
	@echo "Backend-v2 (Go) Makefile"
	@echo ""
	@echo "Build:"
	@echo "  make build         - Build Go binary locally"
	@echo "  make build-docker  - Build Docker image"
	@echo ""
	@echo "Run:"
	@echo "  make start         - Start backend in background"
	@echo "  make dev           - Start backend in development mode (real services)"
	@echo "  make stop          - Stop running backend"
	@echo "  make restart       - Restart backend"
	@echo ""
	@echo "Test:"
	@echo "  make test          - Run Go unit tests"
	@echo "  make e2e           - Run E2E tests with mocked services"
	@echo ""
	@echo "Debug:"
	@echo "  make logs          - Show backend logs"
	@echo "  make logs-follow   - Stream logs in real-time (Ctrl-C to stop)"
	@echo "  make status        - Check backend status"
	@echo "  make clean         - Clean build artifacts and logs"

build:
	@echo "→ Building Go binary via Docker..."
	@mkdir -p $(LOG_DIR)
	@docker build --target builder -t $(DOCKER_IMAGE)-builder . > /tmp/d5-go-build.log 2>&1 || \
		(tail -30 /tmp/d5-go-build.log && exit 1)
	@docker create --name temp-$(BINARY_NAME) $(DOCKER_IMAGE)-builder
	@docker cp temp-$(BINARY_NAME):/build/service ./$(BINARY_NAME)
	@docker rm temp-$(BINARY_NAME)
	@chmod +x $(BINARY_NAME)
	@echo "✓ Binary built: $(BINARY_NAME)"

build-docker:
	@echo "→ Building Docker image..."
	@docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@echo "✓ Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

start: build
	@if lsof -i :$(PORT) -t >/dev/null 2>&1; then \
		echo "✗ Port $(PORT) already in use. Run 'make stop' first."; \
		exit 1; \
	fi
	@mkdir -p $(LOG_DIR)
	@echo "→ Starting backend on port $(PORT)..."
	@JWT_SECRET='$(JWT_SECRET)' \
	 MONGO_URI='$(MONGO_URI)' \
	 PORT=$(PORT) \
	 API_ROOT='$(API_ROOT)' \
	 MOCK_EXTERNAL_SERVICES='$(MOCK_EXTERNAL_SERVICES)' \
	 nohup ./$(BINARY_NAME) > $(LOG_DIR)/backend.log 2>&1 & \
	 echo $$! > $(LOG_DIR)/backend.pid
	@sleep 1
	@if kill -0 $$(cat $(LOG_DIR)/backend.pid) 2>/dev/null; then \
		echo "✓ Backend started (PID $$(cat $(LOG_DIR)/backend.pid))"; \
		echo "  Logs: $(LOG_DIR)/backend.log"; \
	else \
		echo "✗ Backend failed to start"; \
		tail -10 $(LOG_DIR)/backend.log; \
		exit 1; \
	fi

dev: build
	@if lsof -i :$(PORT) -t >/dev/null 2>&1; then \
		echo "✗ Port $(PORT) already in use. Run 'make stop' first."; \
		exit 1; \
	fi
	@mkdir -p $(LOG_DIR)
	@echo "→ Starting backend in DEVELOPMENT mode (real external services)..."
	@JWT_SECRET='$(JWT_SECRET)' \
	 MONGO_URI='$(MONGO_URI)' \
	 PORT=$(PORT) \
	 API_ROOT='$(API_ROOT)' \
	 MOCK_EXTERNAL_SERVICES='$(MOCK_EXTERNAL_SERVICES)' \
	 nohup ./$(BINARY_NAME) > $(LOG_DIR)/backend-dev.log 2>&1 & \
	 echo $$! > $(LOG_DIR)/backend-dev.pid
	@sleep 1
	@if kill -0 $$(cat $(LOG_DIR)/backend-dev.pid) 2>/dev/null; then \
		echo "✓ Backend started in DEV mode (PID $$(cat $(LOG_DIR)/backend-dev.pid))"; \
		echo "  Logs: $(LOG_DIR)/backend-dev.log"; \
	else \
		echo "✗ Backend failed to start"; \
		tail -10 $(LOG_DIR)/backend-dev.log; \
		exit 1; \
	fi

stop:
	@echo "→ Stopping backend..."
	@if [ -f $(LOG_DIR)/backend.pid ]; then \
		PID=$$(cat $(LOG_DIR)/backend.pid); \
		if kill -0 $$PID 2>/dev/null; then \
			kill -TERM $$PID 2>/dev/null || true; \
			sleep 1; \
			if kill -0 $$PID 2>/dev/null; then \
				kill -9 $$PID 2>/dev/null || true; \
			fi; \
		fi; \
		rm -f $(LOG_DIR)/backend.pid; \
	fi
	@if [ -f $(LOG_DIR)/backend-dev.pid ]; then \
		PID=$$(cat $(LOG_DIR)/backend-dev.pid); \
		if kill -0 $$PID 2>/dev/null; then \
			kill -TERM $$PID 2>/dev/null || true; \
			sleep 1; \
			if kill -0 $$PID 2>/dev/null; then \
				kill -9 $$PID 2>/dev/null || true; \
			fi; \
		fi; \
		rm -f $(LOG_DIR)/backend-dev.pid; \
	fi
	@if lsof -i :$(PORT) -t >/dev/null 2>&1; then \
		PID=$$(lsof -i :$(PORT) -t); \
		kill -9 $$PID 2>/dev/null || true; \
	fi
	@echo "✓ Backend stopped"

restart: stop start

status:
	@echo "→ Checking backend status..."
	@if lsof -i :$(PORT) -t >/dev/null 2>&1; then \
		PID=$$(lsof -i :$(PORT) -t); \
		echo "✓ Backend running (PID $$PID) on port $(PORT)"; \
		if [ -f $(LOG_DIR)/backend.pid ] || [ -f $(LOG_DIR)/backend-dev.pid ]; then \
			echo "  Log files:"; \
			ls -lh $(LOG_DIR)/*.log 2>/dev/null | tail -2; \
		fi; \
	else \
		echo "✗ Backend not running"; \
	fi

logs:
	@if [ -f $(LOG_DIR)/backend-dev.log ]; then \
		echo "=== Development Logs (last 50 lines) ==="; \
		tail -50 $(LOG_DIR)/backend-dev.log; \
	elif [ -f $(LOG_DIR)/backend.log ]; then \
		echo "=== Backend Logs (last 50 lines) ==="; \
		tail -50 $(LOG_DIR)/backend.log; \
	else \
		echo "✗ No log files found"; \
	fi

logs-follow:
	@if [ -f $(LOG_DIR)/backend-dev.log ]; then \
		echo "=== Following Development Logs (Ctrl-C to stop) ==="; \
		tail -f $(LOG_DIR)/backend-dev.log; \
	elif [ -f $(LOG_DIR)/backend.log ]; then \
		echo "=== Following Backend Logs (Ctrl-C to stop) ==="; \
		tail -f $(LOG_DIR)/backend.log; \
	else \
		echo "✗ No log files found"; \
	fi

test:
	@echo "→ Running Go unit tests..."
	@go test -v ./...

e2e:
	@echo "→ Running E2E tests with mocked external services..."
	@$(MAKE) stop
	@mkdir -p $(LOG_DIR)
	@echo "→ Starting backend in E2E mode (mocked external services)..."
	@JWT_SECRET='$(JWT_SECRET)' \
	 MONGO_URI='$(MONGO_URI)' \
	 PORT=$(PORT) \
	 API_ROOT='/api/v2' \
	 MOCK_EXTERNAL_SERVICES=true \
	 nohup ./$(BINARY_NAME) > $(LOG_DIR)/backend-e2e.log 2>&1 & \
	 echo $$! > $(LOG_DIR)/backend-e2e.pid
	@sleep 3
	@if ! kill -0 $$(cat $(LOG_DIR)/backend-e2e.pid) 2>/dev/null; then \
		echo "✗ Backend failed to start"; \
		tail -20 $(LOG_DIR)/backend-e2e.log; \
		exit 1; \
	fi
	@echo "✓ Backend started in E2E mode with MOCK_EXTERNAL_SERVICES=true (PID $$(cat $(LOG_DIR)/backend-e2e.pid))"
	@echo "→ Running E2E test suite..."
	@cd ../backend && \
	 E2E_SERVER_URL=http://localhost:$(PORT) \
	 E2E_API_BASE_PATH=/api/v2 \
	 E2E_MONGO_URI=$(MONGO_URI) \
	 npm run test:e2e -- --maxWorkers=1 --forceExit; \
	 TEST_EXIT=$$?; \
	 cd ../backend-v2 && $(MAKE) stop; \
	 exit $$TEST_EXIT

clean:
	@echo "→ Cleaning build artifacts..."
	@rm -f $(BINARY_NAME)
	@rm -rf $(LOG_DIR)/*.log
	@rm -rf $(LOG_DIR)/*.pid
	@echo "✓ Clean complete"
