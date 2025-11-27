# Backend-v2 (Go)

Go backend using Fiber framework, replacing Node.js backend at `/api/v1`.

## Quick Start

```bash
# Build binary
make build

# Start backend
make start

# Stop backend
make stop

# Check status
make status

# View logs
make logs
```

## Development

```bash
# Development mode (real external services)
make dev

# Run E2E tests
make e2e

# Run unit tests
make test
```

## Available Commands

Run `make help` to see all available targets:

```
Build:
  make build         - Build Go binary via Docker
  make build-docker  - Build Docker image

Run:
  make start         - Start backend in background
  make dev           - Start backend in development mode (real services)
  make stop          - Stop running backend
  make restart       - Restart backend

Test:
  make test          - Run Go unit tests
  make e2e           - Run E2E tests with mocked services

Debug:
  make logs          - Show backend logs
  make logs-follow   - Stream logs in real-time (Ctrl-C to stop)
  make status        - Check backend status
  make clean         - Clean build artifacts and logs
```

## Architecture

- **Port**: 3002
- **Base Path**: `/api/v1`
- **Database**: MongoDB at `localhost:27017/delta5`
- **JWT Auth**: HTTP-only cookies (refresh_token, auth)

## Environment Variables

- `PORT` - Server port (default: 3002)
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `MOCK_EXTERNAL_SERVICES` - Enable mocked external APIs (E2E mode)

## Integration with Root Makefile

The backend-v2 Makefile integrates with the root project Makefile:

```bash
# From project root
make build-go      # Builds backend-v2 binary
make ci-full       # Runs E2E tests via backend-v2/Makefile
```

## Logs

Logs are stored in `logs/` directory:

- `logs/backend.log` - Production logs
- `logs/backend-dev.log` - Development logs
- `logs/backend-e2e.log` - E2E test logs

PID files are stored alongside logs for process management.
